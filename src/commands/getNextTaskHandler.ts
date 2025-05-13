import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { TaskStatus, ToolResultWithNextSteps, SuggestedAction } from "../core/types.js";

export const GetNextTaskSchema = {};

export async function getNextTaskHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof GetNextTaskSchema>>
): Promise<ToolResultWithNextSteps> {
  const notInitializedResult = checkTaskManagerInitialized(taskManager);
  if (notInitializedResult) return notInitializedResult;

  try {
    logger.info('Getting next task');
    const nextTask = taskManager.getNextTask();

    if (!nextTask) {
      logger.info('No next task available');
      const suggested_actions: SuggestedAction[] = [
        {
            tool_name: "create-task",
            parameters: { title: "New Task", description: "Details for the new task." },
            reason: "No tasks are available, create one to get started.",
            user_facing_suggestion: "No tasks available. Create a new task?"
        },
        {
            tool_name: "list-tasks",
            parameters: { status: "backlog" },
            reason: "Check if there are tasks in the backlog that can be moved to 'todo'.",
            user_facing_suggestion: "View backlog tasks?"
        }
      ];
      return {
        content: [
          {
            type: "text",
            text: "No next task available. Consider creating a new task or reviewing your backlog."
          }
        ],
        suggested_actions
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

    const suggested_actions: SuggestedAction[] = [
        {
            tool_name: "update-task",
            parameters: { id: nextTask.id, status: "in_progress" },
            reason: "Start working on this task by marking it as 'in_progress'.",
            user_facing_suggestion: `Start working on '${nextTask.title}'?`
        },
        {
            tool_name: "generate-steps",
            parameters: { taskId: nextTask.id },
            reason: "Generate an implementation plan for this task.",
            user_facing_suggestion: `Generate implementation plan for '${nextTask.title}'?`
        }
    ];

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
    logger.error('Error getting next task:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error getting next task: ${error.message || String(error)}`
        }
      ],
      isError: true
    };
  }
}
