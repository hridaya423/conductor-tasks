import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import Anthropic from '@anthropic-ai/sdk';
import process from 'process';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../../core/errorHandler.js';
import { JsonUtils } from '../../core/jsonUtils.js';
import logger from '../../core/logger.js';

const errorHandler = ErrorHandler.getInstance();

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;
  private maxRetries: number = 3;

  constructor(model?: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic client');
    }

    this.client = new Anthropic({
      apiKey
    });

    
    this.model = process.env.ANTHROPIC_MODEL || model || 'claude-3.7-sonnet-20240607';
    
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
    let lastError: any = null;

    while (retryCount <= this.maxRetries) {
      try {
        if (retryCount > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        if (stream && onStreamUpdate) {
          const response = await this.client.messages.create({
            model: this.model,
            max_tokens: maxTokens,
            temperature: effectiveTemperature,
            top_p: topP,
            system: effectiveSystemPrompt,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          });

          let fullResponse = '';
          let usage: LLMUsage | null = null;
          let finalStopReason: string | undefined = undefined;
          let finalModel: string = this.model;

          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const textValue = chunk.delta.text;
              if (textValue) {
                fullResponse += textValue;
                onStreamUpdate(textValue);
              }
            } else if (chunk.type === 'message_delta' && chunk.delta.stop_reason) {
              finalStopReason = chunk.delta.stop_reason;
              
              
              if (chunk.usage && typeof chunk.usage.output_tokens === 'number') {
                usage = {
                  promptTokens: 0, 
                  completionTokens: chunk.usage.output_tokens,
                  totalTokens: chunk.usage.output_tokens, 
                };
              }
            } else if (chunk.type === 'message_start') {
              
              if (chunk.message && chunk.message.usage && typeof chunk.message.usage.input_tokens === 'number') {
                
                const inputTokens = chunk.message.usage.input_tokens;
                if (usage) {
                  usage.promptTokens = inputTokens;
                  usage.totalTokens = inputTokens + usage.completionTokens;
                } else {
                  usage = {
                    promptTokens: inputTokens,
                    completionTokens: 0,
                    totalTokens: inputTokens,
                  };
                }
              }
            } else if (chunk.type === 'message_stop') {
              
              
              
              
              
              
              
            }
          }
          
          
          
          
          
          
          
          
          
          

          return {
            text: fullResponse,
            usage: usage, 
            model: finalModel,
            finishReason: finalStopReason,
          };
        } else {
          const response = await this.client.messages.create({
            model: this.model,
            max_tokens: maxTokens,
            temperature: effectiveTemperature,
            top_p: topP,
            system: effectiveSystemPrompt,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            stop_sequences: stopSequences,
          });

          let responseText = '';
          if (response.content.length > 0 && response.content[0].type === 'text') {
            responseText = response.content[0].text;
          }
          
          if (isJsonRequest && responseText) {
            const jsonArray = JsonUtils.extractJsonArray(responseText, false);
            if (jsonArray !== null) {
              
              responseText = JSON.stringify(jsonArray); 
            }
          }
          
          const usage: LLMUsage | null = response.usage
            ? {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
              }
            : null;

          return {
            text: responseText,
            usage: usage,
            model: response.model,
            finishReason: response.stop_reason || undefined,
          };
        }
      } catch (error) {
        lastError = error;

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
              `Anthropic API error (retry ${retryCount + 1}/${this.maxRetries}): ${error instanceof Error ? error.message : String(error)}`,
              ErrorCategory.LLM,
              ErrorSeverity.WARNING,
              { operation: 'anthropic-complete', additionalInfo: { retry: retryCount + 1 } },
              error instanceof Error ? error : undefined
            ),
            true
          );

          retryCount++;
          continue;
        }

        errorHandler.handleError(
          new TaskError(
            `Anthropic API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
            ErrorCategory.LLM,
            ErrorSeverity.ERROR,
            { operation: 'anthropic-complete', additionalInfo: { maxRetriesExceeded: true } },
            lastError instanceof Error ? lastError : undefined
          )
        );

        throw new TaskError(
          `Anthropic API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
          ErrorCategory.LLM,
          ErrorSeverity.ERROR,
          { operation: 'anthropic-complete', additionalInfo: { maxRetriesExceeded: true } },
          lastError instanceof Error ? lastError : undefined
        );
      }
    }

    throw new Error(`Unreachable code: should have returned or thrown by now`);
  }

  getProviderName(): string {
    return 'Anthropic';
  }

  getModelName(): string {
    return this.model;
  }
}
