import { AnthropicClient } from './providers/anthropic.js';
import { OpenAIClient } from './providers/openai.js';
import { GroqClient } from './providers/groq.js';
import { MistralClient } from './providers/mistral.js';
import { GeminiClient } from './providers/gemini.js';
import { XaiClient } from './providers/xai.js';
import { MistralProvider } from './providers/mistral.js';
import { OllamaClient } from './providers/ollama.js';
import { PerplexityClient } from './providers/perplexity.js';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../core/errorHandler.js';
import { refinePrompt } from '../core/promptRefinementService.js';
const errorHandler = ErrorHandler.getInstance();
const PROVIDER_DEFAULTS = {
    anthropic: {
        model: 'claude-3.7-sonnet-20240607',
        temperature: 0.7,
        maxTokens: 4000
    },
    openai: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4000
    },
    groq: {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        maxTokens: 4000
    },
    mistral: {
        model: 'mistral-large-latest',
        temperature: 0.7,
        maxTokens: 4000
    },
    gemini: {
        model: 'gemini-1.5-pro-latest',
        temperature: 0.7,
        maxTokens: 4000
    },
    xai: {
        model: 'grok-1',
        temperature: 0.7,
        maxTokens: 4000
    },
    mixtral: {
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
        maxTokens: 4000
    },
    ollama: {
        model: 'llama3',
        temperature: 0.7,
        maxTokens: 4000
    },
    perplexity: {
        model: 'llama-3-sonar-medium-32k-online',
        temperature: 0.7,
        maxTokens: 4000
    }
};
const FALLBACK_ORDER = [
    'anthropic',
    'gemini',
    'openai',
    'groq',
    'mistral',
    'mixtral',
    'ollama',
    'perplexity',
    'xai'
];
export class LLMManager {
    constructor() {
        this.providers = new Map();
        this.defaultProvider = 'anthropic';
        this.globalConfig = {};
        this.maxRetries = 3;
        this.maxProviderAttempts = 3;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitMap = new Map();
        this.initializeProviders();
        this.loadConfiguration();
        if (process.env.LLM_MAX_RETRIES) {
            this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES, 10);
        }
        if (process.env.LLM_MAX_PROVIDER_ATTEMPTS) {
            this.maxProviderAttempts = parseInt(process.env.LLM_MAX_PROVIDER_ATTEMPTS, 10);
        }
    }
    loadConfiguration() {
        this.globalConfig = {
            temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : undefined,
            maxTokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS, 10) : undefined,
            topP: process.env.TOP_P ? parseFloat(process.env.TOP_P) : undefined,
            frequencyPenalty: process.env.FREQUENCY_PENALTY ? parseFloat(process.env.FREQUENCY_PENALTY) : undefined,
            presencePenalty: process.env.PRESENCE_PENALTY ? parseFloat(process.env.PRESENCE_PENALTY) : undefined
        };
        Object.keys(this.globalConfig).forEach(key => {
            const configKey = key;
            if (this.globalConfig[configKey] === undefined) {
                delete this.globalConfig[configKey];
            }
        });
        this.maxRetries = process.env.LLM_MAX_RETRIES
            ? Math.min(Math.max(parseInt(process.env.LLM_MAX_RETRIES, 10), 0), 10)
            : 3;
        this.maxProviderAttempts = process.env.LLM_MAX_PROVIDER_ATTEMPTS
            ? Math.min(Math.max(parseInt(process.env.LLM_MAX_PROVIDER_ATTEMPTS, 10), 1), 5)
            : 3;
        if (process.env.DEFAULT_LLM_PROVIDER) {
            const providerName = process.env.DEFAULT_LLM_PROVIDER.toLowerCase();
            if (this.providers.has(providerName)) {
                this.defaultProvider = providerName;
            }
            else {
                console.warn(`WARNING: Specified default LLM provider "${providerName}" is not available. Using fallback providers: ${FALLBACK_ORDER.join(', ')}`);
            }
        }
        if (!this.defaultProvider || !this.providers.has(this.defaultProvider)) {
            for (const provider of FALLBACK_ORDER) {
                if (this.providers.has(provider)) {
                    this.defaultProvider = provider;
                    break;
                }
            }
            if (!this.defaultProvider) {
                console.error("ERROR: No LLM providers available. Make sure at least one provider is configured.");
            }
        }
    }
    initializeProviders() {
        try {
            this.providers.clear();
            const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
            if (anthropicKey) {
                const client = new AnthropicClient();
                this.providers.set('anthropic', { client });
            }
            const openaiKey = process.env.OPENAI_API_KEY;
            if (openaiKey) {
                const client = new OpenAIClient();
                this.providers.set('openai', { client });
            }
            const groqKey = process.env.GROQ_API_KEY;
            if (groqKey) {
                const client = new GroqClient();
                this.providers.set('groq', { client });
            }
            const mistralKey = process.env.MISTRAL_API_KEY;
            if (mistralKey) {
                const client = new MistralClient();
                this.providers.set('mistral', { client });
            }
            const mixtralKey = process.env.MIXTRAL_API_KEY;
            if (mixtralKey) {
                const provider = new MistralProvider({
                    apiKey: mixtralKey,
                    model: PROVIDER_DEFAULTS.mixtral.model,
                    temperature: PROVIDER_DEFAULTS.mixtral.temperature,
                    maxTokens: PROVIDER_DEFAULTS.mixtral.maxTokens
                });
                this.providers.set('mixtral', { generate: (req) => provider.generate(req) });
            }
            const geminiKey = process.env.GEMINI_API_KEY;
            if (geminiKey) {
                const client = new GeminiClient();
                this.providers.set('gemini', { client });
            }
            const xaiKey = process.env.XAI_API_KEY;
            if (xaiKey) {
                const client = new XaiClient();
                this.providers.set('xai', { client });
            }
            if (process.env.OLLAMA_ENABLED === 'true' || process.env.OLLAMA_API_KEY) {
                try {
                    const client = new OllamaClient();
                    this.providers.set('ollama', { client });
                }
                catch (error) {
                    console.warn(`Warning: Failed to initialize Ollama provider: ${error}`);
                }
            }
            const perplexityKey = process.env.PERPLEXITY_API_KEY;
            if (perplexityKey) {
                try {
                    const client = new PerplexityClient();
                    this.providers.set('perplexity', { client });
                }
                catch (error) {
                    console.warn(`Warning: Failed to initialize Perplexity provider: ${error}`);
                }
            }
            if (this.providers.size > 0 && !this.providers.has(this.defaultProvider)) {
                this.defaultProvider = Array.from(this.providers.keys())[0];
            }
        }
        catch (error) {
            errorHandler.handleError(new TaskError(`Error initializing LLM providers: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'initializeProviders' }, error instanceof Error ? error : undefined));
        }
    }
    getDefaultProvider() {
        return this.defaultProvider;
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    hasAvailableProviders() {
        return this.providers.size > 0;
    }
    getPriorityProviderList(preferredProvider) {
        const availableProviders = this.getAvailableProviders();
        if (availableProviders.length === 0) {
            return [];
        }
        const priorityList = [];
        if (preferredProvider && this.providers.has(preferredProvider)) {
            priorityList.push(preferredProvider);
        }
        else if (this.providers.has(this.defaultProvider)) {
            priorityList.push(this.defaultProvider);
        }
        for (const provider of FALLBACK_ORDER) {
            if (this.providers.has(provider) &&
                !priorityList.includes(provider) &&
                !this.isProviderRateLimited(provider)) {
                priorityList.push(provider);
            }
        }
        for (const provider of availableProviders) {
            if (!priorityList.includes(provider) && !this.isProviderRateLimited(provider)) {
                priorityList.push(provider);
            }
        }
        for (const provider of availableProviders) {
            if (!priorityList.includes(provider)) {
                priorityList.push(provider);
            }
        }
        return priorityList;
    }
    isProviderRateLimited(provider) {
        const limitUntil = this.rateLimitMap.get(provider) || 0;
        return Date.now() < limitUntil;
    }
    markProviderRateLimited(provider, durationMs = 60000) {
        this.rateLimitMap.set(provider, Date.now() + durationMs);
        errorHandler.handleError(new TaskError(`Provider ${provider} marked as rate limited for ${durationMs}ms`, ErrorCategory.LLM, ErrorSeverity.WARNING, { operation: 'markProviderRateLimited', additionalInfo: { provider, durationMs } }), true);
    }
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0)
            return;
        this.isProcessingQueue = true;
        try {
            const item = this.requestQueue.shift();
            if (!item) {
                this.isProcessingQueue = false;
                return;
            }
            const { request, resolve, reject } = item;
            try {
                const result = await this.executeRequest(request, request.provider);
                resolve(result);
            }
            catch (error) {
                reject(error);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            this.isProcessingQueue = false;
            if (this.requestQueue.length > 0) {
                this.processQueue();
            }
        }
        catch (error) {
            this.isProcessingQueue = false;
            errorHandler.handleError(new TaskError(`Error processing request queue: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'processQueue' }, error instanceof Error ? error : undefined));
            if (this.requestQueue.length > 0) {
                this.processQueue();
            }
        }
    }
    async executeRequest(request, preferredProvider) {
        const providerList = this.getPriorityProviderList(preferredProvider);
        if (providerList.length === 0) {
            throw new TaskError('No LLM providers available. Please configure at least one provider API key.', ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'executeRequest' });
        }
        let lastError = null;
        for (const providerName of providerList) {
            let retryCount = 0;
            let lastProviderError = null;
            while (retryCount < this.maxRetries) {
                try {
                    if (retryCount > 0) {
                        const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                    }
                    const providerObj = this.providers.get(providerName);
                    if (!providerObj) {
                        throw new Error(`Provider ${providerName} not found`);
                    }
                    let result;
                    if (providerObj.generate) {
                        result = await providerObj.generate(request);
                    }
                    else if (providerObj.client) {
                        const client = providerObj.client;
                        const text = await client.complete({
                            prompt: request.prompt,
                            systemPrompt: request.systemPrompt,
                            temperature: request.options?.temperature || this.globalConfig.temperature,
                            maxTokens: request.options?.maxTokens || this.globalConfig.maxTokens,
                            topP: request.options?.topP || this.globalConfig.topP,
                            presencePenalty: request.options?.presencePenalty || this.globalConfig.presencePenalty,
                            frequencyPenalty: request.options?.frequencyPenalty || this.globalConfig.frequencyPenalty
                        });
                        result = {
                            text,
                            usage: {
                                promptTokens: 0,
                                completionTokens: 0,
                                totalTokens: 0
                            }
                        };
                    }
                    else {
                        throw new Error(`Provider ${providerName} has no valid interface`);
                    }
                    return result;
                }
                catch (error) {
                    lastProviderError = error instanceof Error ? error : new Error(String(error));
                    lastError = lastProviderError;
                    const isRateLimit = lastProviderError.message.includes('rate') ||
                        lastProviderError.message.includes('limit') ||
                        lastProviderError.message.includes('429');
                    if (isRateLimit) {
                        this.markProviderRateLimited(providerName);
                        break;
                    }
                    const isRetryable = lastProviderError.message.includes('network') ||
                        lastProviderError.message.includes('timeout') ||
                        lastProviderError.message.includes('connection') ||
                        lastProviderError.message.includes('temporary');
                    if (isRetryable) {
                        retryCount++;
                        errorHandler.handleError(new TaskError(`Error with ${providerName} (retry ${retryCount}/${this.maxRetries}): ${lastProviderError.message}`, ErrorCategory.LLM, ErrorSeverity.WARNING, {
                            operation: 'executeRequest',
                            additionalInfo: {
                                provider: providerName,
                                retry: retryCount
                            }
                        }, lastProviderError), true);
                        continue;
                    }
                    break;
                }
            }
            if (lastProviderError) {
                errorHandler.handleError(new TaskError(`Failed with provider ${providerName} after ${retryCount} retries, trying next provider`, ErrorCategory.LLM, ErrorSeverity.WARNING, {
                    operation: 'executeRequest',
                    additionalInfo: {
                        provider: providerName,
                        retries: retryCount,
                        nextProviderAttempt: providerList.indexOf(providerName) + 1
                    }
                }, lastProviderError), true);
            }
        }
        throw new TaskError(`All LLM providers failed. Last error: ${lastError?.message || 'Unknown error'}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'executeRequest' }, lastError || undefined);
    }
    async sendRequest(request, providerName) {
        if (this.providers.size === 0) {
            throw new TaskError('No LLM providers available. Please configure at least one provider API key.', ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'sendRequest' });
        }
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                request: { ...request, provider: providerName },
                resolve,
                reject
            });
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }
    async refinePrompt(originalPrompt, failedResponse, desiredSpecification) {
        return refinePrompt(this, originalPrompt, failedResponse, desiredSpecification);
    }
}
//# sourceMappingURL=llmManager.js.map