export interface LLMClient {

  complete(options: LLMCompletionOptions): Promise<string>;

  getProviderName(): string;

  getModelName(): string;
}

export interface LLMCompletionOptions {

  prompt: string;

  systemPrompt?: string;

  maxTokens?: number;

  temperature?: number;

  topP?: number;

  presencePenalty?: number;

  frequencyPenalty?: number;

  stopSequences?: string[];

  onStreamUpdate?: (chunk: string) => void;

  stream?: boolean;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  options?: LLMProviderConfig;
  provider?: string;
}

export interface LLMResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProviderConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}
