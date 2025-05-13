import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
export declare class XAIProvider implements LLMProvider {
    private config;
    constructor(config: LLMProviderConfig);
    get name(): string;
    isAvailable(): boolean;
    generate(request: LLMRequest): Promise<LLMResponse>;
}
export declare class XaiClient implements LLMClient {
    private client;
    private model;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    getProviderName(): string;
    getModelName(): string;
}
