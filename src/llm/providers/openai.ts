import { LLMClient, LLMCompletionOptions } from '../types.js';
import OpenAI from 'openai';
import process from 'process';

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(model?: string) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI client');
    }

    this.client = new OpenAI({
      apiKey: apiKey
    });

    this.model = model || process.env.MODEL || 'gpt-4o';
  }

  async complete(options: LLMCompletionOptions): Promise<string> {
    const {
      prompt,
      maxTokens = 4000,
      temperature = 0.7,
      topP,
      presencePenalty,
      frequencyPenalty,
      stream,
      onStreamUpdate
    } = options;

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: temperature,
      top_p: topP,
      presence_penalty: presencePenalty,
      frequency_penalty: frequencyPenalty,
      stream: stream,
    };

    if (stream && onStreamUpdate) {

      const stream = await this.client.chat.completions.create({
        ...params,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onStreamUpdate(content);
        }
      }

      return fullResponse;
    } else {

      const response = await this.client.chat.completions.create({
        ...params,
        stream: false,
      });

      return response.choices[0]?.message?.content || '';
    }
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getModelName(): string {
    return this.model;
  }
}
