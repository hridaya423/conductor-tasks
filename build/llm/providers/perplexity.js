import process from 'process';
import { OpenAI } from 'openai';
export class PerplexityProvider {
    constructor(config) {
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || process.env.PERPLEXITY_API_BASE_URL || 'https://api.perplexity.ai'
        });
    }
    get name() {
        return 'Perplexity AI';
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
            const response = await this.client.chat.completions.create({
                model: request.options?.model || this.config.model || 'llama-3-sonar-medium-32k-online',
                messages: messages,
                temperature: request.options?.temperature || this.config.temperature || 0.7,
                max_tokens: request.options?.maxTokens || this.config.maxTokens || 1024
            });
            return {
                text: response.choices[0].message.content || '',
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0
                }
            };
        }
        catch (error) {
            console.error('Perplexity API error:', error);
            throw new Error(`Perplexity API error: ${error}`);
        }
    }
}
export class PerplexityClient {
    constructor(model) {
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
            throw new Error('PERPLEXITY_API_KEY environment variable is required for Perplexity client');
        }
        this.client = new OpenAI({
            apiKey,
            baseURL: process.env.PERPLEXITY_API_BASE_URL || 'https://api.perplexity.ai'
        });
        this.model = model || process.env.PERPLEXITY_MODEL || 'llama-3-sonar-medium-32k-online';
    }
    async complete(options) {
        const { prompt, systemPrompt, maxTokens = 4000, temperature = 0.7, stream, onStreamUpdate } = options;
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
                const response = await this.client.chat.completions.create({
                    model: this.model,
                    messages,
                    temperature,
                    max_tokens: maxTokens,
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
                    messages,
                    temperature,
                    max_tokens: maxTokens
                });
                return response.choices[0].message.content || '';
            }
        }
        catch (error) {
            console.error('Perplexity API error:', error);
            return `Error: ${error}`;
        }
    }
    getProviderName() {
        return 'Perplexity AI';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=perplexity.js.map