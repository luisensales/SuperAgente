import { memory, ChatMessage } from '../db/memory.js';
import { chatCompletion } from '../llm/client.js';
import { getToolsForLLM, getTool } from '../tools/registry.js';
// Import to ensure tool is registered
import '../tools/implementations/getTime.js';
import '../tools/implementations/googleTools.js';

const SYSTEM_PROMPT = `
Eres SuperAgente, mi asistente de IA personal. 
Responde de forma clara, directa, y útil. 
Te comunicas en español. 
Tienes acceso a herramientas para:
1. Leer, ENVIAR y crear BORRADORES de correos en Gmail.
2. Leer, CREAR, ACTUALIZAR y ELIMINAR eventos en Google Calendar.
3. Consultar la fecha y hora actual en España.

REGLA DE ORO PARA GMAIL: Al enviar correos o crear borradores, SIEMPRE debes incluir una firma al final del mensaje que diga:
"Un saludo,
Luis (Tu SuperAgente)"

Si el usuario te pide algo de Google y las herramientas te indican que no hay autorización (o si es la primera vez), 
pídele amablemente que use el comando /auth_google para conectar su cuenta.
`;

const MAX_ITERATIONS = 5;

export async function runAgentIteration(userMessage: string): Promise<string> {
    // 1. Guardar mensaje del usuario en bd
    await memory.addMessage({ role: 'user', content: userMessage });

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // 2. Obtener historial para contexto
        const history = await memory.getMessages();
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.map(msg => ({
                role: msg.role,
                content: msg.content,
                // Groq API uses specific tool formats sometimes
                ...(msg.name ? { name: msg.name } : {}),
            }))
        ];

        // 3. Ejecutar modelo
        const tools = getToolsForLLM();
        const completion = await chatCompletion(messages, tools.length > 0 ? tools : undefined);

        const message = completion?.message;

        if (!message) {
            return "Hubo un error obteniendo la respuesta.";
        }

        // 4. Si el modelo quiere ejecutar una herramienta
        if (message.tool_calls && message.tool_calls.length > 0) {
            // Guardar intento de herramienta en memoria

            // Need to format tool calls to string or appropriate type for DB 
            // Typically we don't save raw tool execution in simple history 
            // but to maintain local context we append to our local memory loop

            for (const toolCall of message.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments || "{}");

                const tool = getTool(functionName);
                let result: string;

                if (tool) {
                    try {
                        console.log(`Executing tool: ${functionName}`);
                        result = await tool.execute(functionArgs);
                    } catch (e: any) {
                        result = `Error al ejecutar la herramienta: ${e.message}`;
                    }
                } else {
                    result = `Herramienta desconocida: ${functionName}`;
                }

                // Guardar la llamada al historial temporal (no en DB permanente si no queremos cargarla)
                // Para este ejemplo simple la guardaremos en la BD de memoria.
                await memory.addMessage({
                    role: 'assistant',
                    content: message.content || `[Llamando herramienta ${functionName}]`
                });

                await memory.addMessage({
                    role: 'tool',
                    name: functionName,
                    content: result
                });
            }

            // Continuar al siguiente ciclo (iterations loop) para enviar los resultados de tool al LLM
            continue;
        }

        // 5. El modelo ha dado una respuesta normal, guardar en DB y retornar
        const finalContent = message.content || "";
        await memory.addMessage({ role: 'assistant', content: finalContent });
        return finalContent;
    }

    return "Se alcanzó el límite de iteraciones del agente sin una respuesta final.";
}
