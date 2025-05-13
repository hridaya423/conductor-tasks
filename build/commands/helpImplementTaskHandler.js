import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskStatus } from "../core/types.js";
export const HelpImplementTaskSchema = {
    taskId: z.string().describe("ID of the task"),
    additionalContext: z.string().optional().describe("Additional context or requirements for implementation")
};
export async function helpImplementTaskHandler(taskManager, llmManager, contextManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { taskId, additionalContext } = params;
        logger.info(`Getting implementation help for task: ${taskId}`, { additionalContext: !!additionalContext });
        const task = taskManager.getTask(taskId);
        if (!task) {
            logger.warn(`Task not found for implementation help: ${taskId}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: Task with ID ${taskId} not found.`
                    }
                ],
                isError: true
            };
        }
        let implementationPlan = task.notes.find(note => note.type === 'solution')?.content;
        if (!implementationPlan) {
            logger.info(`No existing implementation plan found for ${taskId}, generating one.`);
            implementationPlan = await taskManager.generateImplementationSteps(taskId);
        }
        const projectContext = contextManager.getProjectContext?.() || 'No project context available.';
        const formattedProjectContext = `Relevant Project Context:\n\\\`\\\`\\\`\n${projectContext}\n\\\`\\\`\\\`\n`;
        const implementationPrompt = `
# ROLE:
You are an expert Senior Software Engineer Pair Programmer. Your goal is to provide direct, actionable, and high-quality assistance to help a developer implement a specific task.

# TASK DETAILS:
## Title: ${task.title}
${task.description ? `## Description:\n${task.description}` : ''}
${task.priority ? `## Priority: ${task.priority}` : ''}
${task.status ? `## Status: ${task.status}` : ''}
${task.assignee ? `## Assignee: ${task.assignee}` : ''}
${task.tags && task.tags.length > 0 ? `## Tags: ${task.tags.join(', ')}` : ''}
${task.dueDate ? `## Due Date: ${task.dueDate}` : ''}
${task.complexity ? `## Complexity: ${task.complexity}` : ''}
${task.dependencies && task.dependencies.length > 0 ? `## Dependencies: ${task.dependencies.join(', ')}` : ''}

# EXISTING IMPLEMENTATION PLAN / NOTES:
${implementationPlan || 'No prior implementation plan or notes provided.'}

# ADDITIONAL CONTEXT FROM USER:
${additionalContext || 'None provided.'}

# ${formattedProjectContext}

# INSTRUCTIONS:
Based *only* on the information provided above, provide concrete and actionable implementation assistance. Your response **must** include the following sections clearly marked:

1.  **Code Implementation:**
    *   Provide relevant code snippets, examples, or pseudocode directly applicable to the task.
    *   If the plan is detailed, focus on the next logical steps.
    *   If no plan exists, propose a starting point with code.
    *   Ensure code follows best practices relevant to the inferred project context (if possible).

2.  **Technical Guidance:**
    *   Address any challenging aspects mentioned or implied in the task or plan.
    *   Explain complex concepts clearly and concisely.
    *   Suggest specific libraries, tools, or approaches if appropriate.

3.  **Potential Pitfalls & Best Practices:**
    *   Highlight potential issues the developer might encounter.
    *   Recommend relevant best practices (e.g., error handling, security, performance, testing) specific to this task.

4.  **Testing Strategies:**
    *   Suggest specific unit tests, integration tests, or manual testing steps relevant to the provided code or guidance.

**Output Format:**
*   Use Markdown for formatting.
*   Clearly separate the sections using the headings specified above.
*   Be concise but thorough.
*   Focus on practical, immediate steps the developer can take.
*   If the provided information is insufficient to give meaningful help, state that clearly and suggest what additional information is needed.
`;
        const result = await llmManager.sendRequest({
            prompt: implementationPrompt,
            taskName: "help-implement-task"
        });
        taskManager.addTaskNote(taskId, `# Implementation Assistance\n\n${result.text}`, 'AI Implementation Assistant', 'solution');
        if (task.status === TaskStatus.TODO || task.status === TaskStatus.BACKLOG) {
            taskManager.updateTask(taskId, { status: TaskStatus.IN_PROGRESS });
            logger.info(`Task ${taskId} status updated to IN_PROGRESS.`);
        }
        logger.info(`Successfully provided implementation assistance for task: ${taskId}`);
        const resultText = `# Implementation Assistance for "${task.title}"\n\n${result.text}\n\n_This implementation guidance has been saved as a solution note on the task. The task status has been updated to "in_progress" if it was previously "todo" or "backlog"._`;
        const suggested_actions = [
            {
                tool_name: "get-task",
                parameters: { id: taskId },
                reason: "Review the task and the new implementation assistance note.",
                user_facing_suggestion: `View task '${task.title}' with new assistance?`
            },
            {
                tool_name: "add-task-note",
                parameters: { taskId: taskId, content: "Followed AI assistance: ", author: "User", type: "progress" },
                reason: "Log progress after applying the AI's implementation help.",
                user_facing_suggestion: `Add a progress note to '${task.title}'?`
            }
        ];
        return {
            content: [
                {
                    type: "text",
                    text: resultText
                }
            ],
            suggested_actions
        };
    }
    catch (error) {
        logger.error('Error providing implementation assistance:', { error, taskId: params.taskId });
        return {
            content: [
                {
                    type: "text",
                    text: `Error providing implementation assistance for ${params.taskId}: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=helpImplementTaskHandler.js.map