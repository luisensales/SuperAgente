import { Tool, registerTool } from '../registry.js';

export const getTimeTool: Tool = {
    name: "get_current_time",
    description: "Obtiene la fecha y hora actual del sistema. Úsalo si el usuario te pregunta por la hora o la fecha actual.",
    parameters: {
        type: "object",
        properties: {}, // No arguments required
    },
    execute: () => {
        const now = new Date();
        // Return a formatted timestamp
        return now.toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
            timeZoneName: 'short',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
};

registerTool(getTimeTool);
