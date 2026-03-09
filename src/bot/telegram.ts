import { Bot } from 'grammy';
import { env } from '../config.js';
import { runAgentIteration } from '../agent/agent.js';

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
