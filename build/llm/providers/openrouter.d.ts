import { LLMClient, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
export declare class OpenRouterClient implements LLMClient {
    private client;
    private model;
    private maxRetries;
    private apiKey?;
    private baseURL;
    constructor(model?: string, apiKey?: string);
    complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    getProviderName(): string;
    getModelName(): string;
}
