import { getAiClient, getAiModel, callAiChat } from './services/aiService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    const ai = getAiClient();
    console.log('AI Client configured:', !!ai);
    console.log('AI Model:', getAiModel());

    try {
        const response = await callAiChat(ai, {
            messages: [{ role: 'system', content: 'Say hello in 3 words' }]
        });
        console.log('PRIMARY OK:', response.choices[0].message.content);
    } catch (err) {
        console.error('PRIMARY FAILED:', err.status, err.message);
    }
}

test();
