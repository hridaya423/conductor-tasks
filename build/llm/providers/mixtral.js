import { Mistral } from '@mistralai/mistralai';
import process from 'process';
export class MixtralProvider {
    constructor(config) {
        this.config = config;
        this.client = new Mistral({
            apiKey: config.apiKey
        });
    }
    get name() {
        return 'Mistral AI';
    }
    isAvailable() {
        return !!this.config.apiKey;
    }
    async generate(request) {
        try {
            const systemPrompt = request.systemPrompt || '';
            const userPrompt = request.prompt;
            const messages = [];
            if (systemPrompt) {
                messages.push({
                    role: 'system',
                    content: systemPrompt
                });
            }
            messages.push({
                role: 'user',
                content: userPrompt
            });
            const response = await this.client.chat.complete({
                model: request.options?.model || this.config.model || 'mistral-small-latest',
                messages: messages,
                temperature: request.options?.temperature || this.config.temperature || 0.7,
                maxTokens: request.options?.maxTokens || this.config.maxTokens || 1024
            });
            const content = response.choices?.[0]?.message?.content || '';
            return {
                text: typeof content === 'string' ? content : '',
                usage: {
                    promptTokens: response.usage?.promptTokens || 0,
                    completionTokens: response.usage?.completionTokens || 0,
                    totalTokens: response.usage?.totalTokens || 0
                }
            };
        }
        catch (error) {
            console.error('Mistral API error:', error);
            throw new Error(`Mistral API error: ${error}`);
        }
    }
}
export class MixtralClient {
    constructor(model) {
        const apiKey = process.env.MIXTRAL_API_KEY;
        if (!apiKey) {
            throw new Error('MIXTRAL_API_KEY environment variable is required for Mixtral client');
        }
        this.client = new Mistral({
            apiKey: apiKey
        });
        this.model = model || process.env.MODEL || 'mixtral-8x7b-32768';
    }
    async complete(options) {
        const { prompt, maxTokens = 4000, temperature = 0.7, topP, systemPrompt, stream, onStreamUpdate } = options;
        const messages = [];
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }
        messages.push({
            role: 'user',
            content: prompt
        });
        try {
            if (stream && onStreamUpdate) {
                const response = await this.client.chat.stream({
                    model: this.model,
                    messages: messages,
                    temperature: temperature,
                    maxTokens: maxTokens,
                    topP: topP
                });
                let fullResponse = '';
                for await (const chunk of response) {
                    const chunkAny = chunk;
                    if (chunkAny.delta && typeof chunkAny.delta === 'string') {
                        fullResponse += chunkAny.delta;
                        onStreamUpdate(chunkAny.delta);
                    }
                    else if (chunkAny.delta && typeof chunkAny.delta === 'object') {
                        const text = chunkAny.delta.text || chunkAny.delta.content || '';
                        if (text) {
                            fullResponse += text;
                            onStreamUpdate(text);
                        }
                    }
                }
                return fullResponse;
            }
            else {
                const response = await this.client.chat.complete({
                    model: this.model,
                    messages: messages,
                    temperature: temperature,
                    maxTokens: maxTokens,
                    topP: topP
                });
                let content = '';
                if (response && response.choices && response.choices.length > 0) {
                    const messageContent = response.choices[0].message.content;
                    content = typeof messageContent === 'string' ? messageContent : '';
                }
                return content || '';
            }
        }
        catch (error) {
            console.error('Mixtral API error:', error);
            return `Error: ${error}`;
        }
    }
    getProviderName() {
        return 'Mixtral';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=mixtral.js.map