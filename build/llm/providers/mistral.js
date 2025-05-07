import { Mistral } from '@mistralai/mistralai';
import process from 'process';
export class MistralProvider {
    constructor(config) {
        this.config = config;
        const apiKey = config.apiKey || process.env.MISTRAL_API_KEY || process.env.MIXTRAL_API_KEY;
        if (!apiKey) {
            throw new Error('API key is required for Mistral client');
        }
        const options = { apiKey };
        if (config.baseUrl || process.env.MISTRAL_API_BASE_URL) {
            options.endpoint = config.baseUrl || process.env.MISTRAL_API_BASE_URL;
        }
        this.client = new Mistral(options);
    }
    get name() {
        const model = this.config.model || '';
        if (model.toLowerCase().includes('mixtral')) {
            return 'Mixtral';
        }
        return 'Mistral AI';
    }
    isAvailable() {
        return !!this.config.apiKey || !!process.env.MISTRAL_API_KEY || !!process.env.MIXTRAL_API_KEY;
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
            const responseText = String(response.choices?.[0]?.message.content || '');
            return {
                text: responseText,
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
export class MistralClient {
    constructor(model) {
        const apiKey = process.env.MISTRAL_API_KEY || process.env.MIXTRAL_API_KEY;
        if (!apiKey) {
            throw new Error('MISTRAL_API_KEY or MIXTRAL_API_KEY environment variable is required for Mistral client');
        }
        const options = { apiKey };
        if (process.env.MISTRAL_API_BASE_URL) {
            options.endpoint = process.env.MISTRAL_API_BASE_URL;
        }
        this.client = new Mistral(options);
        if (model) {
            this.model = model;
        }
        else if (process.env.MISTRAL_MODEL) {
            this.model = process.env.MISTRAL_MODEL;
        }
        else if (process.env.MIXTRAL_MODEL) {
            this.model = process.env.MIXTRAL_MODEL;
        }
        else if (process.env.MODEL && (process.env.MODEL.includes('mistral') || process.env.MODEL.includes('mixtral'))) {
            this.model = process.env.MODEL;
        }
        else {
            this.model = 'mistral-large-latest';
        }
        if (this.model.toLowerCase().includes('mixtral')) {
            this.providerName = 'Mixtral';
        }
        else {
            this.providerName = 'Mistral AI';
        }
    }
    async complete(options) {
        const { prompt, systemPrompt, maxTokens = 4000, temperature = 0.7, topP, stream, onStreamUpdate } = options;
        try {
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });
            if (stream && onStreamUpdate) {
                const streamResponse = await this.client.chat.stream({
                    model: this.model,
                    messages: messages,
                    temperature: temperature,
                    maxTokens: maxTokens,
                    topP: topP
                });
                let fullResponse = '';
                for await (const chunk of streamResponse) {
                    const content = this.extractStreamContent(chunk);
                    if (content) {
                        fullResponse += content;
                        onStreamUpdate(content);
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
                return String(response.choices?.[0]?.message.content || 'No response from Mistral API');
            }
        }
        catch (error) {
            console.error('Mistral API error:', error);
            return `Error: ${error}`;
        }
    }
    extractStreamContent(chunk) {
        try {
            if (chunk.choices && chunk.choices[0]?.delta?.content) {
                return chunk.choices[0].delta.content;
            }
            if (chunk.delta && (typeof chunk.delta.text === 'string')) {
                return chunk.delta.text;
            }
            if (chunk.content) {
                return chunk.content;
            }
            if (chunk.message && chunk.message.content) {
                return chunk.message.content;
            }
            return '';
        }
        catch (e) {
            console.warn('Error extracting content from Mistral stream chunk:', e);
            return '';
        }
    }
    getProviderName() {
        return this.providerName;
    }
    getModelName() {
        return this.model;
    }
}
export const MixtralClient = MistralClient;
export const MixtralProvider = MistralProvider;
//# sourceMappingURL=mistral.js.map