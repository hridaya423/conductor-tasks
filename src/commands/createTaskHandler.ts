import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import logger from "../core/logger.js";

export const CreateTaskSchema = {
  title: z.string().describe("Title of the task"),
  description: z.string().describe("Detailed description of the task"),
  additionalContext: z.string().optional().describe("Additional context that might help with task analysis")
};

export async function createTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof CreateTaskSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  try {
    const { title, description, additionalContext } = params;
    const result = await taskManager.mcpCreateTask(title, description, additionalContext);
    logger.info(`Task creation requested: ${title}`);
    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error creating task:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error creating task: ${error.message || String(error)}`
        }
      ]
    };
  }
}
