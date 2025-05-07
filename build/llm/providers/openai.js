import OpenAI from 'openai';
import process from 'process';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../../core/errorHandler.js';
const errorHandler = ErrorHandler.getInstance();
export class OpenAIClient {
    constructor(model) {
        this.maxRetries = 3;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required for OpenAI client');
        }
        this.client = new OpenAI({
            apiKey: apiKey
        });
        this.model = model || process.env.MODEL || 'gpt-4o';
        if (process.env.LLM_MAX_RETRIES) {
            this.maxRetries = parseInt(process.env.LLM_MAX_RETRIES, 10);
        }
    }
    async complete(options) {
        const { prompt, maxTokens = 4000, temperature = 0.7, topP, presencePenalty, frequencyPenalty, stream, onStreamUpdate, systemPrompt } = options;
        const params = {
            model: this.model,
            messages: systemPrompt
                ? [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ]
                : [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP,
            presence_penalty: presencePenalty,
            frequency_penalty: frequencyPenalty,
            stream: stream,
        };
        let retryCount = 0;
        let lastError = null;
        while (retryCount <= this.maxRetries) {
            try {
                if (retryCount > 0) {
                    const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    errorHandler.handleError(new TaskError(`OpenAI API error (retry ${retryCount}/${this.maxRetries}): ${lastError instanceof Error ? lastError.message : String(lastError)}`, ErrorCategory.LLM, ErrorSeverity.WARNING, { operation: 'openai-complete', additionalInfo: { retry: retryCount } }, lastError instanceof Error ? lastError : undefined), true);
                }
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
                }
                else {
                    const response = await this.client.chat.completions.create({
                        ...params,
                        stream: false,
                    });
                    return response.choices[0]?.message?.content || '';
                }
            }
            catch (error) {
                lastError = error;
                const isRetryable = error instanceof Error &&
                    (error.message.includes('network') ||
                        error.message.includes('timeout') ||
                        error.message.includes('rate') ||
                        error.message.includes('limit') ||
                        error.message.includes('429') ||
                        error.message.includes('500') ||
                        error.message.includes('502') ||
                        error.message.includes('503') ||
                        error.message.includes('504'));
                if (isRetryable && retryCount < this.maxRetries) {
                    retryCount++;
                    continue;
                }
                errorHandler.handleError(new TaskError(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'openai-complete' }, error instanceof Error ? error : undefined));
                throw new TaskError(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'openai-complete' }, error instanceof Error ? error : undefined);
            }
        }
        errorHandler.handleError(new TaskError(`OpenAI API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'openai-complete', additionalInfo: { maxRetriesExceeded: true } }, lastError instanceof Error ? lastError : undefined));
        throw new TaskError(`OpenAI API error (after ${this.maxRetries} retries): ${lastError instanceof Error ? lastError.message : String(lastError)}`, ErrorCategory.LLM, ErrorSeverity.ERROR, { operation: 'openai-complete', additionalInfo: { maxRetriesExceeded: true } }, lastError instanceof Error ? lastError : undefined);
    }
    getProviderName() {
        return 'OpenAI';
    }
    getModelName() {
        return this.model;
    }
}
//# sourceMappingURL=openai.js.map