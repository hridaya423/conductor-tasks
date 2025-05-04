import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";

export const GenerateImplementationStepsSchema = {
  taskId: z.string().describe("ID of the task")
};

export async function generateImplementationStepsHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof GenerateImplementationStepsSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const notInitialized = checkTaskManagerInitialized(taskManager);
  if (notInitialized) return notInitialized;

  try {
    const { taskId } = params;
    logger.info(`Generating implementation steps for task: ${taskId}`);

    const task = taskManager.getTask(taskId);
    if (!task) {
      logger.warn(`Task not found for generating steps: ${taskId}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: Task with ID ${taskId} not found.`
          }
        ]
      };
    }

    const implementationSteps = await taskManager.generateImplementationSteps(taskId);
    logger.info(`Successfully generated implementation steps for task: ${taskId}`);

    return {
      content: [
        {
          type: "text",
          text: `# Implementation Plan for "${task.title}"\n\n${implementationSteps}\n\n_This implementation plan has been saved as a solution note on the task._`
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error generating implementation steps:', { error, taskId: params.taskId });
    return {
      content: [
        {
          type: "text",
          text: `Error generating implementation steps for ${params.taskId}: ${error.message || String(error)}`
        }
      ]
    };
  }
}
