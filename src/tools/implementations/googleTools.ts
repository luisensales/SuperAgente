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

// --- Gmail: Send Email ---
export const sendGmailEmailTool: Tool = {
    name: "send_gmail_email",
    description: "Envía un correo electrónico desde tu cuenta de Gmail.",
    parameters: {
        type: "object",
        properties: {
            to: { type: "string", description: "Dirección de correo del destinatario." },
            subject: { type: "string", description: "Asunto del correo." },
            body: { type: "string", description: "Cuerpo del mensaje." }
        },
        required: ["to", "subject", "body"]
    },
    execute: async ({ to, subject, body }) => {
        if (!await isAuthorized()) return "Error: El usuario no ha autorizado el acceso a Google. Pide al usuario que use el comando /auth_google.";

        try {
            const auth = await getOAuth2Client();
            const gmail = google.gmail({ version: 'v1', auth });

            // Gmail requires raw RFC822 messages encoded in base64url
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${to}`,
                'Content-Type: text/plain; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                '',
                body,
            ];
            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });

            return `✅ Correo enviado con éxito a ${to}.`;
        } catch (error: any) {
            return `Error al enviar correo: ${error.message}`;
        }
    }
};

// --- Calendar: Create Event ---
export const createCalendarEventTool: Tool = {
    name: "create_calendar_event",
    description: "Crea un nuevo evento en tu calendario de Google.",
    parameters: {
        type: "object",
        properties: {
            summary: { type: "string", description: "Título del evento." },
            description: { type: "string", description: "Descripción opcional." },
            start: { type: "string", description: "Fecha y hora de inicio (formato ISO, ej: 2024-03-10T15:00:00)." },
            end: { type: "string", description: "Fecha y hora de fin (formato ISO)." }
        },
        required: ["summary", "start", "end"]
    },
    execute: async ({ summary, description, start, end }) => {
        if (!await isAuthorized()) return "Error: El usuario no ha autorizado el acceso a Google. Pide al usuario que use el comando /auth_google.";

        try {
            const auth = await getOAuth2Client();
            const calendar = google.calendar({ version: 'v3', auth });

            await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary,
                    description,
                    start: { dateTime: start, timeZone: 'Europe/Madrid' },
                    end: { dateTime: end, timeZone: 'Europe/Madrid' },
                },
            });

            return `✅ Evento '${summary}' creado con éxito en tu calendario.`;
        } catch (error: any) {
            return `Error al crear evento: ${error.message}`;
        }
    }
};

// --- Gmail: Create Draft ---
export const createGmailDraftTool: Tool = {
    name: "create_gmail_draft",
    description: "Crea un borrador de correo electrónico en Gmail sin enviarlo.",
    parameters: {
        type: "object",
        properties: {
            to: { type: "string", description: "Dirección de correo del destinatario." },
            subject: { type: "string", description: "Asunto del borrador." },
            body: { type: "string", description: "Cuerpo del mensaje." }
        },
        required: ["to", "subject", "body"]
    },
    execute: async ({ to, subject, body }) => {
        if (!await isAuthorized()) return "Error: El usuario no ha autorizado el acceso a Google. Pide al usuario que use el comando /auth_google.";

        try {
            const auth = await getOAuth2Client();
            const gmail = google.gmail({ version: 'v1', auth });

            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${to}`,
                'Content-Type: text/plain; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                '',
                body,
            ];
            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            await gmail.users.drafts.create({
                userId: 'me',
                requestBody: {
                    message: {
                        raw: encodedMessage,
                    },
                },
            });

            return `✅ Borrador creado con éxito para ${to}. Puedes revisarlo en tu carpeta de borradores de Gmail.`;
        } catch (error: any) {
            return `Error al crear borrador: ${error.message}`;
        }
    }
};

// --- Calendar: Delete Event ---
export const deleteCalendarEventTool: Tool = {
    name: "delete_calendar_event",
    description: "Elimina un evento del calendario de Google usando su ID o buscando por título.",
    parameters: {
        type: "object",
        properties: {
            eventId: { type: "string", description: "El ID del evento a eliminar." },
        },
        required: ["eventId"]
    },
    execute: async ({ eventId }) => {
        if (!await isAuthorized()) return "Error: El usuario no ha autorizado el acceso a Google.";

        try {
            const auth = await getOAuth2Client();
            const calendar = google.calendar({ version: 'v3', auth });
            await calendar.events.delete({ calendarId: 'primary', eventId });
            return `✅ Evento con ID ${eventId} eliminado con éxito.`;
        } catch (error: any) {
            return `Error al eliminar evento: ${error.message}`;
        }
    }
};

// --- Calendar: Update Event ---
export const updateCalendarEventTool: Tool = {
    name: "update_calendar_event",
    description: "Actualiza un evento existente en Google Calendar.",
    parameters: {
        type: "object",
        properties: {
            eventId: { type: "string", description: "ID del evento a actualizar." },
            summary: { type: "string", description: "Nuevo título del evento." },
            start: { type: "string", description: "Nueva fecha/hora inicio (ISO)." },
            end: { type: "string", description: "Nueva fecha/hora fin (ISO)." }
        },
        required: ["eventId"]
    },
    execute: async ({ eventId, summary, start, end }) => {
        if (!await isAuthorized()) return "Error: Autorización requerida.";

        try {
            const auth = await getOAuth2Client();
            const calendar = google.calendar({ version: 'v3', auth });

            const event: any = {};
            if (summary) event.summary = summary;
            if (start) event.start = { dateTime: start, timeZone: 'Europe/Madrid' };
            if (end) event.end = { dateTime: end, timeZone: 'Europe/Madrid' };

            await calendar.events.patch({
                calendarId: 'primary',
                eventId,
                requestBody: event
            });

            return `✅ Evento actualizado con éxito.`;
        } catch (error: any) {
            return `Error al actualizar evento: ${error.message}`;
        }
    }
};

// Register tools
registerTool(listGmailMessagesTool);
registerTool(listCalendarEventsTool);
registerTool(sendGmailEmailTool);
registerTool(createCalendarEventTool);
registerTool(createGmailDraftTool);
registerTool(deleteCalendarEventTool);
registerTool(updateCalendarEventTool);
