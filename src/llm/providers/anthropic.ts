import { LLMClient, LLMCompletionOptions } from '../types.js';
import Anthropic from '@anthropic-ai/sdk';
import process from 'process';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../../core/errorHandler.js';

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
      apiKey: apiKey
    });

    this.model = model || process.env.MODEL || 'claude-3-opus-20240229';

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
      systemPrompt
    } = options;

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
            temperature: temperature,
            top_p: topP,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          });

          let fullResponse = '';
          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta) {
              const textValue = typeof chunk.delta === 'object' && 'text' in chunk.delta ? chunk.delta.text : '';
              if (textValue) {
                fullResponse += textValue;
                onStreamUpdate(textValue);
              }
            }
          }

          return fullResponse;
        } else {
          const response = await this.client.messages.create({
            model: this.model,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          });

          let responseText = '';
          for (const content of response.content) {
            if (content.type === 'text') {
              responseText += content.text;
            }
          }

          return responseText;
        }
      } catch (error) {
        lastError = error;

        const isRetryable = 
          error instanceof Error && 
          (error.message.includes('network') || 
           error.message.includes('timeout') ||
           error.message.includes('rate') ||
           error.message.includes('limit') ||
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
            `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`,
            ErrorCategory.LLM,
            ErrorSeverity.ERROR,
            { operation: 'anthropic-complete' },
            error instanceof Error ? error : undefined
          )
        );

        throw new TaskError(
          `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.LLM,
          ErrorSeverity.ERROR,
          { operation: 'anthropic-complete' },
          error instanceof Error ? error : undefined
        );
      }
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

  getProviderName(): string {
    return 'Anthropic';
  }

  getModelName(): string {
    return this.model;
  }
}
