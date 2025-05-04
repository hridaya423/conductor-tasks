import { z } from "zod";
import { TaskManager } from "../task/taskManager.js";
import { TaskPriority, TaskStatus, Task } from "../core/types.js";
import logger from "../core/logger.js";

export const ListTasksSchema = {
  status: z.enum(["backlog", "todo", "in_progress", "review", "done", "blocked"]).optional().describe("Filter by status"),
  priority: z.enum(["critical", "high", "medium", "low", "backlog"]).optional().describe("Filter by priority level"),
  tags: z.array(z.string()).optional().describe("Filter by tags (any match)"),
  sortBy: z.enum(["priority", "dueDate", "createdAt", "updatedAt", "complexity"]).optional().describe("Field to sort by"),
  sortDirection: z.enum(["asc", "desc"]).optional().describe("Sort direction")
};

function checkTaskManagerInitialized(taskManager: TaskManager): { content: { type: "text"; text: string }[] } | null {
  if (taskManager.isInitialized() || taskManager.getTaskCount() > 0) {
     taskManager.reloadTasks();
     return null;
  }
  return {
    content: [
      {
        type: "text",
        text: "Task system is not initialized. Please run 'initialize-tasks' command first."
      }
    ]
  };
}

export async function listTasksHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof ListTasksSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  const notInitialized = checkTaskManagerInitialized(taskManager);
  if (notInitialized) return notInitialized;

  try {
    const { status, priority, tags, sortBy, sortDirection } = params;
    let statusFilter: TaskStatus | TaskStatus[] | undefined;
    let priorityFilter: TaskPriority | TaskPriority[] | undefined;

    if (status) {
      switch (status) {
        case "backlog": statusFilter = TaskStatus.BACKLOG; break;
        case "todo": statusFilter = TaskStatus.TODO; break;
        case "in_progress": statusFilter = TaskStatus.IN_PROGRESS; break;
        case "review": statusFilter = TaskStatus.REVIEW; break;
        case "done": statusFilter = TaskStatus.DONE; break;
        case "blocked": statusFilter = TaskStatus.BLOCKED; break;
      }
    }

    if (priority) {
      switch (priority) {
        case "critical": priorityFilter = TaskPriority.CRITICAL; break;
        case "high": priorityFilter = TaskPriority.HIGH; break;
        case "medium": priorityFilter = TaskPriority.MEDIUM; break;
        case "low": priorityFilter = TaskPriority.LOW; break;
        case "backlog": priorityFilter = TaskPriority.BACKLOG; break;
      }
    }

    logger.info('Listing tasks with filters', { status, priority, tags, sortBy, sortDirection });

    const tasks = taskManager.getTasks({
      status: statusFilter,
      priority: priorityFilter,
      tags,
      sortBy,
      sortDirection: sortDirection as "asc" | "desc"
    });

    if (tasks.length === 0) {
      logger.info('No tasks found matching criteria');
      return {
        content: [
          {
            type: "text",
            text: "No tasks found matching the criteria."
          }
        ]
      };
    }

    let response = `# Tasks (${tasks.length})\n\n`;
    tasks.forEach(task => {
      const progress = taskManager.calculateTaskProgress(task.id);
      const progressBar = progress > 0
        ? `[${"█".repeat(Math.floor(progress / 10))}${" ".repeat(10 - Math.floor(progress / 10))}] ${progress}%`
        : "Not started";

      response += `## ${task.title}\n`;
      response += `**ID**: ${task.id}\n`;
      response += `**Status**: ${task.status}\n`;
      response += `**Priority**: ${task.priority}\n`;
      response += `**Progress**: ${progressBar}\n`;
      if (task.tags && task.tags.length > 0) {
        response += `**Tags**: ${task.tags.join(", ")}\n`;
      }
      response += `\n${task.description.substring(0, 150)}${task.description.length > 150 ? "..." : ""}\n\n`;
      response += "---\n\n";
    });

    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error retrieving tasks:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving tasks: ${error.message || String(error)}`
        }
      ]
    };
  }
}
