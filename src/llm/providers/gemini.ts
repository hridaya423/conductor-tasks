import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse } from '../../core/types.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMClient, LLMCompletionOptions } from '../types.js';
import process from 'process';

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
      const model = this.client.getGenerativeModel({
        model: request.options?.model || this.config.model,
        generationConfig: {
          temperature: request.options?.temperature || this.config.temperature || 0.7,
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
      const text = response.text();

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
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error}`);
    }
  }
}

export class GeminiClient implements LLMClient {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(model?: string) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for Gemini client');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || process.env.MODEL || 'gemini-1.5-pro';
  }

  async complete(options: LLMCompletionOptions): Promise<string> {
    const {
      prompt,
      temperature = 0.7,
      topP,
      stream,
      onStreamUpdate
    } = options;

    const model = this.client.getGenerativeModel({ model: this.model });

    if (stream && onStreamUpdate) {

      const result = await model.generateContentStream(prompt);

      let fullResponse = '';
      for await (const chunk of result.stream) {
        const content = chunk.text();
        if (content) {
          fullResponse += content;
          onStreamUpdate(content);
        }
      }

      return fullResponse;
    } else {

      const result = await model.generateContent(prompt);
      return result.response.text();
    }
  }

  getProviderName(): string {
    return 'Google Gemini';
  }

  getModelName(): string {
    return this.model;
  }
}
