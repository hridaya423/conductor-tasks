import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";

export const AddTaskNoteSchema = {
  taskId: z.string().describe("ID of the task"),
  content: z.string().describe("Content of the note"),
  author: z.string().describe("Name of the person adding the note"),
  type: z.enum(["progress", "comment", "blocker", "solution"]).describe("Type of note")
};

export async function addTaskNoteHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof AddTaskNoteSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const notInitialized = checkTaskManagerInitialized(taskManager);
  if (notInitialized) return notInitialized;

  try {
    const { taskId, content, author, type } = params;
    logger.info(`Adding ${type} note to task ${taskId}`, { author });

    const note = taskManager.addTaskNote(taskId, content, author, type);

    if (!note) {
      logger.warn(`Task not found for adding note: ${taskId}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: Task with ID ${taskId} not found.`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Note added to task ${taskId}:\n\n${content}`
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error adding note to task:', { error, taskId: params.taskId });
    return {
      content: [
        {
          type: "text",
          text: `Error adding note to task ${params.taskId}: ${error.message || String(error)}`
        }
      ]
    };
  }
}
