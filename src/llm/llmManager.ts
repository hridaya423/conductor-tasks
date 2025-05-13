import { LLMProvider, LLMRequest, LLMResponse, LLMProviderConfig, LLMModelDefaults } from '../core/types.js';
import { AnthropicClient } from './providers/anthropic.js';
import { OpenAIClient } from './providers/openai.js';
import { GroqClient } from './providers/groq.js';
import { MistralClient } from './providers/mistral.js';
import { GeminiClient } from './providers/gemini.js';
import { XaiClient } from './providers/xai.js';
import { MistralProvider } from './providers/mistral.js';
import { OllamaClient } from './providers/ollama.js';
import { PerplexityClient } from './providers/perplexity.js';
import { OpenRouterClient } from './providers/openrouter.js';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../core/errorHandler.js';
import { refinePrompt } from '../core/promptRefinementService.js';

const errorHandler = ErrorHandler.getInstance();

const PROVIDER_DEFAULTS: { [key: string]: LLMModelDefaults } = {
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
    model: 'deepseek-r1-distill-llama-70b',
    temperature: 0.7,
    maxTokens: 4000
  },
  mistral: {
    model: 'mistral-large-latest',
    temperature: 0.7,
    maxTokens: 4000
  },
  gemini: {
    model: 'gemini-2.5-pro-exp-03-25',
    temperature: 0.7,
    maxTokens: 4000
  },
  xai: {
    model: 'grok-3',
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
  },
  openrouter: { 
    model: 'mistralai/mistral-7b-instruct', 
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
  'openrouter', 
  'xai'
];

export class LLMManager {
  private providers: Map<string, any> = new Map();
  private defaultProvider: string = 'anthropic';
  private globalConfig: Partial<LLMProviderConfig> = {};
  private maxRetries: number = 3;
  private maxProviderAttempts: number = 3;
  private requestQueue: Array<{
    request: LLMRequest, 
    resolve: (value: LLMResponse | PromiseLike<LLMResponse>) => void, 
    reject: (reason?: any) => void 
  }> = [];
  
  private activeRequests: number = 0;
  private maxConcurrentRequests: number = 5; 
  private rateLimitMap: Map<string, number> = new Map();
  private providerRateLimitDurations: Map<string, number> = new Map(); 
  private baseRateLimitDurationMs: number = 60000; 
  private maxRateLimitDurationMs: number = 5 * 60000; 
  
  // Task-to-provider mapping
  private taskToProviderMap: Map<string, string> = new Map();

  constructor() {
    this.initializeProviders();
    this.loadConfiguration();
    this.loadTaskProviderMappings();

    if (process.env.LLM_MAX_RETRIES) {
      this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES, 10);
    }

