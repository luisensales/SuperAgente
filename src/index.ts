import { bot } from './bot/telegram.js';
import { env } from './config.js';
import http from 'http';

const PORT = process.env.PORT || 8080;

async function main() {
    console.log("Iniciando SuperAgente...");

    // 🌐 Servidor de salud y callback de Google
    const server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);

        if (url.pathname === '/google/callback') {
            const code = url.searchParams.get('code');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            if (code) {
                res.end(`
                    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                        <h1>✅ Autorización casi lista</h1>
                        <p>Copia este código y envíaselo al bot en Telegram:</p>
                        <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; display: inline-block; font-family: monospace; font-size: 1.2em; border: 1px solid #ccc;">
                            ${code}
                        </div>
                        <p style="margin-top: 20px; color: #666;">Usa el comando: <code>/google_code ${code}</code></p>
                    </div>
                `);
            } else {
                res.end('<h1>❌ No se encontró el código de autorización</h1>');
            }
            return;
        }

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
