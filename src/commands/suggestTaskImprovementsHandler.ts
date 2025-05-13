import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { ToolResultWithNextSteps, SuggestedAction } from "../core/types.js";

export const SuggestTaskImprovementsSchema = {
  taskId: z.string().describe("ID of the task")
};

export async function suggestTaskImprovementsHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof SuggestTaskImprovementsSchema>>
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

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
        ],
        isError: true
      };
    }

    const suggestions = await taskManager.suggestTaskImprovements(taskId);
    logger.info(`Successfully generated task improvement suggestions for: ${taskId}`);

    const resultText = `# Improvement Suggestions for "${task.title}"\n\n${suggestions}\n\n_These suggestions have been saved as a note on the task._`;
    const suggested_actions: SuggestedAction[] = [
        {
            tool_name: "get-task",
            parameters: { id: taskId },
            reason: "Review the task and the new improvement suggestions.",
            user_facing_suggestion: `View task '${task.title}' with improvement suggestions?`
        },
        {
            tool_name: "update-task",
            parameters: { id: taskId  },
            reason: "Apply suggested improvements to the task.",
            user_facing_suggestion: `Update task '${task.title}' based on suggestions?`
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
    logger.error('Error generating task improvement suggestions:', { error, taskId: params.taskId });
    return {
      content: [
        {
          type: "text",
          text: `Error generating task improvement suggestions for ${params.taskId}: ${error.message || String(error)}`
        }
      ],
      isError: true
    };
  }
}
