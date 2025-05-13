import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
export declare class GeminiProvider implements LLMProvider {
    private client;
    private config;
    constructor(config: LLMProviderConfig);
    get name(): string;
    isAvailable(): boolean;
    generate(request: LLMRequest): Promise<LLMResponse>;
}
export declare class GeminiClient implements LLMClient {
    private client;
    private model;
    private maxRetries;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    getProviderName(): string;
    getModelName(): string;
}
