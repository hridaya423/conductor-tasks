import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import process from 'process';

import { OpenAI } from 'openai';

export class PerplexityProvider implements LLMProvider {
  private client: OpenAI;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || process.env.PERPLEXITY_API_BASE_URL || 'https://api.perplexity.ai'
    });
  }

  get name(): string {
    return 'Perplexity AI';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const systemPrompt = request.systemPrompt || '';
      const userPrompt = request.prompt;

      const messages = [];

      if (systemPrompt) {
        messages.push({
          role: 'system' as const,
          content: systemPrompt
        });
      }

      messages.push({
        role: 'user' as const,
        content: userPrompt
      });

      const response = await this.client.chat.completions.create({
        model: request.options?.model || this.config.model || 'llama-3-sonar-medium-32k-online',
        messages: messages,
        temperature: request.options?.temperature || this.config.temperature || 0.7,
        max_tokens: request.options?.maxTokens || this.config.maxTokens || 1024
      });

      return {
        text: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      console.error('Perplexity API error:', error);
      throw new Error(`Perplexity API error: ${error}`);
    }
  }
}

export class PerplexityClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(model?: string) {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required for Perplexity client');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.PERPLEXITY_API_BASE_URL || 'https://api.perplexity.ai'
    });

    this.model = model || process.env.PERPLEXITY_MODEL || 'llama-3-sonar-medium-32k-online';
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const {
      prompt,
      systemPrompt,
      maxTokens = 4000,
      temperature = 0.7,
      stream,
      onStreamUpdate
    } = options;

    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system' as const,
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user' as const,
      content: prompt
    });

    try {
      if (stream && onStreamUpdate) {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true
        });

        let fullResponse = '';
        let finishReason: string | undefined = undefined;

        for await (const chunk of response) {
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
          finishReason: finishReason,
        };
      } else {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
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
          model: response.model || this.model,
          finishReason: response.choices[0]?.finish_reason || undefined,
        };
      }
    } catch (error: any) {
      console.error('Perplexity API error:', error);
      throw new Error(`Perplexity API error: ${error.message || String(error)}`);
    }
  }

  getProviderName(): string {
    return 'Perplexity AI';
  }

  getModelName(): string {
    return this.model;
  }
}
