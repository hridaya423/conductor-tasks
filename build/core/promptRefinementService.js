import logger from './logger.js';
export async function refinePrompt(llmManager, originalPrompt, failedResponse, desiredSpecification) {
    const instruction = `
You are a world-class AI Prompt Architect, renowned for crafting prompts that elicit precisely structured and flawlessly compliant responses from advanced AI models. Your mission is to meticulously revise the "Original Prompt" below. The goal is to ensure an AI model, when given your revised prompt, will generate output that *strictly and unfailingly* adheres to the "Desired Output Specification". The AI model's previous "Failed LLM Response" (triggered by the "Original Prompt") demonstrates a clear deviation from this specification.

Original Prompt:
\`\`\`
${originalPrompt}
\`\`\`

Failed LLM Response (from the Original Prompt):
\`\`\`
${failedResponse}
\`\`\`

Desired Output Specification (the AI model's output MUST conform to this with absolute precision):
\`\`\`
${desiredSpecification}
\`\`\`

Your revised prompt MUST achieve the following:
1.  **Crystal Clarity & Zero Ambiguity**: Eliminate any vagueness. The instructions must be direct and unmistakable for the AI model.
2.  **Programmatic Parsability**: The output generated by your revised prompt must be reliably and easily parsable by software. This is paramount.
3.  **Strict Structural Adherence**: If the "Desired Output Specification" implies or defines a structured format (e.g., JSON, XML, specific list format, Markdown sections), your revised prompt MUST command the AI model to use that *exact* structure. For JSON, this includes specifying all keys, data types, nesting, and quoting. For other formats, be equally explicit.
4.  **No Extraneous Content**: Instruct the AI model to OMIT ALL conversational fluff, apologies, self-references, disclaimers, or explanations *unless* such text is explicitly part of the "Desired Output Specification". The AI's output should be *only* the data or text requested, without any leading or trailing commentary.
5.  **Counteract Past Failures**: Analyze the "Failed LLM Response" against the "Desired Output Specification". Identify the specific deviations. Your revised prompt must contain explicit instructions or rephrasing to prevent these exact failures from recurring.
6.  **Robust Formatting & Delimiters**: If the output is not a standard structured format (like JSON), incorporate strong, unique formatting cues or delimiters (e.g., \`BEGIN_DATA\`, \`END_DATA\`) to clearly demarcate the start and end of the relevant output, aiding programmatic extraction.
7.  **Conciseness with Completeness**: Strive for a prompt that is as concise as possible while retaining all critical details necessary for the AI to meet the specification flawlessly.

The revised prompt MUST NOT lead to responses that:
-   Include any conversational text or meta-commentary unless explicitly part of the desired output.
-   Deviate in any way from the requested structure, format, or content constraints.
-   Introduce information not explicitly requested or inferable from the "Desired Output Specification".
-   Fail to handle edge cases as defined or implied by the specification (e.g., if an empty result is possible, the prompt should guide the AI on how to represent this, such as an empty array for JSON, or a specific string if defined).

Output ONLY the improved prompt. Do not include any other text, explanation, or commentary.
Begin your response immediately with the revised prompt content.

Improved Prompt:
`;
    try {
        const result = await llmManager.sendRequest({
            prompt: instruction,
            systemPrompt: 'You are a world-class AI Prompt Architect. Your sole output is a revised prompt, with no additional commentary or conversational fluff.',
            options: { temperature: 0.05, maxTokens: 2000 }
        });
        let refined = result.text.trim();
        if (refined.startsWith("Improved Prompt:")) {
            refined = refined.substring("Improved Prompt:".length).trim();
        }
        logger.info('Generated improved prompt via refinePromptService');
        return refined;
    }
    catch (error) {
        logger.error('Prompt refinement failed', { error });
        throw error;
    }
}
//# sourceMappingURL=promptRefinementService.js.map