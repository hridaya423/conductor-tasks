import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
export const ExpandTaskSchema = {
    taskId: z.string().describe("ID of the task"),
    expansionPrompt: z.string().optional().describe("Additional requirements or context for the task expansion")
};
export async function expandTaskHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { taskId, expansionPrompt } = params;
        logger.info(`Expanding task: ${taskId}`, { expansionPrompt: !!expansionPrompt });
        const task = taskManager.getTask(taskId);
        if (!task) {
            logger.warn(`Task not found for expansion: ${taskId}`);
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
        const expansion = await taskManager.expandTask(taskId, expansionPrompt);
        const updatedTask = taskManager.getTask(taskId);
        const subtasksCount = updatedTask?.subtasks ? updatedTask.subtasks.length : 0;
        logger.info(`Successfully expanded task ${taskId}, new subtask count: ${subtasksCount}`);
        const resultText = `# Task Expansion for "${task.title}"\n\n${expansion}\n\n_The task has been updated with an expanded description and ${subtasksCount} subtasks._`;
        const suggested_actions = [
            {
                tool_name: "get-task",
                parameters: { id: taskId },
                reason: "View the expanded task details and new subtasks.",
                user_facing_suggestion: `View expanded task '${task.title}'?`
            }
        ];
        if (subtasksCount > 0 && updatedTask?.subtasks) {
            suggested_actions.push({
                tool_name: "get-task",
                parameters: { id: updatedTask.subtasks[0] },
                reason: "View the first new subtask.",
                user_facing_suggestion: `View first new subtask for '${task.title}'?`
            });
        }
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
        logger.error('Error expanding task:', { error, taskId: params.taskId });
        return {
            content: [
                {
                    type: "text",
                    text: `Error expanding task ${params.taskId}: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=expandTaskHandler.js.map