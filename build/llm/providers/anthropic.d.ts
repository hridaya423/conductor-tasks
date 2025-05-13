import { LLMClient, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
export declare class AnthropicClient implements LLMClient {
    private client;
    private model;
    private maxRetries;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    getProviderName(): string;
    getModelName(): string;
}
