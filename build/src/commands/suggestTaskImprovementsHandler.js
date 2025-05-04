import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
export const SuggestTaskImprovementsSchema = {
    taskId: z.string().describe("ID of the task")
};
export async function suggestTaskImprovementsHandler(taskManager, params) {
    const notInitialized = checkTaskManagerInitialized(taskManager);
    if (notInitialized)
        return notInitialized;
    try {
        const { taskId } = params;
        logger.info(`Generating task improvement suggestions for: ${taskId}`);
        const task = taskManager.getTask(taskId);
        if (!task) {
            logger.warn(`Task not found for suggesting improvements: ${taskId}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: Task with ID ${taskId} not found.`
                    }
                ]
            };
        }
        const suggestions = await taskManager.suggestTaskImprovements(taskId);
        logger.info(`Successfully generated task improvement suggestions for: ${taskId}`);
        return {
            content: [
                {
                    type: "text",
                    text: `# Improvement Suggestions for "${task.title}"\n\n${suggestions}\n\n_These suggestions have been saved as a note on the task._`
                }
            ]
        };
    }
    catch (error) {
        logger.error('Error generating task improvement suggestions:', { error, taskId: params.taskId });
        return {
            content: [
                {
                    type: "text",
                    text: `Error generating task improvement suggestions for ${params.taskId}: ${error.message || String(error)}`
                }
            ]
        };
    }
}
//# sourceMappingURL=suggestTaskImprovementsHandler.js.map