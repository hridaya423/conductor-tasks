import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskStatus } from "../core/types.js";

export const GetNextTaskSchema = {};

export async function getNextTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof GetNextTaskSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const notInitialized = checkTaskManagerInitialized(taskManager);
  if (notInitialized) return notInitialized;

  try {
    logger.info('Getting next task');
    const nextTask = taskManager.getNextTask();

    if (!nextTask) {
      logger.info('No next task available');
      return {
        content: [
          {
            type: "text",
            text: "No tasks available. Create a new task first or check your filters."
          }
        ]
      };
    }

    logger.info(`Next task found: ${nextTask.id} - ${nextTask.title}`);

    let notesFormatted = '';
    if (nextTask.notes && nextTask.notes.length > 0) {
      notesFormatted = '\n\n## Notes\n\n';
      for (const note of nextTask.notes) {
        const date = new Date(note.timestamp).toLocaleString();
        notesFormatted += `**${note.type}** by ${note.author} (${date}):\n${note.content}\n\n`;
      }
    }

    let subtasksText = '';
    if (nextTask.subtasks && nextTask.subtasks.length > 0) {
      subtasksText = '\n\n## Subtasks\n\n';
      for (const subtaskId of nextTask.subtasks) {
        const subtask = taskManager.getTask(subtaskId);
        if (subtask) {
          const status = subtask.status === TaskStatus.DONE ? '✅' : '⬜';
          subtasksText += `${status} ${subtask.title} (${subtask.id})\n`;
        }
      }
    }

    const textResponse = `# Next Task: ${nextTask.title}\n\n` +
                        `**ID:** ${nextTask.id}\n` +
                        `**Status:** ${nextTask.status}\n` +
                        `**Priority:** ${nextTask.priority}\n` +
                        `**Complexity:** ${nextTask.complexity}/10\n\n` +
                        `## Description\n\n${nextTask.description}\n` +
                        subtasksText +
                        notesFormatted +
                        `\n\n## What to do?\n\nTo start working on this task, change its status to "in_progress":\n` +
                        `update-task --id ${nextTask.id} --status in_progress`;

    return {
      content: [
        {
          type: "text",
          text: textResponse
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error getting next task:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error getting next task: ${error.message || String(error)}`
        }
      ]
    };
  }
}
