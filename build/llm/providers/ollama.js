import process from 'process';
import fetch from 'node-fetch';
import { Readable } from 'stream';
export class OllamaProvider {
    constructor(config) {
        this.config = config;
        this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    }
    get name() {
        return 'Ollama';
    }
    isAvailable() {
        return true;
    }
    async generate(request) {
        try {
            const model = request.options?.model || this.config.model || 'llama3';
            const temperature = request.options?.temperature || this.config.temperature || 0.7;
            const maxTokens = request.options?.maxTokens || this.config.maxTokens || 1024;
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: request.prompt,
                    system: request.systemPrompt || '',
                    temperature: temperature,
                    max_tokens: maxTokens,
                }),
            });
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }
            const data = await response.json();
            const text = data.response || '';
            const promptTokens = Math.ceil(request.prompt.length / 4);
            const completionTokens = Math.ceil(text.length / 4);
            return {
                text,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                },
            };
        }
        catch (error) {
            console.error('Ollama API error:', error);
            throw new Error(`Ollama API error: ${error}`);
        }
    }
}
export class OllamaClient {
    constructor(model) {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = model || process.env.OLLAMA_MODEL || 'llama3';
    }
    async complete(options) {
        const { prompt, systemPrompt, maxTokens = 4000, temperature = 0.7, stream, onStreamUpdate, } = options;
        try {
            if (stream && onStreamUpdate) {
                const response = await fetch(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        prompt: prompt,
                        system: systemPrompt || '',
                        temperature: temperature,
                        max_tokens: maxTokens,
                        stream: true,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.statusText}`);
                }
                if (!response.body) {
                    throw new Error('Ollama API returned no response body');
                }
                const buffer = [];
                const stream = Readable.fromWeb(response.body);
                const decoder = new TextDecoder();
                let fullResponseText = '';
                let usage = null;
                for await (const chunk of stream) {
                    const lines = decoder.decode(chunk, { stream: true }).split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.response) {
                                fullResponseText += data.response;
                                onStreamUpdate(data.response);
                            }
                            if (data.done === true) {
                                if (typeof data.prompt_eval_count === 'number' && typeof data.eval_count === 'number') {
                                    usage = {
                                        promptTokens: data.prompt_eval_count,
                                        completionTokens: data.eval_count,
                                        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                                    };
                                }
                            }
                        }
                        catch (e) {
                            console.warn('Error parsing Ollama stream chunk:', line, e);
                        }
                    }
                }
                return {
                    text: fullResponseText,
                    usage: usage,
                    model: this.model,
                    finishReason: undefined,
                };
            }
            else {
                const response = await fetch(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        prompt: prompt,
                        system: systemPrompt || '',
                        temperature: temperature,
                        max_tokens: maxTokens,
                        stream: false,
                    }),
                });
                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`Ollama API error: ${response.statusText} - ${errorBody}`);
                }
                const data = await response.json();
                const text = data.response || '';
                const usage = (typeof data.prompt_eval_count === 'number' && typeof data.eval_count === 'number')
                    ? {
                        promptTokens: data.prompt_eval_count,
                        completionTokens: data.eval_count,
                        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                    }
                    : null;
                return {
                    text: text,
                    usage: usage,
                    model: this.model,
                    finishReason: undefined,
                };
            }
        }
        catch (error) {
            console.error('Ollama API error:', error);
            throw new Error(`Ollama API error: ${error.message || String(error)}`);
        }
    }
    getProviderName() {
        return 'Ollama';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=ollama.js.map