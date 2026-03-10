import { google } from 'googleapis';
import { Tool, registerTool } from '../registry.js';
import { getOAuth2Client, isAuthorized } from '../../lib/googleAuth.js';

// --- Gmail: List Messages ---
export const listGmailMessagesTool: Tool = {
    name: "list_gmail_emails",
    description: "Lista los últimos correos electrónicos recibidos en Gmail.",
    parameters: {
        type: "object",
        properties: {
            maxResults: { type: "number", description: "Número máximo de correos a listar (por defecto 5)." }
        },
    },
    execute: async ({ maxResults = 5 }) => {
        if (!await isAuthorized()) return "Error: El usuario no ha autorizado el acceso a Google. Pide al usuario que use el comando /auth_google.";

        try {
            const auth = await getOAuth2Client();
            const gmail = google.gmail({ version: 'v1', auth });
            const res = await gmail.users.messages.list({
                userId: 'me',
                maxResults: maxResults,
            });

            const messages = res.data.messages || [];
            if (messages.length === 0) return "No se encontraron correos.";

            const details = await Promise.all(messages.map(async (msg) => {
                const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
                const subject = fullMsg.data.payload?.headers?.find(h => h.name === 'Subject')?.value || 'Sin asunto';
                const from = fullMsg.data.payload?.headers?.find(h => h.name === 'From')?.value || 'Desconocido';
                return `- **De:** ${from}\n  **Asunto:** ${subject}`;
            }));

            return `Últimos correos:\n${details.join('\n')}`;
        } catch (error: any) {
            return `Error al listar correos: ${error.message}`;
        }
    }
};

// --- Calendar: List Events ---
export const listCalendarEventsTool: Tool = {
    name: "list_calendar_events",
    description: "Lista los próximos eventos del calendario de Google.",
    parameters: {
        type: "object",
        properties: {
            maxResults: { type: "number", description: "Número máximo de eventos a listar (por defecto 5)." }
        },
    },
    execute: async ({ maxResults = 5 }) => {
        if (!await isAuthorized()) return "Error: El usuario no ha autorizado el acceso a Google. Pide al usuario que use el comando /auth_google.";

        try {
            const auth = await getOAuth2Client();
            const calendar = google.calendar({ version: 'v3', auth });
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                maxResults: maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = res.data.items || [];
            if (events.length === 0) return "No tienes eventos próximos.";

            const eventList = events.map(event => {
                const startRaw = event.start?.dateTime || event.start?.date;
                let startStr = startRaw;

                if (startRaw) {
                    const date = new Date(startRaw);
                    startStr = date.toLocaleString('es-ES', {
                        timeZone: 'Europe/Madrid',
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }

                return `- **${event.summary}** (${startStr})`;
            });

            return `Próximos eventos:\n${eventList.join('\n')}`;
        } catch (error: any) {
            return `Error al listar eventos: ${error.message}`;
        }
    }
};

// Register tools
registerTool(listGmailMessagesTool);
registerTool(listCalendarEventsTool);
