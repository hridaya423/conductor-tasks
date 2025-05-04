import OpenAI from 'openai';
import process from 'process';
export class XAIProvider {
    constructor(config) {
        this.config = config;
    }
    get name() {
        return 'XAI';
    }
    isAvailable() {
        return !!this.config.apiKey;
    }
    async generate(request) {
        try {
            console.log('XAI API called with:', {
                model: request.options?.model || this.config.model,
                prompt: request.prompt,
                systemPrompt: request.systemPrompt || '',
                temperature: request.options?.temperature || this.config.temperature || 0.7,
                maxTokens: request.options?.maxTokens || this.config.maxTokens || 1024
            });
            return {
                text: `[XAI API placeholder] Response to: ${request.prompt.substring(0, 50)}...`,
                usage: {
                    promptTokens: request.prompt.length / 4,
                    completionTokens: 100,
                    totalTokens: (request.prompt.length / 4) + 100
                }
            };
        }
        catch (error) {
            console.error('XAI API error:', error);
            throw new Error(`XAI API error: ${error}`);
        }
    }
}
export class XaiClient {
    constructor(model) {
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            throw new Error('XAI_API_KEY environment variable is required for xAI client');
        }
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: 'https://api.xai.com/v1'
        });
        this.model = model || process.env.MODEL || 'grok-1';
    }
    async complete(options) {
        const { prompt, maxTokens = 4000, temperature = 0.7, topP, stream, onStreamUpdate } = options;
        if (stream && onStreamUpdate) {
            const stream = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: temperature,
                top_p: topP,
                stream: true
            });
            let fullResponse = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    onStreamUpdate(content);
                }
            }
            return fullResponse;
        }
        else {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: temperature,
                top_p: topP
            });
            return response.choices[0]?.message?.content || '';
        }
    }
    getProviderName() {
        return 'xAI';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=xai.js.map