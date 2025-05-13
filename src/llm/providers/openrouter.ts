import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import OpenAI from 'openai'; 
import process from 'process';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../../core/errorHandler.js';

const errorHandler = ErrorHandler.getInstance();

export class OpenRouterClient implements LLMClient {
  private client: OpenAI;
  private model: string;
  private maxRetries: number = 3;
  private apiKey?: string;
  private baseURL: string = 'https://openrouter.ai/api/v1'; 

  constructor(model?: string, apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY;

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required for OpenRouter client');
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });

    this.model = model || process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct'; 
    
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
      presencePenalty,
      frequencyPenalty,
      stream,
      onStreamUpdate,
      systemPrompt
    } = options;

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages: systemPrompt 
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ] 
        : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temperature,
      top_p: topP,
      presence_penalty: presencePenalty,
      frequency_penalty: frequencyPenalty,
      stream: stream,
      
      
      
      
      
    };
    
    
    Object.keys(params).forEach(key => {
        const paramKey = key as keyof OpenAI.Chat.ChatCompletionCreateParams;
        if (params[paramKey] === undefined || params[paramKey] === null) {
            delete params[paramKey];
        }
    });


    let retryCount = 0;
    let lastError: any = null;

    while (retryCount <= this.maxRetries) {
      try {
        if (retryCount > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          errorHandler.handleError(
            new TaskError(
              `OpenRouter API error (retry ${retryCount}/${this.maxRetries}): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
              ErrorCategory.LLM,
              ErrorSeverity.WARNING,
              { operation: 'openrouter-complete', additionalInfo: { retry: retryCount, model: this.model } },
              lastError instanceof Error ? lastError : undefined
            ),
            true
          );
        }

        if (stream && onStreamUpdate) {
          const streamResponse = await this.client.chat.completions.create({
            ...(params as OpenAI.Chat.ChatCompletionCreateParamsStreaming), 
          });

          let fullResponse = '';
          let finishReason: string | null = null;

          for await (const chunk of streamResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              onStreamUpdate(content);
            }
            if (chunk.choices[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          }
          return {
            text: fullResponse,
            usage: null, 
            model: this.model,
            finishReason: finishReason || undefined,
          };
        } else {
          const response = await this.client.chat.completions.create({
            ...(params as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming), 
          });

          const text = response.choices[0]?.message?.content || '';
          const usage: LLMUsage | null = response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : null;
          
          return {
            text: text,
            usage: usage,
            model: response.model, 
            finishReason: response.choices[0]?.finish_reason || undefined,
          };
        }
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);

        const isRetryable = 
          errorMessage.includes('network') || 
          errorMessage.includes('timeout') ||
          errorMessage.includes('rate_limit') || 
          errorMessage.includes('429') || 
          errorMessage.includes('500') || 
          errorMessage.includes('502') ||
          errorMessage.includes('503') ||
          errorMessage.includes('504');

        if (isRetryable && retryCount < this.maxRetries) {
          retryCount++;
          continue;
        }
        
        errorHandler.handleError(
          new TaskError(
            `OpenRouter API error: ${errorMessage}`,
            ErrorCategory.LLM,
            ErrorSeverity.ERROR,
            { operation: 'openrouter-complete', additionalInfo: { model: this.model } },
            error instanceof Error ? error : undefined
          )
        );
        throw error; 
      }
    }
    
    
    throw new TaskError(
        `OpenRouter API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        ErrorCategory.LLM,
        ErrorSeverity.ERROR,
        { operation: 'openrouter-complete', additionalInfo: { maxRetriesExceeded: true, model: this.model } },
        lastError instanceof Error ? lastError : undefined
    );
  }

  getProviderName(): string {
    return 'OpenRouter';
  }

  getModelName(): string {
    return this.model;
  }
}
