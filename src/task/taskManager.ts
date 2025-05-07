import { Task, TaskPriority, TaskStatus, TaskNote, ContextPriority } from '../core/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { LLMManager } from '../llm/llmManager.js';
import { ContextManager } from '../core/contextManager.js';
import errorHandler, { ErrorCategory, ErrorSeverity, TaskError } from '../core/errorHandler.js';
import markdownRenderer from '../core/markdownRenderer.js';
import { ErrorHandler } from '../core/errorHandler.js';
import logger from '../core/logger.js';
import { JsonUtils } from '../core/jsonUtils.js';

const DEFAULT_CONFIG = {
  defaultSubtasks: 3,
  defaultPriority: TaskPriority.MEDIUM,
  tasksFileName: 'TASKS.md'
};


function detectWorkspaceDirectory(): string {
  
  if (process.env.WORKSPACE_FOLDER_PATHS) {
    const paths = process.env.WORKSPACE_FOLDER_PATHS.split(';');
    if (paths.length > 0 && paths[0]) {
      logger.info(`Using workspace path from WORKSPACE_FOLDER_PATHS: ${paths[0]}`);
      return paths[0];
    }
  }
  
  
  const cwd = process.cwd();
  logger.info(`No workspace path found, using current directory: ${cwd}`);
  return cwd;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private tasksFilePath: string = '';
  private workspaceRoot: string;
  private llmManager: LLMManager;
  private contextManager: ContextManager;
  private config: {
    defaultSubtasks: number;
    defaultPriority: TaskPriority;
    tasksFileName: string;
  };
  private initialized: boolean = false;

  constructor(llmManager: LLMManager, contextManager: ContextManager, tasksFilePath?: string) {
    this.llmManager = llmManager;
    this.contextManager = contextManager;

    this.workspaceRoot = detectWorkspaceDirectory();
    logger.info(`Using workspace root: ${this.workspaceRoot}`);
    
    
    try {
      process.chdir(this.workspaceRoot);
      logger.info(`Changed process.cwd() to workspace root: ${process.cwd()}`);
    } catch (err) {
      logger.warn(`Failed to change process.cwd() to workspace root: ${err}`);
    }

    this.config = {
      defaultSubtasks: this.getEnvInt('DEFAULT_SUBTASKS', DEFAULT_CONFIG.defaultSubtasks),
      defaultPriority: this.getEnvPriority('DEFAULT_PRIORITY', DEFAULT_CONFIG.defaultPriority),
      tasksFileName: process.env.TASKS_FILENAME || DEFAULT_CONFIG.tasksFileName
    };

    if (tasksFilePath) {
      this.setTasksFilePath(tasksFilePath);
    } else {
      this.tasksFilePath = path.join(this.workspaceRoot, this.config.tasksFileName);
    }

    logger.info(`Tasks file path set to: ${this.tasksFilePath}`);

    if (fs.existsSync(this.tasksFilePath)) {
      try {
        this.loadTasks();
        this.initialized = true;
        logger.info(`Successfully loaded tasks from ${this.tasksFilePath}`);
      } catch (error) {
        logger.error(`Failed to load tasks from ${this.tasksFilePath}`, { error });
      }
    }
  }

  private getEnvInt(key: string, defaultValue: number): number {
    return process.env[key] ? parseInt(process.env[key]!, 10) : defaultValue;
  }

  private getEnvPriority(key: string, defaultValue: TaskPriority): TaskPriority {
    if (!process.env[key]) return defaultValue;

    const value = process.env[key]!.toLowerCase();
    switch (value) {
      case 'critical': return TaskPriority.CRITICAL;
      case 'high': return TaskPriority.HIGH;
      case 'medium': return TaskPriority.MEDIUM;
      case 'low': return TaskPriority.LOW;
      case 'backlog': return TaskPriority.BACKLOG;
      default: return defaultValue;
    }
  }

  async initialize(projectName: string, projectDescription: string, filePath: string): Promise<void> {
    
    this.workspaceRoot = detectWorkspaceDirectory();
    logger.info(`Workspace root for initialization: ${this.workspaceRoot}`);
    
    try {
      process.chdir(this.workspaceRoot);
      logger.info(`Changed process.cwd() to workspace root: ${process.cwd()}`);
    } catch (err) {
      logger.warn(`Failed to change process.cwd() to workspace root: ${err}`);
    }
    
    const normalizedPath = this.normalizePath(filePath);
    logger.info(`Normalized file path for initialization: ${normalizedPath}`);

    if (fs.existsSync(normalizedPath)) {
      throw new Error(`Task file already exists at ${normalizedPath}. Cannot initialize a new task system at this location.`);
    }

    this.setTasksFilePath(normalizedPath);
    logger.info(`Setting tasks file path during initialization: ${this.tasksFilePath}`);

    this.contextManager.setProjectContext(
      `Project: ${projectName}\nDescription: ${projectDescription}`
    );

    await this.createEnhancedInitialTasksWithLLM(projectName, projectDescription);

    this.saveTasks();

    this.initialized = true;

    logger.info(`Task manager successfully initialized for project: ${projectName}`);
  }

  private createDefaultTasksTemplate(projectName: string, projectDescription: string): void {
    const now = new Date().toLocaleDateString();
    const setupTaskId = `task-${Date.now()}-setup`;

    const setupTask: Task = {
      id: setupTaskId,
      title: `Set up ${projectName}`,
      description: `Initial setup and configuration for the ${projectName} project.\n\n${projectDescription}`,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      complexity: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      dependencies: [],
      tags: ['setup', 'initialization'],
      notes: [
        {
          id: `note-${Date.now()}`,
          content: `Project initialized on ${now}`,
          timestamp: Date.now(),
          author: 'System',
          type: 'comment'
        }
      ]
    };

    this.tasks.set(setupTaskId, setupTask);

    logger.info(`Created default template with setup task: ${setupTaskId}`);
  }

  private async createEnhancedInitialTasksWithLLM(projectName: string, projectDescription: string): Promise<void> {
    try {
      this.createDefaultTasksTemplate(projectName, projectDescription);

      if (!this.llmManager.sendRequest) {
        logger.info('LLM not available, skipping enhanced initialization');
        return;
      }

      let codebaseContext = '';
      try {
        codebaseContext = await this.analyzeCodebase();
      } catch (error) {
        logger.warn('Failed to analyze codebase for initialization', error);
      }

      const prompt = `
You are a task management assistant. I'm setting up a new project and need you to suggest initial tasks.

Project: ${projectName}
Description: ${projectDescription}

${codebaseContext ? `Project Codebase Context:
${codebaseContext}` : ''}

Please suggest 3-5 initial tasks to get started with this project. For each task, provide:

1. TITLE: Short, descriptive title
2. DESCRIPTION: Detailed description
3. PRIORITY: One of critical, high, medium, low, or backlog
4. COMPLEXITY: Rating from 1-10 (10 being most complex)
5. TAGS: Relevant tags for categorization (comma-separated)
6. SUBTASKS: 2-3 smaller steps to complete the task

Format your response as follows for each task (separated by ---):

TITLE: [Task title]
DESCRIPTION: [Task description]
PRIORITY: [Priority level]
COMPLEXITY: [1-10]
TAGS: [tag1, tag2, tag3]
SUBTASKS:
- [Subtask 1 title]: [Subtask 1 description]
- [Subtask 2 title]: [Subtask 2 description]
- [Subtask 3 title]: [Subtask 3 description]

---

IMPORTANT: Use the exact format specified above with no deviations. Each task must have all the required fields.
`;

      try {
        const result = await this.llmManager.sendRequest({ prompt });

        let parsedTasks;
        try {
          parsedTasks = this.parseTasksFromLLMInit(result.text);
        } catch (parseError) {
          logger.error('Failed to parse LLM output for initialization', parseError);

          return;
        }

        if (parsedTasks.length > 0) {
          this.tasks.clear();
          logger.info(`Cleared default tasks to replace with ${parsedTasks.length} LLM-generated tasks`);
        } else {
          logger.info('No tasks parsed from LLM output, keeping default tasks');
          return;
        }

        for (const taskData of parsedTasks) {
          try {
            const taskId = await this.createTask(
              taskData.title,
              taskData.description
            );

            const task = this.tasks.get(taskId);
            if (task) {
              task.priority = this.stringToPriority(taskData.priority);

              task.complexity = Math.min(Math.max(1, taskData.complexity), 10);

              task.tags = taskData.tags || [];

              this.tasks.set(taskId, task);

              if (taskData.subtasks && taskData.subtasks.length > 0) {
                task.subtasks = [];

                for (const subtaskData of taskData.subtasks) {
                  try {
                    const subtaskId = await this.createSubtask(
                      taskId,
                      subtaskData.title,
                      subtaskData.description
                    );

                    if (subtaskId) {
                      logger.info(`Created subtask ${subtaskId} for task ${taskId}`);
                    }
                  } catch (subtaskError) {
                    logger.warn(`Failed to create subtask for task ${taskId}`, subtaskError);
                  }
                }
              }
            }
          } catch (taskCreateError) {
            logger.warn(`Failed to create task from LLM output`, taskCreateError);
          }
        }
      } catch (llmError) {
        logger.error('Failed to get LLM response for initialization', llmError);
      }
    } catch (error) {
      logger.error('Error during enhanced task initialization', error);

      if (this.tasks.size === 0) {
        this.createDefaultTasksTemplate(projectName, projectDescription);
      }
    }
  }

  private parseTasksFromLLMInit(llmOutput: string): Array<{
    title: string;
    description: string;
    priority: string;
    complexity: number;
    tags: string[];
    subtasks: Array<{ title: string; description: string }>;
  }> {
    const tasks: Array<{
      title: string;
      description: string;
      priority: string;
      complexity: number;
      tags: string[];
      subtasks: Array<{ title: string; description: string }>;
    }> = [];

    try {
      const taskBlocks = llmOutput.includes('---') 
        ? llmOutput.split('---').filter(block => block.trim().length > 0)
        : llmOutput.split(/\nTITLE: |\nTask \d+:/).filter((block, index) => 
            index === 0 ? block.toLowerCase().includes('title:') : block.trim().length > 0
          );

      if (taskBlocks.length === 0) {
        logger.warn('No task blocks found in LLM output');
        return tasks;
      }

      for (const block of taskBlocks) {
        try {
          const trimmedBlock = block.trim();
          if (trimmedBlock.length === 0) {
            continue;
          }

          const titleMatch = trimmedBlock.match(/TITLE: ?(.*?)(?:\n|$)/i) || 
                             trimmedBlock.match(/Task \d+: ?(.*?)(?:\n|$)/i);
          const descriptionMatch = trimmedBlock.match(/DESCRIPTION: ?(.*?)(?:\n[A-Z]+:|\nSUBTASKS:|\n---|\n\n|$)/is);
          const priorityMatch = trimmedBlock.match(/PRIORITY: ?(.*?)(?:\n|$)/i);
          const complexityMatch = trimmedBlock.match(/COMPLEXITY: ?(\d+)/i);
          const tagsMatch = trimmedBlock.match(/TAGS: ?(.*?)(?:\n|$)/i);

          if (!titleMatch || !titleMatch[1]) {
            logger.warn(`Skipping task block without title: ${trimmedBlock.substring(0, 50)}...`);
            continue;
          }

          const title = titleMatch[1].trim();
          const description = descriptionMatch && descriptionMatch[1] 
            ? descriptionMatch[1].trim() 
            : 'No description provided';
          const priority = priorityMatch && priorityMatch[1] 
            ? priorityMatch[1].trim().toLowerCase() 
            : 'medium';

          let complexity = 5;
          if (complexityMatch && complexityMatch[1]) {
            try {
              complexity = parseInt(complexityMatch[1], 10);
              if (isNaN(complexity) || complexity < 1 || complexity > 10) {
                complexity = 5;
              }
            } catch (complexityError) {
              logger.warn(`Could not parse complexity, using default (5): ${complexityMatch[1]}`);
            }
          }

          const tags: string[] = [];
          if (tagsMatch && tagsMatch[1] && tagsMatch[1].trim() !== '') {
            tagsMatch[1].split(',').forEach(tag => {
              const trimmedTag = tag.trim();
              if (trimmedTag && trimmedTag !== '') {
                tags.push(trimmedTag);
              }
            });
          }

          const subtasks: Array<{ title: string; description: string }> = [];
          const subtasksSection = trimmedBlock.match(/SUBTASKS:\s*([\s\S]*?)(?:\n---|\n\n|$)/i);

          if (subtasksSection && subtasksSection[1]) {
            const subtaskLines = subtasksSection[1].split('\n')
              .filter(line => line.trim().startsWith('-'))
              .map(line => line.trim().substring(1).trim());

            for (const line of subtaskLines) {
              if (!line || line.trim() === '') continue;

              const subtaskMatch = line.match(/(.*?): (.*)/);
              if (subtaskMatch) {
                subtasks.push({
                  title: subtaskMatch[1].trim(),
                  description: subtaskMatch[2].trim()
                });
              } else if (line.length > 0) {
                subtasks.push({
                  title: line,
                  description: 'No description provided'
                });
              }
            }
          }

          logger.info(`Successfully parsed task: ${title}`);

          tasks.push({
            title,
            description,
            priority,
            complexity,
            tags,
            subtasks
          });
        } catch (error) {
          logger.warn(`Failed to parse task block: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return tasks;
    } catch (error) {
      logger.error(`Failed to parse tasks from LLM output: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private stringToPriority(priority: string): TaskPriority {
    const p = priority.toLowerCase();
    if (p.includes('critical')) return TaskPriority.CRITICAL;
    if (p.includes('high')) return TaskPriority.HIGH;
    if (p.includes('medium')) return TaskPriority.MEDIUM;
    if (p.includes('low')) return TaskPriority.LOW;
    if (p.includes('backlog')) return TaskPriority.BACKLOG;
    return TaskPriority.MEDIUM;
  }

  async createTask(title: string, description: string, userInput?: string, parentId?: string): Promise<string> {
    
    if (!this.initialized && this.tasks.size === 0) {
      this.workspaceRoot = detectWorkspaceDirectory();
      logger.info(`Re-detected workspace root: ${this.workspaceRoot}`);
      
      
      if (!this.tasksFilePath || this.tasksFilePath === path.join(process.cwd(), this.config.tasksFileName)) {
        this.tasksFilePath = path.join(this.workspaceRoot, this.config.tasksFileName);
        logger.info(`Updated tasks file path to: ${this.tasksFilePath}`);
      }
    }
    
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const task: Task = {
      id: taskId,
      title,
      description,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.BACKLOG,
      complexity: 5,
      createdAt: now,
      updatedAt: now,
      dependencies: [],
      tags: [],
      notes: [],
      subtasks: [],
      parent: parentId
    };

    if (parentId) {
      const parentTask = this.tasks.get(parentId);
      if (parentTask) {
        if (!parentTask.subtasks) {
          parentTask.subtasks = [];
        }
        parentTask.subtasks.push(taskId);
        this.tasks.set(parentId, parentTask);
      }
    }

    await this.enhanceTaskWithLLM(task, userInput);

    this.tasks.set(taskId, task);
    this.saveTasks();

    this.contextManager.addContext(
      `Task ${task.id}: ${task.title}\nDescription: ${task.description}\nPriority: ${task.priority}\nComplexity: ${task.complexity}`,
      this.mapTaskPriorityToContextPriority(task.priority),
      'task-manager',
      ['task', task.id, ...task.tags]
    );

    return taskId;
  }

  private mapTaskPriorityToContextPriority(priority: TaskPriority): ContextPriority {
    switch (priority) {
      case TaskPriority.CRITICAL:
        return ContextPriority.CRITICAL;
      case TaskPriority.HIGH:
        return ContextPriority.ESSENTIAL;
      default:
        return ContextPriority.BACKGROUND;
    }
  }

  async createSubtask(parentId: string, title: string, description: string, userInput?: string): Promise<string | undefined> {
    const parentTask = this.tasks.get(parentId);
    if (!parentTask) {
      return undefined;
    }

    const subtaskId = await this.createTask(title, description, userInput, parentId);
    return subtaskId;
  }

  getSubtasks(taskId: string): Task[] {
    const task = this.tasks.get(taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) {
      return [];
    }

    return task.subtasks
      .map(subtaskId => this.tasks.get(subtaskId))
      .filter((subtask): subtask is Task => subtask !== undefined);
  }

  getSubtaskHierarchy(taskId: string): any {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const result: any = { ...task };

    if (task.subtasks && task.subtasks.length > 0) {
      result.subtaskDetails = task.subtasks.map(subtaskId => this.getSubtaskHierarchy(subtaskId));
    }

    return result;
  }

  areAllSubtasksComplete(taskId: string): boolean {
    const subtasks = this.getSubtasks(taskId);
    if (subtasks.length === 0) {
      return true;
    }

    return subtasks.every(subtask => 
      subtask.status === TaskStatus.DONE || this.areAllSubtasksComplete(subtask.id)
    );
  }

  calculateTaskProgress(taskId: string): number {
    const task = this.tasks.get(taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) {
      return task?.status === TaskStatus.DONE ? 100 : 0;
    }

    const subtasks = this.getSubtasks(taskId);
    if (subtasks.length === 0) {
      return 0;
    }

    const completedSubtasks = subtasks.filter(subtask => 
      subtask.status === TaskStatus.DONE || this.areAllSubtasksComplete(subtask.id)
    ).length;

    return Math.round((completedSubtasks / subtasks.length) * 100);
  }

  updateParentTaskStatus(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.parent) {
      return;
    }

    const parentTask = this.tasks.get(task.parent);
    if (!parentTask) {
      return;
    }

    const areAllComplete = this.areAllSubtasksComplete(parentTask.id);
    if (areAllComplete && parentTask.status !== TaskStatus.DONE) {
      parentTask.status = TaskStatus.DONE;
      parentTask.updatedAt = Date.now();
      this.tasks.set(parentTask.id, parentTask);
      this.saveTasks();

      if (parentTask.parent) {
        this.updateParentTaskStatus(parentTask.id);
      }
    }
  }

  private async enhanceTaskWithLLM(task: Task, userInput?: string): Promise<void> {
    return ErrorHandler.tryCatch(
      async () => {
        if (!this.llmManager.sendRequest) {
          logger.info(`LLM not available, skipping task enhancement for ${task.id}`);

          task.priority = task.priority || TaskPriority.MEDIUM;
          task.complexity = task.complexity || 5;
          task.tags = task.tags || [];

          return;
        }

        try {
          logger.info(`Enhancing task ${task.id} with LLM`);

          const projectContext = this.contextManager.getProjectContext?.() || '';

          let codebaseContext = '';

          const subtasks = this.getSubtasks(task.id);

          const prompt = `
# ROLE:
You are an expert Software Architect and Senior Developer. Your task is to create a detailed, actionable, step-by-step implementation plan for the given software development task.

# TASK DETAILS:
## Title: ${task.title}
${task.description ? `## Description:\n${task.description}` : ''}
${task.priority ? `## Priority: ${task.priority}` : ''}
${task.status ? `## Status: ${task.status}` : ''}
${task.tags && task.tags.length > 0 ? `## Tags: ${task.tags.join(', ')}` : ''}
${task.complexity ? `## Complexity: ${task.complexity}` : ''}

# TASK RELATIONSHIPS:
${task.parent ? `This is a subtask of: "${this.tasks.get(task.parent)?.title}"\nParent description: ${this.tasks.get(task.parent)?.description}\n\n` : 'This is a top-level task.\n'}
${task.parent ? `Related subtasks:\n${this.getSubtasks(task.parent).map(s => `- ${s.title}: ${s.description.substring(0, 100)}...`).join('\n')}` : 'No sibling subtasks identified.'}
${task.dependencies.length > 0 ? `Direct dependencies:\n${task.dependencies.map(depId => `- ${this.tasks.get(depId)?.title}: ${this.tasks.get(depId)?.description.substring(0, 100)}...`).join('\n')}` : 'No direct dependencies or dependents identified.'}

# PROJECT CONTEXT:
${projectContext || 'No specific project context provided.'}

# CODEBASE CONTEXT SUMMARY:
${codebaseContext || 'Codebase context analysis not available or failed.'}

# EXISTING SUBTASKS (if any):
${subtasks.length > 0 ? subtasks.map(s => `- ${s.title}: ${s.description ? s.description.substring(0,150) + '...' : '(No description)'}`).join('\n') : 'None'}

# INSTRUCTIONS:
Based *only* on the information provided above, generate a comprehensive, step-by-step implementation plan. The plan should be clear enough for another developer to follow.

**Output Format:** Use Markdown.
**MUST include the following sections:**

1.  **## Implementation Plan:**
    *   Provide a numbered list of specific, actionable steps from start to finish.
    *   Break down larger steps into smaller, manageable actions.
    *   Include code snippets, pseudocode, or configuration examples where helpful for clarity.
    *   Consider the order of operations and dependencies between steps.

2.  **## Key Considerations:**
    *   Highlight important technical decisions, potential challenges, or architectural points.
    *   Mention any assumptions made.
    *   Suggest specific libraries or tools if relevant and not already implied by the context.

3.  **## Verification & Testing:**
    *   Describe how to verify that each major step or the overall task is completed correctly.
    *   Suggest specific testing approaches (unit tests, integration tests, manual checks) relevant to the plan.

4.  **## Missing Information (Optional):**
    *   If critical information is missing to create a robust plan, clearly state what questions need to be answered or what details are required.

**Tone:** Professional, clear, and concise.
`;

          try {
            const result = await this.llmManager.sendRequest({ prompt });
            const llmOutput = result.text.trim();

            let metadata;
            try {
              metadata = JSON.parse(llmOutput);
            } catch (directParseError) {
              const jsonMatch = llmOutput.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  metadata = JSON.parse(jsonMatch[0]);
                } catch (regexParseError) {
                  try {
                    const cleanedJson = jsonMatch[0]
                      .replace(/'/g, '"')
                      .replace(/(\w+):/g, '"$1":')
                      .replace(/,\s*}/g, '}')
                      .replace(/,\s*\]/g, ']');

                    metadata = JSON.parse(cleanedJson);
                  } catch (cleanupError) {
                    logger.warn(`Failed to parse LLM response after cleanup attempts: ${llmOutput.substring(0, 100)}...`, { error: cleanupError });
                    this.setDefaultTaskMetadata(task);
                    return;
                  }
                }
              } else {
                logger.warn(`Could not find JSON object in LLM output: ${llmOutput.substring(0, 100)}...`);
                this.setDefaultTaskMetadata(task);
                return;
              }
            }

            if (metadata) {
              if (metadata.priority) {
                task.priority = metadata.priority as TaskPriority;
              }

              if (metadata.complexity) {
                task.complexity = Math.min(Math.max(1, Math.round(metadata.complexity)), 10);
              }

              if (metadata.tags && Array.isArray(metadata.tags)) {
                task.tags = metadata.tags.filter((tag: string) => typeof tag === 'string');
              }

              if (metadata.estimatedEffort) {
                task.estimatedEffort = metadata.estimatedEffort;
              }

              if (metadata.suggestedSubtasks && Array.isArray(metadata.suggestedSubtasks) && 
                  (!task.subtasks || task.subtasks.length === 0)) {
                task.subtasks = [];

                for (const subTaskData of metadata.suggestedSubtasks.slice(0, this.config.defaultSubtasks)) {
                  if (subTaskData.title && subTaskData.description) {
                    const subId = await this.createSubtask(
                      task.id,
                      subTaskData.title,
                      subTaskData.description
                    );

                    if (subId) {
                      logger.info(`Created subtask ${subId} for task ${task.id}`);
                    }
                  }
                }
              }

              task.updatedAt = Date.now();

              logger.info(`Successfully enhanced task ${task.id} with LLM`);
            } else {
              logger.warn(`Failed to extract metadata from LLM response: ${llmOutput.substring(0, 100)}...`);
              this.setDefaultTaskMetadata(task);
            }
          } catch (parseError) {
            logger.error(`LLM response parsing error for task ${task.id}`, parseError);
            this.setDefaultTaskMetadata(task);
          }
        } catch (outerError) {
          logger.error(`Unexpected error enhancing task ${task.id}`, { error: outerError });
          this.setDefaultTaskMetadata(task);
        }
      },
      ErrorCategory.LLM,
      'enhance_task_with_llm',
      { taskId: task.id }
    ) as unknown as void;
  }

  private setDefaultTaskMetadata(task: Task): void {
    task.priority = task.priority || TaskPriority.MEDIUM;
    task.complexity = task.complexity || 5;
    task.tags = task.tags || [];
    task.updatedAt = Date.now();

    logger.info(`Applied default metadata to task ${task.id} due to LLM enhancement failure`);
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    };

    this.tasks.set(id, updatedTask);
    this.saveTasks();

    return updatedTask;
  }

  addTaskNote(
    taskId: string, 
    content: string, 
    author: string, 
    type: "progress" | "comment" | "blocker" | "solution"
  ): TaskNote | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const note: TaskNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      content,
      timestamp: Date.now(),
      author,
      type
    };

    task.notes.push(note);
    task.updatedAt = Date.now();
    this.saveTasks();

    return note;
  }

  deleteTask(id: string): boolean {
    if (!this.tasks.has(id)) return false;

    this.tasks.delete(id);

    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(id)) {
        task.dependencies = task.dependencies.filter(depId => depId !== id);

        if (task.status === TaskStatus.BLOCKED) {
          if (task.dependencies.length === 0) {
            task.status = TaskStatus.TODO;
          }
        }
      }

      if (task.subtasks && task.subtasks.includes(id)) {
        task.subtasks = task.subtasks.filter(subId => subId !== id);
      }
    }

    this.saveTasks();
    return true;
  }

  getTasks(options: {
    status?: TaskStatus | TaskStatus[],
    priority?: TaskPriority | TaskPriority[],
    tags?: string[],
    sortBy?: "priority" | "dueDate" | "createdAt" | "updatedAt" | "complexity",
    sortDirection?: "asc" | "desc"
  } = {}): Task[] {
    const {
      status,
      priority,
      tags,
      sortBy = "priority",
      sortDirection = "desc"
    } = options;

    let filteredTasks = Array.from(this.tasks.values());

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      filteredTasks = filteredTasks.filter(task => statusArray.includes(task.status));
    }

    if (priority) {
      const priorityArray = Array.isArray(priority) ? priority : [priority];
      filteredTasks = filteredTasks.filter(task => priorityArray.includes(task.priority));
    }

    if (tags && tags.length > 0) {
      filteredTasks = filteredTasks.filter(task => 
        tags.some(tag => task.tags.includes(tag))
      );
    }

    filteredTasks.sort((a, b) => {
      let valueA, valueB;

      switch (sortBy) {
        case "priority":
          const priorityOrder = {
            [TaskPriority.CRITICAL]: 0,
            [TaskPriority.HIGH]: 1,
            [TaskPriority.MEDIUM]: 2,
            [TaskPriority.LOW]: 3,
            [TaskPriority.BACKLOG]: 4
          };
          valueA = priorityOrder[a.priority];
          valueB = priorityOrder[b.priority];
          break;

        case "dueDate":
          valueA = a.dueDate || Number.MAX_SAFE_INTEGER;
          valueB = b.dueDate || Number.MAX_SAFE_INTEGER;
          break;

        case "createdAt":
          valueA = a.createdAt;
          valueB = b.createdAt;
          break;

        case "updatedAt":
          valueA = a.updatedAt;
          valueB = b.updatedAt;
          break;

        case "complexity":
          valueA = a.complexity;
          valueB = b.complexity;
          break;

        default:
          valueA = a.updatedAt;
          valueB = b.updatedAt;
      }

      return sortDirection === "asc" 
        ? valueA - valueB 
        : valueB - valueA;
    });

    return filteredTasks;
  }

  getNextTask(): Task | undefined {
    const todoTasks = this.getTasks({ 
      status: TaskStatus.TODO,
      sortBy: "priority" 
    });

    return todoTasks[0];
  }

  getTasksNeedingAttention(): Task[] {
    const blockedTasks = this.getTasks({ status: TaskStatus.BLOCKED });
    const criticalTasks = this.getTasks({ 
      priority: TaskPriority.CRITICAL,
      status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS]
    });

    const dueSoonTasks = this.getTasks().filter(task => {
      if (!task.dueDate) return false;

      const dueIn48Hours = task.dueDate - Date.now() < 1000 * 60 * 60 * 48;
      return dueIn48Hours && task.status !== TaskStatus.DONE;
    });

    const allTasks = [...blockedTasks, ...criticalTasks, ...dueSoonTasks];
    const uniqueTasks = Array.from(new Map(allTasks.map(task => [task.id, task])).values());

    return this.sortTasksByPriority(uniqueTasks);
  }

  private sortTasksByPriority(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const priorityOrder = {
        [TaskPriority.CRITICAL]: 0,
        [TaskPriority.HIGH]: 1,
        [TaskPriority.MEDIUM]: 2,
        [TaskPriority.LOW]: 3,
        [TaskPriority.BACKLOG]: 4
      };

      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private extractJsonFromText(text: string): any {
    return JsonUtils.extractJsonArray(text, false);
  }

  async parsePRD(content: string): Promise<string[]> {
    return ErrorHandler.tryCatch(
      async () => {
        console.log(`Starting parsePRD in TaskManager with content length: ${content.length}`);
        
        
        if (!this.initialized && this.tasks.size === 0) {
          
          const workspaceBeforeRedetection = this.workspaceRoot;
          this.workspaceRoot = detectWorkspaceDirectory();
          
          
          if (this.workspaceRoot !== workspaceBeforeRedetection) {
            logger.info(`Re-detected workspace root: ${this.workspaceRoot}`);
          } else {
            logger.info(`Keeping current workspace root: ${this.workspaceRoot}`);
          }
          
          
          try {
            process.chdir(this.workspaceRoot);
            logger.info(`Changed process.cwd() to workspace root: ${process.cwd()}`);
          } catch (err) {
            logger.warn(`Failed to change process.cwd() to workspace root: ${err}`);
          }
          
          
          if (!this.tasksFilePath || this.tasksFilePath === path.join(process.cwd(), this.config.tasksFileName)) {
            
            const absoluteTasksPath = path.join(this.workspaceRoot, this.config.tasksFileName);
            this.tasksFilePath = absoluteTasksPath;
            logger.info(`Updated tasks file path to absolute path: ${this.tasksFilePath}`);
            
            
            const dirPath = path.dirname(this.tasksFilePath);
            if (!fs.existsSync(dirPath)) {
              logger.info(`Creating directory for tasks file: ${dirPath}`);
              try {
                fs.mkdirSync(dirPath, { recursive: true });
              } catch (err) {
                logger.warn(`Failed to create directory: ${err}`);
              }
            }
          }
        }
        
        const prompt = `
CRITICAL SYSTEM INSTRUCTION: You are a pure JSON response system.
Your ENTIRE response must be ONLY valid JSON with ABSOLUTELY NOTHING else.

# INPUT DOCUMENT (PRD):
${content}

# STRICTLY ENFORCE:
1. Response starts with opening bracket '['
2. Response ends with closing bracket ']'
3. NO text outside those brackets
4. NO explanations, no markdown, no code blocks
5. FIRST CHARACTER must be '['
6. LAST CHARACTER must be ']'

# REQUIRED JSON FORMAT:
[
  {
    "title": "Descriptive task title",
    "description": "Detailed implementation description",
    "priority": "critical|high|medium|low|backlog",
    "complexity": 5,
    "tags": ["frontend", "api"],
    "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
  }
]

CRITICAL WARNING: ANY TEXT OUTSIDE THE JSON WILL CAUSE A FATAL ERROR.
`;

        console.log(`Sending LLM request for PRD parsing...`);
          const result = await this.llmManager.sendRequest({ 
            prompt,
            systemPrompt: "CRITICAL: You are a JSON-only response system. Output raw JSON array ONLY with no other text or formatting.",
            options: {
              temperature: 0.05 
            }
          });
          
          console.log(`Received LLM response for PRD parsing. Length: ${result.text.length}`);
          console.log(`\n===== START LLM RESPONSE =====\n${result.text}\n===== END LLM RESPONSE =====\n`);
          
          const llmOutput = result.text.trim();

          
          let parsedTasks;
          try {
            
            parsedTasks = JsonUtils.ensureJsonArray(llmOutput);
            console.log(`Successfully extracted JSON data with ${parsedTasks.length} tasks`);
            
            if (parsedTasks.length === 0) {
              console.log(`WARNING: Extracted an empty JSON array`);
            }
          } catch (parseError) {
            console.log(`Failed to parse LLM response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            throw new Error(`Failed to parse LLM output into tasks: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
          
          console.log(`Processing ${parsedTasks.length} tasks from LLM response`);
          
          const taskIds: string[] = [];
          for (const taskData of parsedTasks) {
            try {
              const taskId = await this.createTask(
                taskData.title,
              taskData.description
              );
              
              const task = this.getTask(taskId);
            if (task) {
              if (taskData.priority) {
                task.priority = this.stringToPriority(taskData.priority);
              }
              
              if (taskData.complexity && typeof taskData.complexity === 'number') {
                task.complexity = Math.min(Math.max(1, taskData.complexity), 10);
              }
              
              if (taskData.tags && Array.isArray(taskData.tags)) {
                task.tags = taskData.tags;
              }
              
              this.tasks.set(taskId, task);
            }

              taskIds.push(taskId);
            } catch (taskError) {
            console.log(`Error creating task "${taskData.title}": ${taskError instanceof Error ? taskError.message : String(taskError)}`);
          }
        }

        console.log(`Created ${taskIds.length} tasks from parsed PRD.`);
        return taskIds;
      },
      ErrorCategory.PARSING,
      'parse_prd',
      { additionalInfo: { contentLength: content.length } },
      []
    );
  }

  loadTasks(): void {
    try {
      if (!this.tasksFilePath || !fs.existsSync(this.tasksFilePath)) {
        logger.warn(`Tasks file does not exist at ${this.tasksFilePath}`);
        return;
      }

      logger.info(`Loading tasks from: ${this.tasksFilePath}`);
      const tasksData = fs.readFileSync(this.tasksFilePath, 'utf8');
      
      
      this.parseMdToTasks(tasksData);
      
      logger.info(`Successfully loaded ${this.tasks.size} tasks from ${this.tasksFilePath}`);
    } catch (error) {
      errorHandler.handleError(
        new TaskError(
          `Failed to load tasks: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.FILESYSTEM,
          ErrorSeverity.ERROR,
          { operation: 'loadTasks', targetFile: this.tasksFilePath },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  saveTasks(): void {
    if (!this.tasksFilePath) {
      const defaultPath = path.join(this.workspaceRoot, this.config.tasksFileName);
      logger.warn(`No tasks file path set, defaulting to ${defaultPath}`);
      this.tasksFilePath = defaultPath;
    }

    try {
      logger.info(`Saving tasks to: ${this.tasksFilePath}`);
      const tasksData = markdownRenderer.renderTasksToMarkdown(this.tasks);

      
      const dirPath = path.dirname(this.tasksFilePath);
      if (!fs.existsSync(dirPath)) {
        logger.info(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }

      
      fs.writeFileSync(this.tasksFilePath, tasksData);
      logger.info(`Successfully saved tasks to ${this.tasksFilePath}`);
    } catch (error) {
      errorHandler.handleError(
        new TaskError(
          `Failed to save tasks: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.FILESYSTEM,
          ErrorSeverity.ERROR,
          { operation: 'saveTasks', targetFile: this.tasksFilePath },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  private tasksToMarkdown(): string {
    return markdownRenderer.renderTasksToMarkdown(this.tasks);
  }

  exportTasksToMarkdown(): string {
    return markdownRenderer.renderTasksToMarkdown(this.tasks);
  }

  private parseMdToTasks(markdown: string): void {
    try {
      this.tasks.clear();

      const taskRegex = /### .* \((task-[\w-]+)\)\n\n(?:.*\n)*?---/g;
      let match;

      while ((match = taskRegex.exec(markdown)) !== null) {
        const taskBlock = match[0];
        const taskId = match[1];

        const titleMatch = taskBlock.match(/### (.*) \(task-[\w-]+\)/);
        const priorityMatch = taskBlock.match(/\*\*Priority:\*\* ([\w]+)/);
        const complexityMatch = taskBlock.match(/\*\*Complexity:\*\* .*\(([\d]+)\/10\)/);
        const tagsMatch = taskBlock.match(/\*\*Tags:\*\* (.*?)\n/);
        const descriptionMatch = taskBlock.match(/\*\*Priority:.*\n\n(.*?)\n\n/s);

        if (titleMatch) {
          try {
            let title = titleMatch[1].trim();

            title = title.replace(/^[^\w]*/, '').trim();

            const task: Task = {
              id: taskId,
              title,
              description: descriptionMatch ? descriptionMatch[1].trim() : '',
              priority: priorityMatch ? priorityMatch[1] as TaskPriority : TaskPriority.MEDIUM,
              status: this.determineStatusFromMarkdown(taskBlock),
              complexity: complexityMatch ? parseInt(complexityMatch[1]) : 5,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              dependencies: [],
              tags: tagsMatch ? tagsMatch[1].split(', ').map(t => t.trim()) : [],
              notes: []
            };

            const dependenciesBlock = taskBlock.match(/\*\*Dependencies:\*\*\n((?:- .*?\n)*)/);
            if (dependenciesBlock) {
              const depLines = dependenciesBlock[1].trim().split('\n');
              for (const line of depLines) {
                const depId = line.match(/\((task-[\w-]+)\)/);
                if (depId) {
                  task.dependencies.push(depId[1]);
                }
              }
            }

            const subtasksBlock = taskBlock.match(/\*\*Subtasks:\*\*\n((?:- .*?\n)*)/);
            if (subtasksBlock) {
              task.subtasks = [];
              const subLines = subtasksBlock[1].trim().split('\n');
              for (const line of subLines) {
                const subId = line.match(/\((task-[\w-]+)\)/);
                if (subId) {
                  task.subtasks.push(subId[1]);
                }
              }
            }

            const notesBlock = taskBlock.match(/\*\*Notes:\*\*\n((?:- .*?\n)*)/);
            if (notesBlock) {
              const noteLines = notesBlock[1].trim().split('\n');
              for (const line of noteLines) {
                const noteTypeMatch = line.match(/\*\*([\w]+)\*\* \((.*?), (.*?)\): (.*)/);
                if (noteTypeMatch) {
                  const type = noteTypeMatch[1] as "progress" | "comment" | "blocker" | "solution";
                  const dateStr = noteTypeMatch[2];
                  const author = noteTypeMatch[3];
                  const content = noteTypeMatch[4];

                  const timestamp = new Date(dateStr).getTime() || Date.now();

                  task.notes.push({
                    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    content,
                    timestamp,
                    author,
                    type
                  });
                }
              }
            }

            this.tasks.set(taskId, task);
          } catch (taskParseError) {
            const error = errorHandler.createParsingError(
              `Error parsing individual task "${titleMatch[1]}" (${taskId})`,
              { 
                operation: 'parse_task', 
                taskId,
                additionalInfo: { taskBlock: taskBlock.substring(0, 100) + '...' }
              },
              ErrorSeverity.WARNING,
              taskParseError instanceof Error ? taskParseError : new Error(String(taskParseError))
            );

            errorHandler.handleError(error);
          }
        }
      }
    } catch (error) {
      const parseError = errorHandler.createParsingError(
        `Error parsing tasks from markdown`,
        { operation: 'parse_markdown', targetFile: this.tasksFilePath },
        ErrorSeverity.ERROR,
        error instanceof Error ? error : new Error(String(error))
      );

      errorHandler.handleError(parseError);
      throw parseError;
    }
  }

  private determineStatusFromMarkdown(taskBlock: string): TaskStatus {
    if (taskBlock.includes('## Backlog')) return TaskStatus.BACKLOG;
    if (taskBlock.includes('## To Do')) return TaskStatus.TODO;
    if (taskBlock.includes('## In Progress')) return TaskStatus.IN_PROGRESS;
    if (taskBlock.includes('## In Review')) return TaskStatus.REVIEW;
    if (taskBlock.includes('## Blocked')) return TaskStatus.BLOCKED;
    if (taskBlock.includes('## Done')) return TaskStatus.DONE;

    return TaskStatus.BACKLOG;
  }

  private getPriorityEmoji(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.CRITICAL: return '🔴';
      case TaskPriority.HIGH: return '🟠';
      case TaskPriority.MEDIUM: return '🟡';
      case TaskPriority.LOW: return '🟢';
      case TaskPriority.BACKLOG: return '⚪';
      default: return '';
    }
  }

  getTasksFilePath(): string {
    return this.tasksFilePath;
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  reloadTasks(): boolean {
    if (fs.existsSync(this.tasksFilePath)) {
      try {
        this.loadTasks();
        this.initialized = true;
        logger.info(`Successfully reloaded tasks from ${this.tasksFilePath}`);
        return true;
      } catch (error) {
        logger.error(`Failed to reload tasks from ${this.tasksFilePath}`, error);
        return false;
      }
    }
    return false;
  }

  async analyzeCodebase(): Promise<string> {
    const analysisDir = this.workspaceRoot;
    logger.info(`Analyzing codebase at ${analysisDir}`);

    const stats = {
      totalFiles: 0,
      totalLines: 0,
      fileTypes: new Map<string, number>(),
      topLevelDirs: new Map<string, number>(),
      languages: new Map<string, number>()
    };

    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'out', '.next', '.vscode', 'coverage'];

    const extensionToLanguage: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React JSX',
      '.tsx': 'React TSX',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.py': 'Python',
      '.java': 'Java',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.c': 'C',
      '.cpp': 'C++',
      '.cs': 'C#',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.md': 'Markdown',
      '.json': 'JSON',
      '.yml': 'YAML',
      '.yaml': 'YAML',
      '.toml': 'TOML',
      '.sh': 'Shell'
    };

    const importantFiles: Record<string, string> = {};
    const checkForImportantFiles = [
      'package.json', 'tsconfig.json', 'webpack.config.js', 'next.config.js',
      'vite.config.js', 'vite.config.ts', '.eslintrc.js', '.eslintrc.json',
      'jest.config.js', 'babel.config.js', 'README.md', 'CONTRIBUTING.md',
      'LICENSE', '.gitignore', 'docker-compose.yml', 'Dockerfile',
      'requirements.txt', 'Cargo.toml', 'pom.xml', 'build.gradle'
    ];

    const scanDirectory = (dirPath: string, isTopLevel = false): void => {
      if (!fs.existsSync(dirPath)) return;

      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);

        if (skipDirs.includes(item)) continue;

        try {
          const fileStats = fs.statSync(fullPath);

          if (fileStats.isDirectory()) {
            if (isTopLevel) {
              const count = stats.topLevelDirs.get(item) || 0;
              stats.topLevelDirs.set(item, count + 1);
            }
            scanDirectory(fullPath);
          } else if (fileStats.isFile()) {
            stats.totalFiles++;

            const ext = path.extname(item).toLowerCase();
            if (ext) {
              const count = stats.fileTypes.get(ext) || 0;
              stats.fileTypes.set(ext, count + 1);

              const language = extensionToLanguage[ext] || 'Other';
              const langCount = stats.languages.get(language) || 0;
              stats.languages.set(language, langCount + 1);
            }

            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const lines = content.split('\n').length;
              stats.totalLines += lines;

              if (checkForImportantFiles.includes(item)) {
                importantFiles[item] = fullPath;
              }
            } catch (error) {

            }
          }
        } catch (error) {

        }
      }
    };

    try {
      const rootItems = fs.readdirSync(analysisDir);
      for (const item of rootItems) {
        const fullPath = path.join(analysisDir, item);
        try {
          if (fs.statSync(fullPath).isDirectory() && !skipDirs.includes(item)) {
            const count = stats.topLevelDirs.get(item) || 0;
            stats.topLevelDirs.set(item, count + 1);
          }
        } catch (error) {

        }
      }

      scanDirectory(analysisDir, true);

      let summary = `# Codebase Summary for Project at ${analysisDir}\n\n`;

      summary += `## Overview\n`;
      summary += `- Total Files: ${stats.totalFiles}\n`;
      summary += `- Total Lines of Code: ${stats.totalLines}\n\n`;

      summary += `## Languages\n`;
      const sortedLanguages = Array.from(stats.languages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      for (const [language, count] of sortedLanguages) {
        const percentage = ((count / stats.totalFiles) * 100).toFixed(1);
        summary += `- ${language}: ${count} files (${percentage}%)\n`;
      }
      summary += '\n';

      summary += `## Project Structure\n`;
      const sortedDirs = Array.from(stats.topLevelDirs.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

      for (const [dir, _] of sortedDirs) {
        summary += `- ${dir}/\n`;
      }
      summary += '\n';

      summary += `## Configuration Files\n`;
      const foundImportantFiles = Object.keys(importantFiles);
      if (foundImportantFiles.length > 0) {
        for (const file of foundImportantFiles) {
          summary += `- ${file}\n`;
        }
      } else {
        summary += `- No common configuration files found\n`;
      }
      summary += '\n';

      let projectType = 'Unknown';

      if (importantFiles['package.json']) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(importantFiles['package.json'], 'utf8'));
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

          if (dependencies['next']) {
            projectType = 'Next.js';
          } else if (dependencies['react']) {
            projectType = 'React';
          } else if (dependencies['vue']) {
            projectType = 'Vue.js';
          } else if (dependencies['angular']) {
            projectType = 'Angular';
          } else if (dependencies['express']) {
            projectType = 'Express.js';
          } else if (dependencies['electron']) {
            projectType = 'Electron';
          } else {
            projectType = 'Node.js';
          }
        } catch (error) {

        }
      } else if (importantFiles['requirements.txt']) {
        projectType = 'Python';
      } else if (importantFiles['Cargo.toml']) {
        projectType = 'Rust';
      } else if (importantFiles['pom.xml'] || importantFiles['build.gradle']) {
        projectType = 'Java';
      }

      summary += `## Project Type\n`;
      summary += `- Detected Type: ${projectType}\n\n`;

      summary += `## Task Management\n`;
      summary += `This project is now using the integrated task management system. Tasks are stored in TASKS.md.\n`;
      summary += `Use the task management tools to organize and track work on this project.\n\n`;

      return summary;
    } catch (error: any) {
      logger.error('Error analyzing codebase:', error);
      return `Failed to analyze codebase: ${error.message}`;
    }
  }

  isInitialized(): boolean {
    return this.initialized || this.tasks.size > 0;
  }

  setTasksFilePath(filePath: string): void {
    const normalizedPath = this.normalizePath(filePath);
    logger.info(`Setting tasks file path to normalized path: ${normalizedPath}`);
    this.tasksFilePath = normalizedPath;
  }

  private normalizePath(filepath: string): string {
    logger.debug(`normalizePath input: ${filepath}`);
    
    let absolutePath = filepath;
    if (!path.isAbsolute(filepath)) {
      absolutePath = path.resolve(this.workspaceRoot, filepath);
      logger.debug(`Converted relative path to absolute: ${absolutePath}`);
    } else {
      logger.debug(`Path already absolute: ${absolutePath}`);
    }
    
    if (process.platform === 'win32') {
      if (absolutePath.startsWith('/') && absolutePath.includes('%3A/')) {
        const driveMatch = absolutePath.match(/\/([A-Za-z])%3A\//);
        if (driveMatch && driveMatch[1]) {
          const driveLetter = driveMatch[1];
          absolutePath = absolutePath.replace(`/${driveLetter}%3A/`, `${driveLetter}:/`);
          logger.debug(`Fixed Cursor-style encoded drive letter: ${absolutePath}`);
        }
      }
      
      absolutePath = path.win32.normalize(absolutePath);
    }
    
    const dirPath = path.dirname(absolutePath);
    if (path.extname(absolutePath) !== '' && !fs.existsSync(dirPath)) {
      logger.debug(`Creating directory for path: ${dirPath}`);
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (err) {
        logger.warn(`Failed to create directory: ${err}`);
      }
    }
    
    const finalPath = path.resolve(absolutePath);
    logger.debug(`normalizePath: final path: ${finalPath}`);
    return finalPath;
  }

  async generateImplementationSteps(taskId: string): Promise<string> {
    const task = this.tasks.get(taskId);
              if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const projectContext = this.contextManager.getProjectContext?.() || '';
    const subtasks = task.subtasks ? this.getSubtasks(taskId) : [];

    let parentContext = '';
    if (task.parent) {
      const parentTask = this.getTask(task.parent);
      if (parentTask) {
        parentContext = `This is a subtask of: "${parentTask.title}"\nParent description: ${parentTask.description}\n\n`;
      }
    }

    let siblingContext = '';
    if (task.parent) {
      const siblings = this.getSubtasks(task.parent).filter(t => t.id !== taskId);
      if (siblings.length > 0) {
        siblingContext = 'Related subtasks:\n' + 
          siblings.map(s => `- ${s.title}: ${s.description.substring(0, 100)}...`).join('\n');
      }
    }

    const relatedTasks = Array.from(this.tasks.values()).filter(t => 
      t.dependencies.includes(taskId) || task.dependencies.includes(t.id)
    );

    const relatedTasksContext = relatedTasks.length > 0 ? 
      'Related tasks:\n' + relatedTasks.map(t => 
        `- ${t.title} (${task.dependencies.includes(t.id) ? 'dependency' : 'dependent'}): ${t.description.substring(0, 100)}...`
      ).join('\n') : '';

    let codebaseContext = '';
    try {
      codebaseContext = await this.analyzeCodebase();
    } catch (error) {
      logger.warn('Failed to analyze codebase for implementation steps', error);
    }

    const prompt = `
# ROLE:
You are an expert Software Architect and Senior Developer. Your task is to create a detailed, actionable, step-by-step implementation plan for the given software development task.

# TASK DETAILS:
## Title: ${task.title}
${task.description ? `## Description:\n${task.description}` : ''}
${task.priority ? `## Priority: ${task.priority}` : ''}
${task.status ? `## Status: ${task.status}` : ''}
${task.tags && task.tags.length > 0 ? `## Tags: ${task.tags.join(', ')}` : ''}
${task.complexity ? `## Complexity: ${task.complexity}` : ''}

# TASK RELATIONSHIPS:
${task.parent ? `This is a subtask of: "${this.tasks.get(task.parent)?.title}"\nParent description: ${this.tasks.get(task.parent)?.description}\n\n` : 'This is a top-level task.\n'}
${task.parent ? `Related subtasks:\n${this.getSubtasks(task.parent).map(s => `- ${s.title}: ${s.description.substring(0, 100)}...`).join('\n')}` : 'No sibling subtasks identified.'}
${task.dependencies.length > 0 ? `Direct dependencies:\n${task.dependencies.map(depId => `- ${this.tasks.get(depId)?.title}: ${this.tasks.get(depId)?.description.substring(0, 100)}...`).join('\n')}` : 'No direct dependencies or dependents identified.'}

# PROJECT CONTEXT:
${projectContext || 'No specific project context provided.'}

# CODEBASE CONTEXT SUMMARY:
${codebaseContext || 'Codebase context analysis not available or failed.'}

# EXISTING SUBTASKS (if any):
${subtasks.length > 0 ? subtasks.map(s => `- ${s.title}: ${s.description ? s.description.substring(0,150) + '...' : '(No description)'}`).join('\n') : 'None'}

# INSTRUCTIONS:
Based *only* on the information provided above, generate a comprehensive, step-by-step implementation plan. The plan should be clear enough for another developer to follow.

**Output Format:** Use Markdown.
**MUST include the following sections:**

1.  **## Implementation Plan:**
    *   Provide a numbered list of specific, actionable steps from start to finish.
    *   Break down larger steps into smaller, manageable actions.
    *   Include code snippets, pseudocode, or configuration examples where helpful for clarity.
    *   Consider the order of operations and dependencies between steps.

2.  **## Key Considerations:**
    *   Highlight important technical decisions, potential challenges, or architectural points.
    *   Mention any assumptions made.
    *   Suggest specific libraries or tools if relevant and not already implied by the context.

3.  **## Verification & Testing:**
    *   Describe how to verify that each major step or the overall task is completed correctly.
    *   Suggest specific testing approaches (unit tests, integration tests, manual checks) relevant to the plan.

4.  **## Missing Information (Optional):**
    *   If critical information is missing to create a robust plan, clearly state what questions need to be answered or what details are required.

**Tone:** Professional, clear, and concise.
`;

    try {
      const result = await this.llmManager.sendRequest({ prompt });

      if (!this.tasks.has(taskId)) {
        throw new Error(`Task with ID ${taskId} was deleted while generating implementation steps`);
      }

      this.addTaskNote(
        taskId,
        result.text,
        'AI Assistant',
        'solution'
      );

      return result.text;
    } catch (error) {
      throw errorHandler.createLLMError(
        `Failed to generate implementation steps`,
        { operation: 'generate_implementation', taskId },
        ErrorSeverity.ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async expandTask(taskId: string, expansionPrompt?: string): Promise<string> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const projectContext = this.contextManager.getProjectContext?.() || '';

    const prompt = `
# ROLE:
You are an expert Project Manager and Business Analyst. Your goal is to enrich a given task by adding details, structure, and clarity.

# TASK TO EXPAND:
## Title: ${task.title}
${task.description ? `## Description:\n${task.description}` : '(No Description Provided)'}\n\n
# CURRENT METADATA:
*   Priority: ${task.priority}
*   Complexity: ${task.complexity || 'Not Set'}/10
*   Tags: ${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'}
*   Status: ${task.status}

# PROJECT CONTEXT:
${projectContext || 'No specific project context provided.'}\n\n
# ADDITIONAL EXPANSION REQUIREMENTS FROM USER:
${expansionPrompt || 'None provided.'}\n\n
# INSTRUCTIONS:
Based *only* on the information provided, expand and refine the task. Your response **must** include the following sections clearly marked:\n\n1.  **## Expanded Description:**\n    *   Rewrite the original description to be more detailed, specific, and clear.\n    *   Incorporate any relevant details from the project context or user requirements.\n    *   Ensure the description clearly states the goal of the task.\n\n2.  **## Suggested Metadata:**\n    *   Complexity: Suggest an appropriate complexity score (1-10), explaining your reasoning briefly. (Current: ${task.complexity || 'Not Set'})\n\n    *   Priority: Suggest an appropriate priority level (critical, high, medium, low, backlog), explaining briefly. (Current: ${task.priority})\n\n    *   Tags: Suggest 3-5 additional relevant tags, beyond the current ones (${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'})\n\n3.  **## Proposed Subtasks:**\n    *   Define 3-5 distinct, actionable subtasks required to complete the main task.\n    *   Format *exactly* as: \`- [Subtask Title]: [Brief subtask description]\` (one per line).\n\n    *   Ensure subtasks are logically sequenced if possible.\n\n4.  **## Acceptance Criteria:**\n    *   List 3-5 specific, measurable, achievable, relevant, and time-bound (SMART-like) criteria.\n    *   These criteria must clearly define what conditions must be met for the main task to be considered \"Done\".\n\n**Output Format:**\n*   Use Markdown.\n*   Strictly follow the section headings and formatting specified above.\n*   Be concise and focus on actionable improvements.\n`;

    try {
      const result = await this.llmManager.sendRequest({ prompt });

      if (!this.tasks.has(taskId)) {
        throw new Error(`Task with ID ${taskId} was deleted while expanding`);
      }

      const output = result.text;

      const subtaskRegex = /- ([^:]+): (.+)/g;
      const subtaskMatches = [...output.matchAll(subtaskRegex)];

      for (const match of subtaskMatches) {
        const subtaskTitle = match[1].trim();
        const subtaskDescription = match[2].trim();

        await this.createSubtask(taskId, subtaskTitle, subtaskDescription);
      }

      let expandedDescription = task.description;
      const descriptionMatch = output.match(/expanded and more detailed description[^:]*:(.+?)(?=#|$)/is);
      if (descriptionMatch && descriptionMatch[1]) {
        expandedDescription = descriptionMatch[1].trim();
      }

      let acceptanceCriteria = '';
      const criteriaMatch = output.match(/acceptance criteria[^:]*:(.+?)(?=#|$)/is);
      if (criteriaMatch && criteriaMatch[1]) {
        acceptanceCriteria = criteriaMatch[1].trim();
      }

      this.updateTask(taskId, {
        description: expandedDescription + (acceptanceCriteria ? '\n\n## Acceptance Criteria\n' + acceptanceCriteria : '')
      });

      this.addTaskNote(
        taskId,
        `# Task Expansion\n\n${output}`,
        'AI Assistant',
        'comment'
      );

      return output;
    } catch (error) {
      throw errorHandler.createLLMError(
        `Failed to expand task`,
        { operation: 'expand_task', taskId },
        ErrorSeverity.ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async suggestTaskImprovements(taskId: string): Promise<string> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const notes = task.notes || [];
    const subtasks = task.subtasks ? this.getSubtasks(taskId) : [];
    const progress = this.calculateTaskProgress(taskId);

    const prompt = `
# ROLE:
You are an expert Project Manager and Quality Assurance analyst. Your goal is to review a task and provide constructive, actionable suggestions for improvement.

# TASK TO REVIEW:
## Title: ${task.title}
${task.description ? `## Description:\n${task.description}` : '(No Description Provided)'}\n\n
# CURRENT METADATA & STATUS:
*   Priority: ${task.priority}
*   Complexity: ${task.complexity || 'Not Set'}/10
*   Status: ${task.status}
*   Progress: ${progress}% complete
*   Tags: ${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'}
*   Created: ${new Date(task.createdAt).toLocaleDateString()}
*   Last updated: ${new Date(task.updatedAt).toLocaleDateString()}

# ASSOCIATED NOTES (${notes.length}):
${notes.length > 0 ? notes.map(n => `- ${n.type.toUpperCase()} (${n.author || 'Unknown'} @ ${new Date(n.timestamp).toLocaleString()}): ${n.content.substring(0, 150)}...`).join('\n') : 'None'}\n\n
# CURRENT SUBTASKS (${subtasks.length}):
${subtasks.length > 0 ? subtasks.map(s => `- [${s.status === TaskStatus.DONE ? 'x' : ' '}] ${s.title} (Status: ${s.status})`).join('\n') : 'None'}\n\n
# INSTRUCTIONS:
Based *only* on the information provided, analyze the task and provide specific, actionable suggestions for improvement. Focus on making the task clearer, more manageable, and more likely to succeed.

**Output Format:** Use Markdown.
**Address the following areas specifically, using these exact headings:**\n\n1.  **## Clarity & Specificity:**\n    *   Is the title and description clear, unambiguous, and specific? Suggest improvements if needed.\n    *   Are the goals well-defined?\n\n2.  **## Completeness:**\n    *   Are there any obvious missing details, requirements, or acceptance criteria? What should be added?\n\n3.  **## Structure & Breakdown:**\n    *   Is the task appropriately sized, or should it be broken down further? Suggest specific subtasks if applicable.\n    *   Are the existing subtasks logical and sufficient?\n\n4.  **## Metadata Accuracy:**\n    *   Does the Priority (${task.priority}) seem correct? Why or why not?\n    *   Does the Complexity (${task.complexity || 'Not Set'}) seem correct? Why or why not?\n    *   Are the Tags (${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'}) relevant and sufficient? Suggest additions/removals.\n\n5.  **## Potential Blockers & Dependencies:**\n    *   Are there potential risks, blockers, or dependencies suggested by the notes or description that aren't explicitly tracked? What are they?\n\n**Tone:** Constructive, professional, and helpful.\n`;

    try {
      const result = await this.llmManager.sendRequest({ prompt });

      if (!this.tasks.has(taskId)) {
        throw new Error(`Task with ID ${taskId} was deleted while generating suggestions`);
      }

      this.addTaskNote(
        taskId,
        result.text,
        'AI Assistant',
        'comment'
      );

      return result.text;
    } catch (error) {
      throw errorHandler.createLLMError(
        `Failed to generate task improvement suggestions`,
        { operation: 'suggest_improvements', taskId },
        ErrorSeverity.ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async mcpInitializeTasks(
    projectName: string, 
    projectDescription: string,
    filePath: string
  ): Promise<string> {
    try {
      if (!filePath) {
        throw new Error("filePath is required for task initialization");
      }
      
      logger.info(`Initializing tasks with project: ${projectName}, filePath: ${filePath}`);
      
      if (process.env.WORKSPACE_FOLDER_PATHS) {
        const paths = process.env.WORKSPACE_FOLDER_PATHS.split(';');
        if (paths.length > 0 && paths[0]) {
          this.workspaceRoot = paths[0];
          logger.info(`Using workspace path from WORKSPACE_FOLDER_PATHS: ${this.workspaceRoot}`);
        }
      } 
      else if (path.isAbsolute(filePath)) {
        const fileDir = path.dirname(filePath);
        this.workspaceRoot = fileDir;
        logger.info(`Using file directory as workspace root: ${this.workspaceRoot}`);
      } 
      else {
        this.workspaceRoot = process.cwd();
        logger.info(`Using current directory as workspace root: ${this.workspaceRoot}`);
      }
      
      try {
        process.chdir(this.workspaceRoot);
        logger.info(`Changed process.cwd() to workspace root: ${process.cwd()}`);
      } catch (err) {
        logger.warn(`Failed to change process.cwd() to workspace root: ${err}`);
      }

      const tasksFilePath = path.join(this.workspaceRoot, 'TASKS.md');
      this.setTasksFilePath(tasksFilePath);
      logger.info(`Setting tasks file path to: ${this.tasksFilePath}`);
      
      await this.initialize(projectName, projectDescription, tasksFilePath);
      
      this.saveTasks();
      
      const result = `
# Tasks initialized for ${projectName}

Tasks file has been created at:
${this.tasksFilePath}

Project: ${projectName}
Description: ${projectDescription}
Workspace root: ${this.workspaceRoot}
`;
      
      return result;
    } catch (error: any) {
      const errorMessage = `Error initializing tasks with MCP: ${error.message || String(error)}`;
      logger.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  }

  async mcpCreateTask(title: string, description: string, additionalContext?: string): Promise<string> {
    try {
      if (!this.initialized) {
        const defaultPath = path.join(process.cwd(), 'TASKS.md');
        await this.initialize("New Project", "Automatically created when adding first task", defaultPath);
      }

      const taskId = await this.createTask(title, description, additionalContext);
      const task = this.getTask(taskId);

      if (!task) {
        throw new Error('Task was created but could not be retrieved');
      }

      return `Task "${title}" created successfully with ID: ${taskId}.\n\nPriority: ${task.priority}\nComplexity: ${task.complexity}/10\nTags: ${task.tags.join(', ') || 'None'}\n\n${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`;
    } catch (error) {
      const errorMessage = `Error creating task: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  }

  getTaskDependencyTree(taskId: string): { task: Task, dependencies: Task[] } | undefined {
    const task = this.getTask(taskId);
    if (!task) return undefined;

    const dependencies: Task[] = [];
    for (const depId of task.dependencies) {
      const depTask = this.getTask(depId);
      if (depTask) {
        dependencies.push(depTask);
      }
    }

    return { task, dependencies };
  }
}
