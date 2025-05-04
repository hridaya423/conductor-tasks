import { LLMClient, LLMCompletionOptions } from '../types.js';
import { Mistral } from '@mistralai/mistralai';
import process from 'process';

export class MistralClient implements LLMClient {
  private client: Mistral;
  private model: string;

  constructor(model?: string) {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is required for Mistral client');
    }

    this.client = new Mistral({
      apiKey: apiKey
    });

    this.model = model || process.env.MODEL || 'mistral-large-latest';
  }

  async complete(options: LLMCompletionOptions): Promise<string> {
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
        for await (const chunk of streamResponse) {

          const chunkAny = chunk as any;

          if (chunkAny.delta && typeof chunkAny.delta === 'string') {
            fullResponse += chunkAny.delta;
            onStreamUpdate(chunkAny.delta);
          } else if (chunkAny.delta && typeof chunkAny.delta === 'object') {
            const text = chunkAny.delta.text || chunkAny.delta.content || '';
            if (text) {
              fullResponse += text;
              onStreamUpdate(text);
            }
          }
        }

        return fullResponse;
      } else {
        const response = await this.client.chat.complete({
          model: this.model,
          messages: messages,
          temperature: temperature,
          maxTokens: maxTokens,
          topP: topP
        });

        let content = '';
        if (response && response.choices && response.choices.length > 0) {
          const messageContent = response.choices[0].message.content;
          content = typeof messageContent === 'string' ? messageContent : '';
        }

        return content || "No response from Mistral API";
      }
    } catch (error) {
      console.error('Mistral API error:', error);
      return `Error: ${error}`;
    }
  }

  getProviderName(): string {
    return 'Mistral AI';
  }

  getModelName(): string {
    return this.model;
  }
}
