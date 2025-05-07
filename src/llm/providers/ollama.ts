import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { LLMClient, LLMCompletionOptions } from '../types.js';
import process from 'process';
import fetch from 'node-fetch';
import { Readable } from 'stream';

export class OllamaProvider implements LLMProvider {
  private config: LLMProviderConfig;
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  get name(): string {
    return 'Ollama';
  }

  isAvailable(): boolean {
    return true; 
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const model = request.options?.model || this.config.model || 'llama3';
      const temperature = request.options?.temperature || this.config.temperature || 0.7;
      const maxTokens = request.options?.maxTokens || this.config.maxTokens || 1024;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: request.prompt,
          system: request.systemPrompt || '',
          temperature: temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      
      const text = data.response || '';

      
      const promptTokens = Math.ceil(request.prompt.length / 4);
      const completionTokens = Math.ceil(text.length / 4);

      return {
        text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Ollama API error: ${error}`);
    }
  }
}

export class OllamaClient implements LLMClient {
  private baseUrl: string;
  private model: string;

  constructor(model?: string) {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = model || process.env.OLLAMA_MODEL || 'llama3';
  }

  async complete(options: LLMCompletionOptions): Promise<string> {
    const {
      prompt,
      systemPrompt,
      maxTokens = 4000,
      temperature = 0.7,
      stream,
      onStreamUpdate,
    } = options;

    try {
      if (stream && onStreamUpdate) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            prompt: prompt,
            system: systemPrompt || '',
            temperature: temperature,
            max_tokens: maxTokens,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Ollama API returned no response body');
        }

        
        const buffer: Buffer[] = [];
        const stream = Readable.fromWeb(response.body as any);
        const decoder = new TextDecoder();
        let fullResponse = '';

        for await (const chunk of stream) {
          buffer.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const textChunk = decoder.decode(chunk, { stream: true });
          
          
          const lines = textChunk.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullResponse += data.response;
                onStreamUpdate(data.response);
              }
            } catch (e) {
              console.warn('Error parsing Ollama stream chunk:', e);
            }
          }
        }

        return fullResponse;
      } else {
        
        const response = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            prompt: prompt,
            system: systemPrompt || '',
            temperature: temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        return data.response || '';
      }
    } catch (error) {
      console.error('Ollama API error:', error);
      return `Error: ${error}`;
    }
  }

  getProviderName(): string {
    return 'Ollama';
  }

  getModelName(): string {
    return this.model;
  }
} 