import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions } from '../types.js';
export declare class OllamaProvider implements LLMProvider {
    private config;
    private baseUrl;
    constructor(config: LLMProviderConfig);
    get name(): string;
    isAvailable(): boolean;
    generate(request: LLMRequest): Promise<LLMResponse>;
}
export declare class OllamaClient implements LLMClient {
    private baseUrl;
    private model;
    constructor(model?: string);
    complete(options: LLMCompletionOptions): Promise<string>;
    getProviderName(): string;
    getModelName(): string;
}
