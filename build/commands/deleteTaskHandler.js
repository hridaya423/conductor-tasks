import { z } from "zod";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
export const DeleteTaskSchema = {
    id: z.string().describe("ID of the task to delete")
};
export async function deleteTaskHandler(taskManager, params) {
    const notInitializedResult = checkTaskManagerInitialized(taskManager);
    if (notInitializedResult)
        return notInitializedResult;
    try {
        const { id } = params;
        logger.info(`Deleting task with ID: ${id}`);
        const result = taskManager.deleteTask(id);
        if (!result) {
            logger.warn(`Task not found or could not be deleted: ${id}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: Task with ID ${id} not found or could not be deleted`
                    }
                ],
                isError: true
            };
        }
        logger.info(`Task ${id} deleted successfully`);
        const suggested_actions = [
            {
                tool_name: "list-tasks",
                reason: "View the updated list of tasks after deletion.",
                user_facing_suggestion: "List tasks to see the changes?"
            }
        ];
        return {
            content: [
                {
                    type: "text",
                    text: `Task ${id} deleted successfully`
                }
            ],
            suggested_actions
        };
    }
    catch (error) {
        logger.error('Error deleting task:', { error, taskId: params.id });
        return {
            content: [
                {
                    type: "text",
                    text: `Error deleting task ${params.id}: ${error.message || String(error)}`
                }
            ],
            isError: true
        };
    }
}
//# sourceMappingURL=deleteTaskHandler.js.map