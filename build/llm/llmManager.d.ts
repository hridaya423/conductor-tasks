import { LLMRequest, LLMResponse, LLMModelDefaults } from '../core/types.js';
export declare class LLMManager {
    private providers;
    private defaultProvider;
    private globalConfig;
    private maxRetries;
    private maxProviderAttempts;
    private requestQueue;
    private activeRequests;
    private maxConcurrentRequests;
    private rateLimitMap;
    private providerRateLimitDurations;
    private baseRateLimitDurationMs;
    private maxRateLimitDurationMs;
    private taskToProviderMap;
    constructor();
    private loadConfiguration;
    private initializeProviders;
    getDefaultProvider(): string;
    getAvailableProviders(): string[];
    getProviderDefaults(providerName: string): LLMModelDefaults | undefined;
    hasAvailableProviders(): boolean;
    private getPriorityProviderList;
    private isProviderRateLimited;
    private markProviderRateLimited;
    private processQueue;
    private executeRequestInternal;
    private loadTaskProviderMappings;
    /**
     * Get the appropriate provider for a given task
     * @param taskName The name of the task/command
     * @returns The provider name to use for this task
     */
    getProviderForTask(taskName: string): string;
    sendRequest(request: LLMRequest, providerName?: string): Promise<LLMResponse>;
    refinePrompt(originalPrompt: string, failedResponse: string, desiredSpecification: string): Promise<string>;
}
