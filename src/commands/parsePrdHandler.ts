import { z } from "zod";
import * as path from 'path';
import { TaskManager } from "../task/taskManager.js";
import { checkTaskManagerInitialized } from "../core/checkInit.js";
import logger from "../core/logger.js";
import { Task, TaskPriority } from "../core/types.js";

export const ParsePrdSchema = {
  prdContent: z.string().describe("Content of the PRD to parse"),
  createTasksFile: z.boolean().optional().default(true).describe("Whether to create/update the TASKS.md file")
};

export async function parsePrdHandler(
  taskManager: TaskManager,
  params: z.infer<z.ZodObject<typeof ParsePrdSchema>>
): Promise<{ content: { type: "text"; text: string }[] }> {
  try {
    const { prdContent, createTasksFile } = params;
    logger.info(`Parsing PRD content (length: ${prdContent.length}), createTasksFile: ${createTasksFile}`);

    
    console.log(`\n===== PRD CONTENT SAMPLE =====\n${prdContent.substring(0, 200)}...\n===== END PRD SAMPLE =====\n`);

    const notInitialized = checkTaskManagerInitialized(taskManager);
    if (notInitialized && createTasksFile) {
      
      const workspaceRoot = (taskManager as any).workspaceRoot || process.cwd();
      const defaultPath = path.resolve(path.join(workspaceRoot, 'TASKS.md'));
      
      logger.info(`Initializing task system at absolute path: ${defaultPath}`);
      await taskManager.initialize("PRD Project", "Project initialized from PRD parsing", defaultPath);
      logger.info("Task system automatically initialized for PRD parsing");
    } else if (notInitialized) {
      return notInitialized;
    }

    logger.info(`Sending PRD content to LLM for parsing...`);
    const taskIds = await taskManager.parsePRD(prdContent);
    logger.info(`PRD parsing complete, received ${taskIds.length} tasks`);

    if (taskIds.length === 0) {
      logger.warn('No tasks extracted from PRD content');
      return {
        content: [
          {
            type: "text",
            text: "No tasks could be extracted from the PRD. The document might be too short or not contain any clear requirements."
          }
        ]
      };
    }

    logger.info(`Extracted ${taskIds.length} tasks from PRD content`);
    const tasks = taskIds.map(id => taskManager.getTask(id)).filter(Boolean) as Task[];

    let taskListText = `# Tasks Created from PRD\n\n`;
    taskListText += `Total tasks: ${tasks.length}\n\n`;

    const priorityGroups: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (!priorityGroups[task.priority]) {
        priorityGroups[task.priority] = [];
      }
      priorityGroups[task.priority].push(task);
    });

    const priorityOrder = [TaskPriority.CRITICAL, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW, TaskPriority.BACKLOG];

    for (const priority of priorityOrder) {
      const tasksInPriority = priorityGroups[priority] || [];
      if (tasksInPriority.length > 0) {
        taskListText += `\n## ${priority} Priority Tasks\n\n`;
        tasksInPriority.forEach(task => {
          taskListText += `- ${task.title} (${task.id})\n`;
        });
      }
    }

    if (createTasksFile) {
      taskManager.saveTasks();
      const tasksFilePath = taskManager.getTasksFilePath();
      taskListText += `\n\n_Tasks have been saved to: ${tasksFilePath}_`;
      logger.info(`Tasks saved to ${tasksFilePath}`);
    }

    return {
      content: [
        {
          type: "text",
          text: taskListText
        }
      ]
    };
  } catch (error: any) {
    logger.error('Error parsing PRD content:', { error });
    return {
      content: [
        {
          type: "text",
          text: `Error parsing PRD: ${error.message || String(error)}`
        }
      ]
    };
  }
}
