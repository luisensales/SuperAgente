import { Tool, registerTool } from '../registry.js';
import { env } from '../../config.js';

export const gptResearcherTool: Tool = {
    name: "deep_research",
    description: "Inicia una investigación profunda sobre un tema complejo de internet usando GPT-Researcher alojado en Hugging Face. Úsala si te piden un informe largo, buscar noticias actualizadas o investigar profundamente y consolidar información de varias fuentes web. Devuelve un texto markdown de 2 o 3 páginas. NO USES esto para buscar la fecha (usa get_current_time).",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "La pregunta o tema a investigar. Debe ser detallado. Ej: '¿Cuáles han sido los avances clave en computación cuántica de 2025?'"
            },
            report_type: {
                type: "string",
                description: "El formato general del reporte ('research_report' por defecto).",
                enum: ["research_report", "subtopic_report", "custom_report"]
            }
        },
        required: ["query"]
    },
    execute: async (args: any) => {
        const { query, report_type = "research_report" } = args;

        if (!env.GPT_RESEARCHER_URL) {
            return "Error: La URL de GPT Researcher no está configurada (Falta GPT_RESEARCHER_URL en el entorno). Avísale al usuario que necesita configurar el enlace a su despliegue de Hugging Face.";
        }

        try {
            console.log(`🤖 Iniciando investigación profunda sobre "${query}" en ${env.GPT_RESEARCHER_URL} ...`);
            
            // Asumimos que GPT-Researcher está corriendo de fondo en su modo FastAPI 
            // y que expone POST al endpoint /api/research o similar 
            // (La documentación suele indicar endpoints websocket o POST /api)
            const apiUrl = env.GPT_RESEARCHER_URL.endsWith('/') 
                ? `${env.GPT_RESEARCHER_URL}api` 
                : `${env.GPT_RESEARCHER_URL}/api`;

            // Muchas veces Hugging Face nos pide un Timeout super largo.
            // Para la versión básica de la API (y en la doc dice que suele usar websockets)
            // vamos a adaptarnos a un fetch asíncrono básico. 
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    report_type: report_type,
                    report_source: "web"
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API respondió con estado ${response.status}: ${errText}`);
            }

            // Según la API de gpt_researcher, aquí podemos recibir el informe Markdown.
            // Dependiendo de la versión de la plantilla FASTAPI, podría ser { "report": "..." }
            const data = await response.json();
            
            if (data.report) {
                return data.report;
            } else {
                return "La investigación terminó exitosamente pero devolvió un formato confuso: " + JSON.stringify(data).substring(0, 300);
            }
            
        } catch (error: any) {
            console.error("Falló GPT Researcher:", error);
            if (error.name === 'AbortError') {
                return "La búsqueda ha tardado demasiado y se ha agotado el tiempo de espera de nuestra API externa.";
            }
            return `Ocurrió un error consultando a la agencia de investigación (GPT-Researcher): ${error.message}`;
        }
    }
};

registerTool(gptResearcherTool);
