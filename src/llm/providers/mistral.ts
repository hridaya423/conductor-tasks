import { LLMClient, LLMCompletionOptions, LLMCompletionResult, LLMUsage } from '../types.js';
import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { Mistral } from '@mistralai/mistralai'; 
import process from 'process';

export class MistralProvider implements LLMProvider {
  private client: Mistral;
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    
    
    const apiKey = config.apiKey || process.env.MISTRAL_API_KEY || process.env.MIXTRAL_API_KEY;
    
    if (!apiKey) {
      throw new Error('API key is required for Mistral client');
    }
    
    const options: any = { apiKey };
    if (config.baseUrl || process.env.MISTRAL_API_BASE_URL) {
      options.endpoint = config.baseUrl || process.env.MISTRAL_API_BASE_URL;
    }
    
    this.client = new Mistral(options);
  }

  get name(): string {
    
    const model = this.config.model || '';
    if (model.toLowerCase().includes('mixtral')) {
      return 'Mixtral';
    }
    return 'Mistral AI';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey || !!process.env.MISTRAL_API_KEY || !!process.env.MIXTRAL_API_KEY;
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

      
      const response = await this.client.chat.complete({
        model: request.options?.model || this.config.model || 'mistral-small-latest',
        messages: messages,
        temperature: request.options?.temperature || this.config.temperature || 0.7,
        maxTokens: request.options?.maxTokens || this.config.maxTokens || 1024
      });

      
      const responseText = String(response.choices?.[0]?.message.content || '');

      return {
        text: responseText,
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
          totalTokens: response.usage?.totalTokens || 0
        }
      };

    } catch (error) {
      console.error('Mistral API error:', error);
      throw new Error(`Mistral API error: ${error}`);
    }
  }
}

export class MistralClient implements LLMClient {
  private client: Mistral;
  private model: string;
  private providerName: string;

  constructor(model?: string) {
    
    const apiKey = process.env.MISTRAL_API_KEY || process.env.MIXTRAL_API_KEY;

    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY or MIXTRAL_API_KEY environment variable is required for Mistral client');
    }

    const options: any = { apiKey };
    if (process.env.MISTRAL_API_BASE_URL) {
      options.endpoint = process.env.MISTRAL_API_BASE_URL;
    }
    
    this.client = new Mistral(options);

    
    if (model) {
      this.model = model;
    } else if (process.env.MISTRAL_MODEL) {
      this.model = process.env.MISTRAL_MODEL;
    } else if (process.env.MIXTRAL_MODEL) {
      this.model = process.env.MIXTRAL_MODEL;
    } else if (process.env.MODEL && (process.env.MODEL.includes('mistral') || process.env.MODEL.includes('mixtral'))) {
      this.model = process.env.MODEL;
    } else {
      this.model = 'mistral-large-latest';
    }

    
    if (this.model.toLowerCase().includes('mixtral')) {
      this.providerName = 'Mixtral';
    } else {
      this.providerName = 'Mistral AI';
    }
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const {
      prompt,
      systemPrompt,
      maxTokens = 4000,
      temperature = 0.7,
      topP,
      stream,
      onStreamUpdate
    } = options;

    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system' as const, content: systemPrompt });
      }
      messages.push({ role: 'user' as const, content: prompt });

      if (stream && onStreamUpdate) {
        
        const streamResponse = await this.client.chat.stream({
          model: this.model,
          messages: messages,
          temperature: temperature,
          maxTokens: maxTokens,
          topP: topP
        });

        let fullResponse = '';
        let finishReason: string | undefined = undefined;
        let usage: LLMUsage | null = null;

        for await (const chunk of streamResponse) { 
          const choices = (chunk as any).choices; 
          if (choices && choices.length > 0) {
            const choice = choices[0];
            if (choice.delta && choice.delta.content) {
              const content = choice.delta.content;
              fullResponse += content;
              onStreamUpdate(content);
            }
            if (choice.finish_reason) { 
              finishReason = choice.finish_reason;
            }
          }
          
          
          
          
          if ((chunk as any).usage) { 
            const chunkUsage = (chunk as any).usage;
            usage = {
              promptTokens: chunkUsage.promptTokens || chunkUsage.prompt_tokens || 0,
              completionTokens: chunkUsage.completionTokens || chunkUsage.completion_tokens || 0,
              totalTokens: chunkUsage.totalTokens || chunkUsage.total_tokens || 0,
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
        const response = await this.client.chat.complete({
          model: this.model,
          messages: messages,
          temperature: temperature,
          maxTokens: maxTokens,
          topP: topP,
        });
        
        const text = String(response.choices?.[0]?.message.content || 'No response from Mistral API');
        const responseUsage = response.usage; 
        const usage: LLMUsage | null = responseUsage
          ? {
              promptTokens: responseUsage.promptTokens, 
              completionTokens: responseUsage.completionTokens, 
              totalTokens: responseUsage.totalTokens, 
            }
          : null;

        return {
          text: text,
          usage: usage,
          model: response.model || this.model,
          finishReason: response.choices && response.choices.length > 0 ? response.choices[0].finishReason : undefined, 
        };
      }
    } catch (error: any) {
      console.error('Mistral API error:', error);
      throw new Error(`Mistral API error: ${error.message || String(error)}`);
    }
  }

  
  

  getProviderName(): string {
    return this.providerName;
  }

  getModelName(): string {
    return this.model;
  }
}



export const MixtralClient = MistralClient;
export const MixtralProvider = MistralProvider;
