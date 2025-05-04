import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";

export const DeleteTaskSchema = {
  id: z.string().describe("ID of the task to delete")
};

export async function deleteTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof DeleteTaskSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const notInitialized = checkTaskManagerInitialized(taskManager);
  if (notInitialized) return notInitialized;

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
        ]
      };
    }

    logger.info(`Task ${id} deleted successfully`);
    return {
      content: [
        {
          type: "text",
          text: `Task ${id} deleted successfully`
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error deleting task:', { error, taskId: params.id });
    return {
      content: [
        {
          type: "text",
          text: `Error deleting task ${params.id}: ${error.message || String(error)}`
        }
      ]
    };
  }
}
