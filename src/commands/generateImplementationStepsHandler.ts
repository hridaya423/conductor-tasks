import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction } from "../core/types.js";

export const GenerateImplementationStepsSchema = {
  taskId: z.string().describe("ID of the task")
};

export async function generateImplementationStepsHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof GenerateImplementationStepsSchema>>
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

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
        ],
        isError: true
      };
    }

    const implementationSteps = await taskManager.generateImplementationSteps(taskId);
    logger.info(`Successfully generated implementation steps for task: ${taskId}`);

    const resultText = `# Implementation Plan for "${task.title}"\n\n${implementationSteps}\n\n_This implementation plan has been saved as a solution note on the task._`;
    const suggested_actions: SuggestedAction[] = [
        {
            tool_name: "get-task",
            parameters: { id: taskId },
            reason: "View the task to see the generated implementation steps in its notes.",
            user_facing_suggestion: `View task '${task.title}' to see the new implementation plan?`
        },
        {
            tool_name: "update-task",
            parameters: { id: taskId, status: "todo" }, 
            reason: "Move task to 'todo' if it's ready to be worked on with the new plan.",
            user_facing_suggestion: `Mark task '${task.title}' as 'todo'?`
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
  } catch (error: any) {
    logger.error('Error generating implementation steps:', { error, taskId: params.taskId });
    return {
      content: [
        {
          type: "text",
          text: `Error generating implementation steps for ${params.taskId}: ${error.message || String(error)}`
        }
      ],
      isError: true
    };
  }
}
