import { LLMManager } from '../llm/llmManager.js';
export declare function refinePrompt(llmManager: LLMManager, originalPrompt: string, failedResponse: string, desiredSpecification: string): Promise<string>;
