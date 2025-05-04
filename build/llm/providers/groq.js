import Groq from 'groq-sdk';
import process from 'process';
export class GroqProvider {
    constructor(config) {
        this.config = config;
        this.client = new Groq({
            apiKey: config.apiKey,
        });
    }
    get name() {
        return 'Groq';
    }
    isAvailable() {
        return !!this.config.apiKey;
    }
    async generate(request) {
        try {
            const messages = [];
            if (request.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: request.systemPrompt
                });
            }
            messages.push({
                role: 'user',
                content: request.prompt
            });
            const response = await this.client.chat.completions.create({
                model: request.options?.model || this.config.model,
                messages,
                temperature: request.options?.temperature || this.config.temperature || 0.7,
                max_tokens: request.options?.maxTokens || this.config.maxTokens,
            });
            return {
                text: response.choices[0]?.message?.content || '',
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0
                }
            };
        }
        catch (error) {
            console.error('Groq API error:', error);
            throw new Error(`Groq API error: ${error}`);
        }
    }
}
export class GroqClient {
    constructor(model) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY environment variable is required for Groq client');
        }
        this.client = new Groq({
            apiKey: apiKey
        });
        this.model = model || process.env.MODEL || 'llama3-70b-8192';
    }
    async complete(options) {
        const { prompt, maxTokens = 4000, temperature = 0.7, topP, systemPrompt, stream, onStreamUpdate } = options;
        try {
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });
            if (stream && onStreamUpdate) {
                const response = await this.client.chat.completions.create({
                    model: this.model,
                    messages: messages,
                    max_tokens: maxTokens,
                    temperature: temperature,
                    top_p: topP,
                    stream: true
                });
                let fullResponse = '';
                for await (const chunk of response) {
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
                    messages: messages,
                    max_tokens: maxTokens,
                    temperature: temperature,
                    top_p: topP
                });
                return response.choices[0]?.message?.content || '';
            }
        }
        catch (error) {
            console.error('Groq API error:', error);
            return `Error: ${error}`;
        }
    }
    getProviderName() {
        return 'Groq';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=groq.js.map