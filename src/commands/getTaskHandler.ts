import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { Task, ToolResultWithNextSteps, SuggestedAction, TaskStatus } from "../core/types.js";

export const GetTaskSchema = {
  id: z.string().describe("ID of the task to retrieve")
};

export async function getTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof GetTaskSchema>>
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

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
        ],
        isError: true
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

    const suggested_actions: SuggestedAction[] = [
      {
        tool_name: "update-task",
        parameters: { id: task.id, status: task.status  },
        reason: "Update the task's status, priority, or other details.",
        user_facing_suggestion: `Update task '${task.title}'?`
      },
      {
        tool_name: "add-task-note",
        parameters: { taskId: task.id, content: "", author: "User", type: "comment" },
        reason: "Add a note to this task.",
        user_facing_suggestion: `Add a note to '${task.title}'?`
      }
    ];
    if (task.status !== TaskStatus.DONE) {
        suggested_actions.push({
            tool_name: "generate-steps",
            parameters: { taskId: task.id },
            reason: "Generate or refresh the implementation plan for this task.",
            user_facing_suggestion: `Generate implementation steps for '${task.title}'?`
        });
    }


    return {
      content: [
        {
          type: "text",
          text: textResponse
        }
      ],
      suggested_actions
    };
  } catch (error: any) {
    logger.error('Error retrieving task:', { error, taskId: params.id });
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving task ${params.id}: ${error.message || String(error)}`
        }
      ],
      isError: true
    };
  }
}
