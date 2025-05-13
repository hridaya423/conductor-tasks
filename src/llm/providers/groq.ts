import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import Groq from 'groq-sdk';
import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import process from 'process';

export class GroqProvider implements LLMProvider {
  private client: Groq;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
    });
  }

  get name(): string {
    return 'Groq';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const messages: any[] = [];

      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt
        });
      }

      messages.push({
        role: 'user',
        content: request.prompt
      });

      const response = await this.client.chat.completions.create({
        model: request.options?.model || this.config.model,
        messages,
        temperature: request.options?.temperature || this.config.temperature || 0.7,
        max_tokens: request.options?.maxTokens || this.config.maxTokens,
      });

      return {
        text: response.choices[0]?.message?.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      console.error('Groq API error:', error);
      throw new Error(`Groq API error: ${error}`);
    }
  }
}

export class GroqClient implements LLMClient {
  private client: Groq;
  private model: string;

  constructor(model?: string) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required for Groq client');
    }

    this.client = new Groq({
      apiKey: apiKey
    });

    
    this.model = process.env.GROQ_MODEL || model || 'deepseek-r1-distill-llama-70b'; 
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const {
      prompt,
      maxTokens = 4000,
      temperature = 0.7,
      topP,
      systemPrompt,
      stream,
      onStreamUpdate
    } = options;

    try {
      const messages: any[] = [];

      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }

      messages.push({ role: 'user', content: prompt });

      if (stream && onStreamUpdate) {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: topP,
          stream: true
        });

        let fullResponse = '';
        let finishReason: string | undefined = undefined;
        let usage: LLMUsage | null = null; 
        

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onStreamUpdate(content);
          }
          if (chunk.choices[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }
          
          
          if (chunk.x_groq?.usage) {
             usage = {
                promptTokens: chunk.x_groq.usage.prompt_tokens || 0,
                completionTokens: chunk.x_groq.usage.completion_tokens || 0,
                totalTokens: chunk.x_groq.usage.total_tokens || 0,
             };
          }
        }
        
        return {
          text: fullResponse,
          usage: usage, 
          model: this.model, 
          finishReason: finishReason,
        };

      } else {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: messages,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: topP,
        });

        const text = response.choices[0]?.message?.content || '';
        const responseUsage = response.usage;
        const usage: LLMUsage | null = responseUsage
          ? {
              promptTokens: responseUsage.prompt_tokens,
              completionTokens: responseUsage.completion_tokens,
              totalTokens: responseUsage.total_tokens,
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
      console.error('Groq API error:', error);
      
      throw new Error(`Groq API error: ${error.message || String(error)}`);
    }
  }

  getProviderName(): string {
    return 'Groq';
  }

  getModelName(): string {
    return this.model;
  }
}
