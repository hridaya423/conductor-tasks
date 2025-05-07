import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions } from '../types.js';
export declare class PerplexityProvider implements LLMProvider {
    private client;
    private config;
    constructor(config: LLMProviderConfig);
    get name(): string;
    isAvailable(): boolean;
    generate(request: LLMRequest): Promise<LLMResponse>;
}
export declare class PerplexityClient implements LLMClient {
    private client;
    private model;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<string>;
    getProviderName(): string;
    getModelName(): string;
}
