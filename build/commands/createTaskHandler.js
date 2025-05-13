import { z } from "zod";
import logger from "../core/logger.js";
export const CreateTaskSchema = {
    title: z.string().describe("Title of the task"),
    description: z.string().describe("Detailed description of the task"),
    additionalContext: z.string().optional().describe("Additional context that might help with task analysis")
};
const createTaskSchemaObject = z.object(CreateTaskSchema);
function extractTaskIdFromResult(resultText) {
    const match = resultText.match(/ID: (task-\w+-\w+)/);
    return match ? match[1] : null;
}
export async function createTaskHandler(taskManager, params) {
    try {
        const { title, description, additionalContext } = params;
        logger.info(`Task creation requested: "${title}"`);
        const resultText = await taskManager.mcpCreateTask(title, description, additionalContext);
        const taskId = extractTaskIdFromResult(resultText);
        const suggested_actions = [];
        if (taskId) {
            suggested_actions.push({
                tool_name: "get-task",
                parameters: { id: taskId },
                reason: "View the details of the newly created task.",
                user_facing_suggestion: `View details for new task '${title}' (ID: ${taskId})?`
            });
            suggested_actions.push({
                tool_name: "add-task-note",
                parameters: { taskId: taskId, content: "Initial thoughts: ", author: "User", type: "comment" },
                reason: "Add initial notes or context to the new task.",
                user_facing_suggestion: `Add a note to task '${title}'?`
            });
        }
        return {
            content: [
                {
                    type: "text",
                    text: resultText,
                },
            ],
            suggested_actions: suggested_actions.length > 0 ? suggested_actions : undefined,
        };
    }
    catch (error) {
        logger.error('Error creating task:', {
            error,
            title: params.title,
            description: params.description?.substring(0, 100)
        });
        return {
            content: [
                {
                    type: "text",
                    text: `Error creating task: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=createTaskHandler.js.map