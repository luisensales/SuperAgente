import { bot } from './bot/telegram.js';
import { env } from './config.js';
import http from 'http';

const PORT = process.env.PORT || 8080;

async function main() {
    console.log("Iniciando SuperAgente...");

    // 🌐 Servidor de salud para la nube (Health Check)
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('SuperAgente is running!');
    });

    server.listen(PORT, () => {
        console.log(`🌐 Servidor de salud escuchando en el puerto ${PORT}`);
    });

    // Start the bot using Long Polling
    bot.catch((err) => {
        console.error("Error en bot de Telegram:", err);
    });

    bot.start({
        onStart: (botInfo) => {
            console.log(`🤖 Bot iniciado correctamente como @${botInfo.username}`);
            console.log(`🔒 Escuchando usuarios autorizados: ${env.TELEGRAM_ALLOWED_USER_IDS.join(', ')}`);
        }
    });
}

// Escuchar señales para cerrado seguro
process.once('SIGINT', () => {
    console.log("Deteniendo bot...");
    bot.stop();
});
process.once('SIGTERM', () => {
    console.log("Deteniendo bot...");
    bot.stop();
});

main().catch(console.error);
