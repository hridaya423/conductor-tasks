import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMClient, LLMCompletionOptions } from '../types.js';
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
    this.model = model || process.env.MODEL || 'gemini-2.5-pro-latest';
    
    if (process.env.LLM_MAX_RETRIES) {
      this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES, 10);
    }
  }

  async complete(options: LLMCompletionOptions): Promise<string> {
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
          const result = await model.generateContentStream(combinedPrompt);

          let fullResponse = '';
          for await (const chunk of result.stream) {
            const content = chunk.text();
            if (content) {
              fullResponse += content;
              onStreamUpdate(content);
            }
          }

          
          if (isJsonRequest && fullResponse) {
            const jsonArray = JsonUtils.extractJsonArray(fullResponse, false);
            if (jsonArray !== null) {
              fullResponse = JSON.stringify(jsonArray);
            }
          }

          return fullResponse;
        } else {
          const result = await model.generateContent(combinedPrompt);
          let responseText = result.response.text();
          
          
          if (isJsonRequest && responseText) {
            const jsonArray = JsonUtils.extractJsonArray(responseText, false);
            if (jsonArray !== null) {
              responseText = JSON.stringify(jsonArray);
            }
          }
          
          return responseText;
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
