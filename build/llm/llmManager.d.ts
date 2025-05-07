import { LLMRequest, LLMResponse } from '../core/types.js';
export declare class LLMManager {
    private providers;
    private defaultProvider;
    private globalConfig;
    private maxRetries;
    private maxProviderAttempts;
    private requestQueue;
    private isProcessingQueue;
    private rateLimitMap;
    constructor();
    private loadConfiguration;
    private initializeProviders;
    getDefaultProvider(): string;
    getAvailableProviders(): string[];
    hasAvailableProviders(): boolean;
    private getPriorityProviderList;
    private isProviderRateLimited;
    private markProviderRateLimited;
    private processQueue;
    private executeRequest;
    sendRequest(request: LLMRequest, providerName?: string): Promise<LLMResponse>;
    refinePrompt(originalPrompt: string, failedResponse: string, desiredSpecification: string): Promise<string>;
}
