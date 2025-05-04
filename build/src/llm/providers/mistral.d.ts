import { LLMClient, LLMCompletionOptions } from '../types.js';
export declare class MistralClient implements LLMClient {
    private client;
    private model;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<string>;
    getProviderName(): string;
    getModelName(): string;
}
