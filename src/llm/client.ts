import Groq from 'groq-sdk';
import { env } from '../config.js';

export const groq = new Groq({
    apiKey: env.GROQ_API_KEY,
});

export async function chatCompletion(
    messages: any[],
    tools?: any[],
    model: string = "llama-3.3-70b-versatile"
) {
    try {
        const response = await groq.chat.completions.create({
            messages: messages,
            model: model,
            tools: tools,
            tool_choice: "auto",
        });

        return response.choices[0];
    } catch (error) {
        console.error("Error from Groq API:", error);

        // Placeholder logic for OpenRouter Fallback if configured
        if (env.OPENROUTER_API_KEY) {
            console.warn("Attempting OpenRouter fallback...");
            return await chatCompletionOpenRouterFallback(messages, tools);
        }

        throw error;
    }
}

async function chatCompletionOpenRouterFallback(messages: any[], tools?: any[]) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: env.OPENROUTER_MODEL,
                messages: messages,
                tools: tools,
            })
        });

        const data = await response.json();
        return data.choices[0];
    } catch (error) {
        console.error("OpenRouter fallback failed:", error);
        throw error;
    }
}