    if (process.env.LLM_MAX_PROVIDER_ATTEMPTS) {
      this.maxProviderAttempts = parseInt(process.env.LLM_MAX_PROVIDER_ATTEMPTS, 10);
    }
    if (process.env.LLM_MAX_CONCURRENT_REQUESTS) {
      this.maxConcurrentRequests = parseInt(process.env.LLM_MAX_CONCURRENT_REQUESTS, 10);
    }
    if (process.env.LLM_BASE_RATE_LIMIT_DURATION_MS) {
      this.baseRateLimitDurationMs = parseInt(process.env.LLM_BASE_RATE_LIMIT_DURATION_MS, 10);
    }
    if (process.env.LLM_MAX_RATE_LIMIT_DURATION_MS) {
      this.maxRateLimitDurationMs = parseInt(process.env.LLM_MAX_RATE_LIMIT_DURATION_MS, 10);
    }
  }

  private loadConfiguration() {
    this.globalConfig = {
      temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : undefined,
      maxTokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS, 10) : undefined,
      topP: process.env.TOP_P ? parseFloat(process.env.TOP_P) : undefined,
      frequencyPenalty: process.env.FREQUENCY_PENALTY ? parseFloat(process.env.FREQUENCY_PENALTY) : undefined,
      presencePenalty: process.env.PRESENCE_PENALTY ? parseFloat(process.env.PRESENCE_PENALTY) : undefined
    };

    Object.keys(this.globalConfig).forEach(key => {
      const configKey = key as keyof LLMProviderConfig;
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

    this.maxConcurrentRequests = process.env.LLM_MAX_CONCURRENT_REQUESTS
      ? Math.min(Math.max(parseInt(process.env.LLM_MAX_CONCURRENT_REQUESTS, 10), 1), 20) 
      : 5;

    if (process.env.DEFAULT_LLM_PROVIDER) {
      const providerName = process.env.DEFAULT_LLM_PROVIDER.toLowerCase();
      if (this.providers.has(providerName)) {
        this.defaultProvider = providerName;
      } else {
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

  private initializeProviders() {
    try {
      this.providers.clear();

      const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
      if (anthropicKey) {
        const client = new AnthropicClient(PROVIDER_DEFAULTS.anthropic?.model);
        this.providers.set('anthropic', { client });
      }

      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const openaiBaseURL = process.env.OPENAI_API_BASE_URL || process.env.LLM_PROVIDER_OPENAI_BASE_URL;
        
        
        
        const client = new OpenAIClient(undefined, openaiKey, openaiBaseURL);
        this.providers.set('openai', { client });
      }

      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        const client = new GroqClient(PROVIDER_DEFAULTS.groq?.model);
        this.providers.set('groq', { client });
      }

      const mistralKey = process.env.MISTRAL_API_KEY;
      if (mistralKey) {
        const client = new MistralClient(PROVIDER_DEFAULTS.mistral?.model);
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
        this.providers.set('mixtral', { generate: (req: LLMRequest) => provider.generate(req) });
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const client = new GeminiClient(PROVIDER_DEFAULTS.gemini?.model);
        this.providers.set('gemini', { client });
      }

      const xaiKey = process.env.XAI_API_KEY;
      if (xaiKey) {
        const client = new XaiClient(PROVIDER_DEFAULTS.xai?.model);
        this.providers.set('xai', { client });
      }
      
      if (process.env.OLLAMA_ENABLED === 'true' || process.env.OLLAMA_API_KEY) {
        try {
          const client = new OllamaClient(PROVIDER_DEFAULTS.ollama?.model);
          this.providers.set('ollama', { client });
        } catch (error) {
          console.warn(`Warning: Failed to initialize Ollama provider: ${error}`);
        }
      }
      
      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      if (perplexityKey) {
        try {
          const client = new PerplexityClient(PROVIDER_DEFAULTS.perplexity?.model);
          this.providers.set('perplexity', { client });
        } catch (error) {
          console.warn(`Warning: Failed to initialize Perplexity provider: ${error}`);
        }
      }

      const openrouterKey = process.env.OPENROUTER_API_KEY;
      if (openrouterKey) {
        try {
          
          
          const client = new OpenRouterClient(undefined, openrouterKey);
          this.providers.set('openrouter', { client });
        } catch (error) {
          console.warn(`Warning: Failed to initialize OpenRouter provider: ${error}`);
        }
      }

      if (this.providers.size > 0 && !this.providers.has(this.defaultProvider)) {
        this.defaultProvider = Array.from(this.providers.keys())[0];
      }
    } catch (error) {
      errorHandler.handleError(new TaskError(
        `Error initializing LLM providers: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCategory.LLM,
        ErrorSeverity.ERROR,
        { operation: 'initializeProviders' },
        error instanceof Error ? error : undefined
      ));
    }
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  public getProviderDefaults(providerName: string): LLMModelDefaults | undefined {
    const lowerProviderName = providerName.toLowerCase();
    if (lowerProviderName in PROVIDER_DEFAULTS) {
      return PROVIDER_DEFAULTS[lowerProviderName];
    }
    return undefined;
  }

  hasAvailableProviders(): boolean {
    return this.providers.size > 0;
  }

  private getPriorityProviderList(preferredProvider?: string): string[] {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) return [];

    const nonRateLimitedProviders = availableProviders.filter(p => !this.isProviderRateLimited(p));

    if (nonRateLimitedProviders.length === 0) {
      
      return [];
    }

    const priorityList: string[] = [];

    if (preferredProvider && nonRateLimitedProviders.includes(preferredProvider)) {
      priorityList.push(preferredProvider);
    }

    const defaultProviderInList = this.providers.has(this.defaultProvider) && nonRateLimitedProviders.includes(this.defaultProvider) ? this.defaultProvider : null;
    if (defaultProviderInList && !priorityList.includes(defaultProviderInList)) {
      priorityList.push(defaultProviderInList);
    }

    for (const provider of FALLBACK_ORDER) {
      if (nonRateLimitedProviders.includes(provider) && !priorityList.includes(provider)) {
        priorityList.push(provider);
      }
    }

    
    for (const provider of nonRateLimitedProviders) {
      if (!priorityList.includes(provider)) {
        priorityList.push(provider);
      }
    }
    return priorityList;
  }

  private isProviderRateLimited(provider: string): boolean {
    const limitUntil = this.rateLimitMap.get(provider) || 0;
    return Date.now() < limitUntil;
  }

  private markProviderRateLimited(provider: string, durationMs?: number): void {
    let currentDuration = durationMs;
    if (currentDuration === undefined) { 
        
        const previousBackoffDuration = this.providerRateLimitDurations.get(provider) || this.baseRateLimitDurationMs / 2;
        currentDuration = Math.min(previousBackoffDuration * 2, this.maxRateLimitDurationMs);
    }
    
    currentDuration = Math.max(currentDuration, this.baseRateLimitDurationMs);


    this.rateLimitMap.set(provider, Date.now() + currentDuration);
    this.providerRateLimitDurations.set(provider, currentDuration); 

    errorHandler.handleError(
        new TaskError(
            `Provider ${provider} marked as rate limited for ${currentDuration / 1000}s.`,
            ErrorCategory.LLM,
            ErrorSeverity.WARNING,
            { operation: 'markProviderRateLimited', additionalInfo: { provider, durationMs: currentDuration } }
        ),
        true
    );
  }

  private async processQueue(): Promise<void> {
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
        const item = this.requestQueue.shift();
        if (!item) continue;

        this.activeRequests++;
        const { request, resolve, reject } = item;

        this.executeRequestInternal(request, request.provider)
            .then(resolve)
            .catch(reject) 
            .finally(() => {
                this.activeRequests--;
                
                
                setTimeout(() => this.processQueue(), 0);
            });
    }
  }

  
  private async executeRequestInternal(request: LLMRequest, preferredProvider?: string): Promise<LLMResponse> {
    const providerList = this.getPriorityProviderList(preferredProvider);

    if (providerList.length === 0) {
      throw new TaskError(
        'No LLM providers currently available (all may be rate-limited or unconfigured).',
        ErrorCategory.LLM,
        ErrorSeverity.WARNING, 
        { operation: 'executeRequestInternal.noProviders' }
      );
    }

    let lastError: Error | null = null;

    for (const providerName of providerList) {
      let retryCount = 0;
      let lastProviderError: Error | null = null;

      while (retryCount < this.maxRetries) {
        try {
          if (retryCount > 0) {
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); 
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }

          const providerObj = this.providers.get(providerName);
          if (!providerObj) throw new Error(`Provider ${providerName} not found`);

          let result: LLMResponse;
          if (providerObj.generate) {
            result = await providerObj.generate(request);
          } else if (providerObj.client) {
            const client = providerObj.client;
            const clientCompletionResult = await client.complete({
              prompt: request.prompt,
              systemPrompt: request.systemPrompt,
              temperature: request.options?.temperature ?? this.globalConfig.temperature,
              maxTokens: request.options?.maxTokens ?? this.globalConfig.maxTokens,
              topP: request.options?.topP ?? this.globalConfig.topP,
              presencePenalty: request.options?.presencePenalty ?? this.globalConfig.presencePenalty,
              frequencyPenalty: request.options?.frequencyPenalty ?? this.globalConfig.frequencyPenalty,
            });
            result = {
              text: clientCompletionResult.text,
              usage: clientCompletionResult.usage 
                ? { ...clientCompletionResult.usage }
                : { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
            };
          } else {
            throw new Error(`Provider ${providerName} has no valid interface`);
          }
          
          this.providerRateLimitDurations.delete(providerName); 
          return result;

        } catch (error) {
          lastProviderError = error instanceof Error ? error : new Error(String(error));
          lastError = lastProviderError;

          const errorMessageLower = lastProviderError.message.toLowerCase();
          const isRateLimit = 
            errorMessageLower.includes('rate') || 
            errorMessageLower.includes('limit') ||
            errorMessageLower.includes('429'); 

          if (isRateLimit) {
            
            
            this.markProviderRateLimited(providerName); 
            break; 
          }

          const isRetryable = 
            errorMessageLower.includes('network') || 
            errorMessageLower.includes('timeout') ||
            errorMessageLower.includes('connection') ||
            errorMessageLower.includes('server error') || 
            errorMessageLower.includes('temporary');

          if (isRetryable) {
            retryCount++;
            errorHandler.handleError(
              new TaskError(
                `Retryable error with ${providerName} (retry ${retryCount}/${this.maxRetries}): ${lastProviderError.message}`,
                ErrorCategory.LLM, ErrorSeverity.WARNING,
                { operation: 'executeRequestInternal', additionalInfo: { provider: providerName, retry: retryCount }},
                lastProviderError
              ), true);
            if (retryCount >= this.maxRetries) break; 
            continue; 
          }
          
          
          break; 
        }
      } 

      if (lastProviderError) {
        errorHandler.handleError(
          new TaskError(
            `Failed with provider ${providerName} after ${retryCount} retries. Last error: ${lastProviderError.message}`,
            ErrorCategory.LLM, ErrorSeverity.WARNING,
            { operation: 'executeRequestInternal', additionalInfo: { provider: providerName, retries: retryCount }},
            lastProviderError
          ), true);
      }
    } 

    throw new TaskError(
      `All LLM providers failed or were skipped. Last error: ${lastError?.message || 'Unknown error'}`,
      ErrorCategory.LLM, ErrorSeverity.ERROR,
      { operation: 'executeRequestInternal.allFailed' },
      lastError || undefined
    );
  }

  private loadTaskProviderMappings() {
    // Parse task-to-provider mappings from environment variables
    // Format: PROVIDER_TASKS="task1, task2, task3"
    // For example: ANTHROPIC_TASKS="initialize-project, parse-prd"
    
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      console.warn("No available LLM providers found. Task-to-provider mapping cannot be established.");
      return;
    }
    
    // Clear existing mappings
    this.taskToProviderMap.clear();
    
    // Log that we're loading task provider mappings
    console.log("Loading task-to-provider mappings from environment variables...");
    
    // Loop through all available providers to find corresponding PROVIDER_TASKS variables
    for (const provider of availableProviders) {
      const envVarName = `${provider.toUpperCase()}_TASKS`;
      const taskList = process.env[envVarName];
      
      if (taskList) {
        // Split by comma and trim whitespace
        const tasks = taskList.split(',').map(task => task.trim().toLowerCase());
        
        // Create mappings for each task
        for (const task of tasks) {
          if (task) {
            this.taskToProviderMap.set(task, provider);
            console.log(`Mapped task "${task}" to provider "${provider}"`);
          }
        }
      }
    }
    
    // Log the total number of task mappings created
    console.log(`Loaded ${this.taskToProviderMap.size} task-to-provider mappings.`);
  }
  
  /**
   * Get the appropriate provider for a given task
   * @param taskName The name of the task/command
   * @returns The provider name to use for this task
   */
  getProviderForTask(taskName: string): string {
    // Normalize the task name to lowercase and handle potential dashes/underscores
    const normalizedTaskName = taskName.toLowerCase()
      .replace(/[-_]/g, ''); // Remove dashes and underscores for more flexible matching
    
    // Check for exact match first
    if (this.taskToProviderMap.has(taskName)) {
      return this.taskToProviderMap.get(taskName)!;
    }
    
    // Try normalized matching
    for (const [mappedTask, provider] of this.taskToProviderMap.entries()) {
      const normalizedMappedTask = mappedTask.toLowerCase().replace(/[-_]/g, '');
      if (normalizedTaskName === normalizedMappedTask) {
        return provider;
      }
      
      // Also check for partial matches (e.g. "parse-prd" should match "parse-prd-file")
      if (normalizedTaskName.includes(normalizedMappedTask) || 
          normalizedMappedTask.includes(normalizedTaskName)) {
        return provider;
      }
    }
    
    // Fall back to default provider if no mapping found
    return this.defaultProvider;
  }

  async sendRequest(request: LLMRequest, providerName?: string): Promise<LLMResponse> {
    // If the request has a taskName, use it to determine the provider
    if (request.taskName && !providerName) {
      providerName = this.getProviderForTask(request.taskName);
    }
    
    if (this.providers.size === 0) {
      throw new TaskError(
        'No LLM providers available. Please configure at least one provider API key.',
        ErrorCategory.LLM, ErrorSeverity.ERROR,
        { operation: 'sendRequest.noProviders' }
      );
    }
    
    // Queue the request and process
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request: { ...request, provider: providerName },
        resolve,
        reject
      });
      
      // Use setTimeout to avoid blocking the event loop
      setTimeout(() => this.processQueue(), 0);
    });
  }
  
  async refinePrompt(
    originalPrompt: string,
    failedResponse: string,
    desiredSpecification: string
  ): Promise<string> {
    return refinePrompt(this, originalPrompt, failedResponse, desiredSpecification);
  }
}
