import OpenAI from 'openai';

/**
 * AI Service for managing LLM interactions.
 * Centrally handles client initialization (Groq/OpenAI) and utility functions.
 */

export const getAiClient = () => {
    if (process.env.GROQ_API_KEY) {
        return new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });
    } else if (process.env.OPENAI_API_KEY) {
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return null;
};

export const getAiModel = () => {
    if (process.env.GROQ_API_KEY) {
        return process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    }
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
};

export const getAiFallbackModel = () => {
    if (process.env.GROQ_API_KEY) {
        return 'openai/gpt-oss-20b';
    }
    return 'gpt-4o-mini';
};

export const callAiChat = async (ai, options) => {
    const primaryModel = options.model || getAiModel();
    const fallbackModel = getAiFallbackModel();

    try {
        return await ai.chat.completions.create({
            ...options,
            model: primaryModel
        });
    } catch (primaryErr) {
        console.warn(`[AI Service] Primary call failed with model "${primaryModel}":`, primaryErr.message);

        // If json_object was requested and failed, try primary without json_object
        if (options.response_format) {
            try {
                const { response_format, ...rest } = options;
                return await ai.chat.completions.create({
                    ...rest,
                    model: primaryModel
                });
            } catch (noFormatErr) {
                console.warn(`[AI Service] Primary call without response_format also failed:`, noFormatErr.message);
            }
        }

        // Try fallback model if available and different
        if (fallbackModel && fallbackModel !== primaryModel) {
            console.log(`[AI Service] Attempting fallback model: "${fallbackModel}"...`);
            try {
                return await ai.chat.completions.create({
                    ...options,
                    model: fallbackModel
                });
            } catch (fallbackErr) {
                if (options.response_format) {
                    const { response_format, ...rest } = options;
                    return await ai.chat.completions.create({
                        ...rest,
                        model: fallbackModel
                    });
                }
                throw fallbackErr;
            }
        }

        throw primaryErr;
    }
};

export const parseJSONResponse = (text) => {
    try {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
                return JSON.parse(jsonSlice);
            }
            throw new Error('No valid JSON object found in model response.');
        }
    } catch (e) {
        throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
    }
};

