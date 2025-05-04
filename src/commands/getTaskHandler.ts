import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { Task } from "../core/types.js";

export const GetTaskSchema = {
  id: z.string().describe("ID of the task to retrieve")
};

export async function getTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof GetTaskSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const notInitialized = checkTaskManagerInitialized(taskManager);
  if (notInitialized) return notInitialized;

  try {
    const { id } = params;
    logger.info(`Getting task details for ID: ${id}`);
    const task = taskManager.getTask(id);

    if (!task) {
      logger.warn(`Task not found: ${id}`);
      return {
        content: [
          {
            type: "text",
            text: `Task with ID ${id} not found`
          }
        ]
      };
    }

    let notesFormatted = '';
    if (task.notes && task.notes.length > 0) {
      notesFormatted = '\n\n## Notes\n\n';
      for (const note of task.notes) {
        const date = new Date(note.timestamp).toLocaleString();
        notesFormatted += `**${note.type}** by ${note.author} (${date}):\n${note.content}\n\n`;
      }
    }

    let subtasksText = '';
    if (task.subtasks && task.subtasks.length > 0) {
      subtasksText = '\n\n## Subtasks\n\n';
      for (const subtaskId of task.subtasks) {
        const subtask = taskManager.getTask(subtaskId);
        if (subtask) {
          const status = subtask.status === 'done' ? '✅' : '⬜';
          subtasksText += `${status} ${subtask.title} (${subtask.id})\n`;
        }
      }
    }

    const textResponse = `# ${task.title}\n\n` +
                        `**ID:** ${task.id}\n` +
                        `**Status:** ${task.status}\n` +
                        `**Priority:** ${task.priority}\n` +
                        `**Complexity:** ${task.complexity}/10\n` +
                        `**Created:** ${new Date(task.createdAt).toLocaleString()}\n` +
                        `**Updated:** ${new Date(task.updatedAt).toLocaleString()}\n` +
                        `**Tags:** ${task.tags.join(', ') || 'None'}\n\n` +
                        `## Description\n\n${task.description}\n` +
                        subtasksText +
                        notesFormatted;

    return {
      content: [
        {
          type: "text",
          text: textResponse
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error retrieving task:', { error, taskId: params.id });
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving task ${params.id}: ${error.message || String(error)}`
        }
      ]
    };
  }
}
