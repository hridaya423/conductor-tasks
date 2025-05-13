import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction } from "../core/types.js";

export const DeleteTaskSchema = {
  id: z.string().describe("ID of the task to delete")
};

export async function deleteTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof DeleteTaskSchema>>
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

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
    const suggested_actions: SuggestedAction[] = [
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
  } catch (error: any) {
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
