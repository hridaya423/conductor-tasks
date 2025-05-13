import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import OpenAI from 'openai';
import process from 'process';

export class XAIProvider implements LLMProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;

  }

  get name(): string {
    return 'XAI';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {

      console.log('XAI API called with:', {
        model: request.options?.model || this.config.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt || '',
        temperature: request.options?.temperature || this.config.temperature || 0.7,
        maxTokens: request.options?.maxTokens || this.config.maxTokens || 1024
      });

      return {
        text: `[XAI API placeholder] Response to: ${request.prompt.substring(0, 50)}...`,
        usage: {
          promptTokens: request.prompt.length / 4,
          completionTokens: 100,
          totalTokens: (request.prompt.length / 4) + 100
        }
      };
    } catch (error) {
      console.error('XAI API error:', error);
      throw new Error(`XAI API error: ${error}`);
    }
  }
}

export class XaiClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(model?: string) {
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      throw new Error('XAI_API_KEY environment variable is required for xAI client');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.xai.com/v1'
    });

    this.model = model || process.env.MODEL || 'grok-1';
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const {
      prompt,
      maxTokens = 4000,
      temperature = 0.7,
      topP,
      stream,
      onStreamUpdate
    } = options;

    if (stream && onStreamUpdate) {

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: topP,
        stream: true
      });

      let fullResponse = '';
      let finishReason: string | undefined = undefined;

      for await (const chunk of stream) {
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
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: topP,
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
  }

  getProviderName(): string {
    return 'xAI';
  }

  getModelName(): string {
    return this.model;
  }
}
