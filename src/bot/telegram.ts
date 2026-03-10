import { Bot } from 'grammy';
import { env } from '../config.js';
import { runAgentIteration } from '../agent/agent.js';
import { transcribeAudio } from '../llm/client.js';
import fs from 'fs';
import { getAuthUrl, setTokensFromCode, isAuthorized } from '../lib/googleAuth.js';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Middleware for Whitelisting User IDs
bot.use(async (ctx, next) => {
    if (ctx.from?.id && env.TELEGRAM_ALLOWED_USER_IDS.includes(ctx.from.id)) {
        await next();
    } else {
        console.warn(`Unauthorized access attempt from User ID: ${ctx.from?.id}`);
    }
});

bot.command("start", async (ctx) => {
    await ctx.reply("¡Hola! Soy SuperAgente, tu asistente de IA personal. ¿En qué te puedo ayudar hoy?");
});

bot.command("auth_google", async (ctx) => {
    try {
        const url = await getAuthUrl();
        await ctx.reply(`Para conectar tu cuenta de Google, abre este enlace, autoriza la aplicación y luego envíame el código que te devuelva:\n\n${url}`);
    } catch (error: any) {
        await ctx.reply(`Error al generar URL de autorización: ${error.message}`);
    }
});

// Command to receive the code
bot.command("google_code", async (ctx) => {
    const code = ctx.match;
    if (!code) return ctx.reply("Por favor, usa el formato: /google_code [tu_codigo]");

    try {
        await setTokensFromCode(code);
        await ctx.reply("✅ ¡Cuenta de Google conectada con éxito! Ahora puedo acceder a tu Gmail y Calendario.");
    } catch (error: any) {
        await ctx.reply(`❌ Error al conectar cuenta: ${error.message}`);
    }
});

// Voice message handler
bot.on("message:voice", async (ctx) => {
    await ctx.replyWithChatAction("typing");

    try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        // Download the file
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to download voice message");

        // Convert the web stream to a Node.js readable stream for Groq
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        // Save to a temporary file because Groq SDK might expect a file-like object or real file for better compatibility
        const tempPath = `./temp_voice_${Date.now()}.ogg`;
        fs.writeFileSync(tempPath, buffer);

        // Transcribe
        const transcription = await transcribeAudio(fs.createReadStream(tempPath));

        // Delete temp file
        fs.unlinkSync(tempPath);

        await ctx.reply(`🎤 *Transcripción:* _${transcription}_`, { parse_mode: "Markdown" });

        // Process with Agent
        const agentResponse = await runAgentIteration(transcription);
        await ctx.reply(agentResponse);

    } catch (error) {
        console.error("Error processing voice message:", error);
        await ctx.reply("Lo siento, hubo un error procesando tu mensaje de voz.");
    }
});

// Main message handler
bot.on("message:text", async (ctx) => {
    const userText = ctx.message.text;

    // Enviar un indicador de que el bot está "escribiendo..."
    await ctx.replyWithChatAction("typing");

    try {
        const response = await runAgentIteration(userText);
        await ctx.reply(response);
    } catch (error) {
        console.error("Error running agent iteration:", error);
        await ctx.reply("Lo siento, ha ocurrido un error interno al procesar tu solicitud.");
    }
});
