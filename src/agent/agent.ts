import { memory, ChatMessage } from '../db/memory.js';
import { chatCompletion } from '../llm/client.js';
import { getToolsForLLM, getTool } from '../tools/registry.js';
// Import to ensure tool is registered
import '../tools/implementations/getTime.js';
import '../tools/implementations/googleTools.js';
import '../tools/implementations/gptResearcherTool.js';

const SYSTEM_PROMPT = `
Eres SuperAgente, mi asistente de IA personal. 
Responde de forma clara, directa, y útil. 
Te comunicas en español. 
Tienes acceso a herramientas para:
1. Leer, ENVIAR y crear BORRADORES de correos en Gmail.
2. Leer, CREAR, ACTUALIZAR y ELIMINAR eventos en Google Calendar.
3. Leer, BUSCAR, CREAR y EDITAR archivos en Google Drive (incluyendo actualizar documentos existentes sin duplicarlos con 'create_or_update_google_doc').
4. Consultar la fecha y hora actual en España.
5. Iniciar investigaciones profundas en internet y crear largos informes completos usando la herramienta 'deep_research' (GPT-Researcher).

REGLA CRÍTICA: NO pongas excusas sobre el formato. Si el usuario te pide un documento con negritas, listas o títulos, utiliza la herramienta 'create_or_update_google_doc'. Tienes capacidad plena para generar o actualizar documentos profesionales. IMPORTANTE: Antes de actualizar un documento existente, léelo siempre con 'read_drive_file' para no perder la información que ya contenía.

REGLA DE ORO PARA GMAIL: Al enviar correos o crear borradores, SIEMPRE debes incluir una firma al final del mensaje que diga:
"Un saludo,
Luis"

Si el usuario te pide algo de Google y las herramientas te indican que no hay autorización (o si es la primera vez), 
pídele amablemente que use el comando /auth_google para conectar su cuenta.
`;

const MAX_ITERATIONS = 5;

export async function runAgentIteration(userMessage: string): Promise<string> {
    try {
        // 1. Guardar mensaje del usuario en bd
        await memory.addMessage({ role: 'user', content: userMessage });

        let iterations = 0;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            // 2. Obtener historial para contexto
            const history = await memory.getMessages(25); // Limitado a los últimos 25 mensajes para estabilidad
            const messages = [
                { role: "system", content: SYSTEM_PROMPT },
                ...history.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    ...(msg.name ? { name: msg.name } : {}),
                }))
            ];

            // 3. Ejecutar modelo
            const tools = getToolsForLLM();
            const completion = await chatCompletion(messages, tools.length > 0 ? tools : undefined);

            const message = completion?.message;

            if (!message) {
                console.error("No se recibió mensaje de Groq.");
                return "Lo siento, mi conexión con el cerebro de IA falló temporalmente. Por favor, reintenta.";
            }

            // 4. Si el modelo quiere ejecutar una herramienta
            if (message.tool_calls && message.tool_calls.length > 0) {
                // Guardar la intención del asistente antes de las herramientas
                await memory.addMessage({
                    role: 'assistant',
                    content: message.content || `[Procesando con herramientas...]`
                });

                for (const toolCall of message.tool_calls) {
                    const functionName = toolCall.function.name;
                    let functionArgs: any = {};

                    try {
                        functionArgs = JSON.parse(toolCall.function.arguments || "{}");
                    } catch (e) {
                        console.error("Error parseando argumentos de herramienta:", e);
                        await memory.addMessage({
                            role: 'tool',
                            name: functionName,
                            content: "Error: Los argumentos proporcionados no son un JSON válido."
                        });
                        continue;
                    }

                    const tool = getTool(functionName);
                    let result: string;

                    if (tool) {
                        try {
                            console.log(`🛠️ Ejecutando herramienta: ${functionName}`);
                            result = await tool.execute(functionArgs);
                        } catch (e: any) {
                            console.error(`Error en ejecución de ${functionName}:`, e);
                            result = `Error al ejecutar la herramienta: ${e.message}`;
                        }
                    } else {
                        result = `Herramienta desconocida: ${functionName}`;
                    }

                    // Guardar el resultado de la herramienta
                    await memory.addMessage({
                        role: 'tool',
                        name: functionName,
                        content: result
                    });
                }

                // Continuar al siguiente ciclo para que el LLM vea los resultados
                continue;
            }

            // 5. El modelo ha dado una respuesta normal
            const finalContent = message.content || "";
            if (finalContent) {
                await memory.addMessage({ role: 'assistant', content: finalContent });
            }
            return finalContent;
        }

        return "Me he quedado pensando demasiado tiempo. ¿Podrías hacerme la pregunta de forma más sencilla?";
    } catch (globalError: any) {
        console.error("Error crítico en runAgentIteration:", globalError);
        return "He tenido un cortocircuito interno. ¿Puedes intentar preguntármelo de otra forma?";
    }
}
