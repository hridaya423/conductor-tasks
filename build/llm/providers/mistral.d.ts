import { LLMClient, LLMCompletionOptions, LLMCompletionResult } from '../types.js';
import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
export declare class MistralProvider implements LLMProvider {
    private client;
    private config;
    constructor(config: LLMProviderConfig);
    get name(): string;
    isAvailable(): boolean;
    generate(request: LLMRequest): Promise<LLMResponse>;
}
export declare class MistralClient implements LLMClient {
    private client;
    private model;
    private providerName;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    getProviderName(): string;
    getModelName(): string;
}
export declare const MixtralClient: typeof MistralClient;
export declare const MixtralProvider: typeof MistralProvider;
