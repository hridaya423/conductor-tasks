import Anthropic from '@anthropic-ai/sdk';
import process from 'process';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../../core/errorHandler.js';
import { JsonUtils } from '../../core/jsonUtils.js';
const errorHandler = ErrorHandler.getInstance();
export class AnthropicClient {
    constructor(model) {
        this.maxRetries = 3;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic client');
        }
        this.client = new Anthropic({
            apiKey
        });
        this.model = model || process.env.MODEL || 'claude-3.7-sonnet-20240607';
        if (process.env.LLM_MAX_RETRIES) {
            this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES, 10);
        }
    }
    async complete(options) {
        const { prompt, maxTokens = 4000, temperature = 0.7, topP, stream, onStreamUpdate, systemPrompt, stopSequences } = options;
        const isJsonRequest = systemPrompt?.includes('JSON') ||
            systemPrompt?.includes('json') ||
            prompt?.includes('JSON') ||
            prompt?.includes('json');
        let effectiveSystemPrompt = systemPrompt;
        let effectiveTemperature = temperature;
        if (isJsonRequest) {
            if (!effectiveSystemPrompt) {
                effectiveSystemPrompt = "CRITICAL: You are a pure JSON response system. You MUST ONLY output valid JSON with ABSOLUTELY NOTHING before or after it. ANY text outside the JSON will cause system failure.";
            }
            else if (!effectiveSystemPrompt.toLowerCase().includes('json-only') && !effectiveSystemPrompt.toLowerCase().includes('pure json')) {
                effectiveSystemPrompt = "CRITICAL: Output ONLY valid JSON with NOTHING else. ANY text outside the JSON will cause system failure.\n\n" + effectiveSystemPrompt;
            }
            if (effectiveTemperature > 0.1) {
                effectiveTemperature = 0.01;
            }
        }
        let retryCount = 0;
        let lastError = null;
        while (retryCount <= this.maxRetries) {
            try {
                if (retryCount > 0) {
                    const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                if (stream && onStreamUpdate) {
                    const response = await this.client.messages.create({
                        model: this.model,
                        max_tokens: maxTokens,
                        temperature: effectiveTemperature,
                        top_p: topP,
                        system: effectiveSystemPrompt,
                        messages: [{ role: 'user', content: prompt }],
                        stream: true,
                    });
                    let fullResponse = '';
                    for await (const chunk of response) {
                        if (chunk.type === 'content_block_delta' && chunk.delta) {
                            const textValue = typeof chunk.delta === 'object' && 'text' in chunk.delta ? chunk.delta.text : '';
                            if (textValue) {
                                fullResponse += textValue;
                                onStreamUpdate(textValue);
                            }
                        }
                    }
                    return fullResponse;
                }
                else {
                    const response = await this.client.messages.create({
                        model: this.model,
                        max_tokens: maxTokens,
                        temperature: effectiveTemperature,
                        top_p: topP,
                        system: effectiveSystemPrompt,
                        messages: [{ role: 'user', content: prompt }],
                        stream: false,
                        stop_sequences: stopSequences,
                    });
                    let responseText = '';
                    for (const content of response.content) {
                        if (content.type === 'text') {
                            responseText += content.text;
                        }
                    }
                    if (isJsonRequest && responseText) {
                        const jsonArray = JsonUtils.extractJsonArray(responseText, false);
                        if (jsonArray !== null) {
                            responseText = JSON.stringify(jsonArray);
                        }
                    }
                    return responseText;
                }
            }
            catch (error) {
                lastError = error;
                const isRetryable = error instanceof Error &&
                    (error.message.includes('500') ||
                        error.message.includes('502') ||
                        error.message.includes('503') ||
                        error.message.includes('timeout') ||
                        error.message.includes('429'));
                if (isRetryable && retryCount < this.maxRetries) {
                    errorHandler.handleError(new TaskError(`Anthropic API error (retry ${retryCount + 1}/${this.maxRetries}): ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.LLM, ErrorSeverity.WARNING, { operation: 'anthropic-complete', additionalInfo: { retry: retryCount + 1 } }, error instanceof Error ? error : undefined), true);
                    retryCount++;
                    continue;
                }
                errorHandler.handleError(new TaskError(`Anthropic API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'anthropic-complete', additionalInfo: { maxRetriesExceeded: true } }, lastError instanceof Error ? lastError : undefined));
                throw new TaskError(`Anthropic API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'anthropic-complete', additionalInfo: { maxRetriesExceeded: true } }, lastError instanceof Error ? lastError : undefined);
            }
        }
        throw new Error(`Unreachable code: should have returned or thrown by now`);
    }
    getProviderName() {
        return 'Anthropic';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=anthropic.js.map