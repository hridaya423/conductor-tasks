import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'; 
import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import process from 'process';
import { JsonUtils } from '../../core/jsonUtils.js';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../../core/errorHandler.js';

const errorHandler = ErrorHandler.getInstance();

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  get name(): string {
    return 'Google Gemini';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const isJsonRequest = request.systemPrompt?.includes('JSON') ||
                            request.systemPrompt?.includes('json') ||
                            request.prompt?.includes('JSON') || 
                            request.prompt?.includes('json');
      
      let effectiveTemperature = request.options?.temperature || this.config.temperature || 0.7;
      
      if (isJsonRequest && effectiveTemperature > 0.1) {
        effectiveTemperature = 0.01; 
      }
      
      const model = this.client.getGenerativeModel({
        model: request.options?.model || this.config.model,
        generationConfig: {
          temperature: effectiveTemperature,
          maxOutputTokens: request.options?.maxTokens || this.config.maxTokens || 1024,
          topP: request.options?.topP || this.config.topP || 0.95,
        }
      });

      const systemPrompt = request.systemPrompt || '';
      const userPrompt = request.prompt;

      const combinedPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${userPrompt}`
        : userPrompt;

      const result = await model.generateContent(combinedPrompt);
      const response = result.response;
      let text = response.text();

      if (isJsonRequest && text) {
        const jsonArray = JsonUtils.extractJsonArray(text, false);
        if (jsonArray !== null) {
          text = JSON.stringify(jsonArray);
        }
      }

      const promptChars = combinedPrompt.length;
      const responseChars = text.length;
      const promptTokens = Math.ceil(promptChars / 4);
      const completionTokens = Math.ceil(responseChars / 4);

      return {
        text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      };
    } catch (error) {
      errorHandler.handleError(
        new TaskError(
          `Gemini API error: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.LLM,
          ErrorSeverity.ERROR,
          { operation: 'gemini-generate' },
          error instanceof Error ? error : undefined
        )
      );
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;
  private model: string;
  private maxRetries: number = 3;

  constructor(model?: string) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for Gemini client');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    
    this.model = process.env.GEMINI_MODEL || model || 'gemini-1.5-flash-latest';
    
    if (process.env.LLM_MAX_RETRIES) {
      this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES, 10);
    }
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const {
      prompt,
      maxTokens = 4000,
      temperature = 0.7,
      topP,
      stream,
      onStreamUpdate,
      systemPrompt,
      stopSequences
    } = options;
    
    const isJsonRequest = systemPrompt?.includes('JSON') ||
                          systemPrompt?.includes('json') ||
                          prompt?.includes('JSON') || 
                          prompt?.includes('json');
    
    let effectiveSystemPrompt = systemPrompt;
    let effectiveTemperature = temperature;
    
    if (isJsonRequest) {
      
      if (!effectiveSystemPrompt) {
        effectiveSystemPrompt = "CRITICAL: You are a pure JSON response system. You MUST ONLY output valid JSON with ABSOLUTELY NOTHING before or after it. ANY text outside the JSON will cause system failure.";
      } else if (!effectiveSystemPrompt.toLowerCase().includes('json-only') && !effectiveSystemPrompt.toLowerCase().includes('pure json')) {
        effectiveSystemPrompt = "CRITICAL: Output ONLY valid JSON with NOTHING else. ANY text outside the JSON will cause system failure.\n\n" + effectiveSystemPrompt;
      }
      
      
      if (effectiveTemperature > 0.1) {
        effectiveTemperature = 0.01; 
      }
    }

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.maxRetries) {
      try {
        if (retryCount > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        const model = this.client.getGenerativeModel({ 
          model: this.model,
          generationConfig: {
            temperature: effectiveTemperature,
            maxOutputTokens: maxTokens,
            topP: topP || 0.95,
            stopSequences: stopSequences
          }
        });

        
        const combinedPrompt = effectiveSystemPrompt 
          ? `${effectiveSystemPrompt}\n\n${prompt}`
          : prompt;

        if (stream && onStreamUpdate) {
          const streamResult = await model.generateContentStream(combinedPrompt);

          let fullResponseText = '';
          let aggregatedResponse: any = null; 

          for await (const chunk of streamResult.stream) {
            const content = chunk.text();
            if (content) {
              fullResponseText += content;
              onStreamUpdate(content);
            }
            
          }
          
          
          
          try {
            aggregatedResponse = await streamResult.response;
          } catch (streamError) {
            
            console.warn("Gemini stream: error awaiting aggregated response:", streamError);
          }
          
          if (isJsonRequest && fullResponseText) {
            const jsonArray = JsonUtils.extractJsonArray(fullResponseText, false);
            if (jsonArray !== null) {
              fullResponseText = JSON.stringify(jsonArray);
            }
          }
          
          const aggUsageMeta = (aggregatedResponse as any)?.usageMetadata;
          const usage: LLMUsage | null = aggUsageMeta
            ? {
                promptTokens: aggUsageMeta.promptTokenCount ?? 0,
                completionTokens: aggUsageMeta.candidatesTokenCount ?? 0,
                totalTokens: aggUsageMeta.totalTokenCount ?? 0,
              }
            : null; 

          return {
            text: fullResponseText,
            usage: usage,
            model: this.model, 
            finishReason: (aggregatedResponse as any)?.candidates?.[0]?.finishReason || undefined,
          };

        } else {
          const result = await model.generateContent(combinedPrompt);
          const response = result.response; 
          let responseText = response.text();
          
          if (isJsonRequest && responseText) {
            const jsonArray = JsonUtils.extractJsonArray(responseText, false);
            if (jsonArray !== null) {
              responseText = JSON.stringify(jsonArray);
            }
          }
          
          const respUsageMeta = (response as any)?.usageMetadata;
          const usage: LLMUsage | null = respUsageMeta
            ? {
                promptTokens: respUsageMeta.promptTokenCount ?? 0,
                completionTokens: respUsageMeta.candidatesTokenCount ?? 0,
                totalTokens: respUsageMeta.totalTokenCount ?? 0,
              }
            : null;
            
          return {
            text: responseText,
            usage: usage,
            model: this.model, 
            finishReason: (response as any).candidates?.[0]?.finishReason || undefined,
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable = 
          error instanceof Error && 
          (error.message.includes('500') || 
           error.message.includes('502') || 
           error.message.includes('503') || 
           error.message.includes('timeout') || 
           error.message.includes('429'));

        if (isRetryable && retryCount < this.maxRetries) {
          errorHandler.handleError(
            new TaskError(
              `Gemini API error (retry ${retryCount + 1}/${this.maxRetries}): ${lastError.message}`,
              ErrorCategory.LLM,
              ErrorSeverity.WARNING,
              { operation: 'gemini-complete', additionalInfo: { retry: retryCount + 1 } },
              lastError
            ),
            true
          );

          retryCount++;
          continue;
        }
        
        errorHandler.handleError(
          new TaskError(
            `Gemini API error (after ${retryCount} retries): ${lastError.message}`,
            ErrorCategory.LLM,
            ErrorSeverity.ERROR,
            { operation: 'gemini-complete', additionalInfo: { maxRetriesExceeded: true } },
            lastError
          )
        );

        throw new Error(`Gemini API error: ${lastError.message}`);
      }
    }

    throw new Error(`Unreachable code: should have returned or thrown by now`);
  }

  getProviderName(): string {
    return 'Google Gemini';
  }

  getModelName(): string {
    return this.model;
  }
}
