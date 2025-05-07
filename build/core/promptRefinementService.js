import logger from './logger.js';
export async function refinePrompt(llmManager, originalPrompt, failedResponse, desiredSpecification) {
    const instruction = `
You are an expert prompt engineer. Your job is to improve a user prompt so that the AI model will produce exactly the desired output format.

Original Prompt:
${originalPrompt}

Failed LLM Response:
${failedResponse}

Desired Output Specification:
${desiredSpecification}

Please output only the improved prompt—with no additional commentary or reasoning—so that when the model receives it, it will follow the specification precisely.
`;
    try {
        const result = await llmManager.sendRequest({
            prompt: instruction,
            systemPrompt: 'You are a JSON-free prompt refiner.',
            options: { temperature: 0.2 }
        });
        const refined = result.text.trim();
        logger.info('Generated improved prompt via refinePromptService');
        return refined;
    }
    catch (error) {
        logger.error('Prompt refinement failed', { error });
        throw error;
    }
}
//# sourceMappingURL=promptRefinementService.js.map