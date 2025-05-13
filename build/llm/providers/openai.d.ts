import { LLMClient, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
export declare class OpenAIClient implements LLMClient {
    private client;
    private model;
    private maxRetries;
    private apiKey?;
    private baseURL?;
    constructor(model?: string, apiKey?: string, baseURL?: string);
    complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    getProviderName(): string;
    getModelName(): string;
}
