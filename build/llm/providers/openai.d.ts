import { LLMClient, LLMCompletionOptions } from '../types.js';
export declare class OpenAIClient implements LLMClient {
    private client;
    private model;
    private maxRetries;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<string>;
    getProviderName(): string;
    getModelName(): string;
}
