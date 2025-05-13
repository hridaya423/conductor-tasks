import { Task, TaskPriority, TaskStatus, TaskNote, ContextPriority, TaskTemplate, TaskTemplateDefinition, CodeSymbol, CodeSymbolType, FileAnalysis, CodeSymbolParameter, CodeSymbolSignature, CodebaseAnalysisSummary } from '../core/types.js';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript'; 
import { LLMManager } from '../llm/llmManager.js';
import { ContextManager } from '../core/contextManager.js';
import errorHandler, { ErrorCategory, ErrorSeverity, TaskError } from '../core/errorHandler.js';
import markdownRenderer from '../core/markdownRenderer.js';
import { ErrorHandler } from '../core/errorHandler.js';
import logger from '../core/logger.js';
import { JsonUtils } from '../core/jsonUtils.js';
import { refinePrompt } from '../core/promptRefinementService.js';

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
    
    
    logger.info(`TaskManager.initialize called. Current workspace root: ${this.workspaceRoot}. Initializing with tasks file: ${filePath}`);
    
    
    
    const normalizedPath = this.normalizePath(filePath);
    logger.info(`Normalized file path for initialization: ${normalizedPath}`);

    if (fs.existsSync(normalizedPath)) {
      
      logger.warn(`Task file already exists at ${normalizedPath}. Initialization via TaskManager.initialize will not proceed if it implies overwriting.`);
      
      
      
      
      
      throw new Error(`Task file already exists at ${normalizedPath}. Cannot initialize a new task system at this location.`);
    }

    this.setTasksFilePath(normalizedPath); 
    logger.info(`Tasks file path set during initialization: ${this.tasksFilePath}`);

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

    let codebaseContext = 'Codebase context analysis not available or failed.';
    try {
      const structuredAnalysis = await this.getStructuredCodebaseAnalysis(projectName, projectDescription);
      codebaseContext = this._getCodebaseContextString(structuredAnalysis);
    } catch (error) {
      logger.warn('Failed to analyze codebase for implementation steps', error);
    }

    const prompt = `
You are an expert Technical Project Manager and System Architect. Your role is to define a set of specific, actionable, and high-quality initial tasks for a prompt engineering tool project based on its description and available codebase context. The goal is to produce a robust foundational task list.

# PROJECT DETAILS:
Project Name: ${projectName}
Project Description: ${projectDescription}

# AVAILABLE CODEBASE CONTEXT SUMMARY (High-Level):
${codebaseContext ? codebaseContext : "No specific codebase context provided. Assume a new project or infer from description. Focus on establishing core functionalities."}

# INSTRUCTIONS:
1. **Analyze & Strategize**: Thoroughly review the project name, description, and codebase context. Identify the most critical functionalities and foundational elements needed for success.
   * Pay special attention to any README or PLAN content that outlines project goals, design, or architecture.
   * Consider existing project structure including directories, key files, and current functionality to identify what's already in place and what's missing.
   * Note any specific technologies, frameworks, or patterns already in use, and leverage them in task definitions.

2. **Propose High-Quality Initial Tasks**: Define 5-7 well-scoped, specific, and actionable tasks. These tasks should establish a strong foundation or tackle the most critical aspects first.
   * Tasks MUST directly relate to the actual project description and structure found in the codebase context (if available).
   * Tasks should logically build on what already exists, or outline the creation of essential new components.
   * Avoid overly broad tasks (e.g., "Develop backend"). Instead, break them down into more concrete deliverables (e.g., "Design and implement API for user authentication").
   * Ensure tasks are not too granular for an initial set; they should represent significant pieces of work.

3. **Task Focus Areas** - Based on the actual code/files detected and README/PLAN content, or core requirements for a new prompt engineering tool:
   * **Core Prompt Engineering Features**: E.g., "Implement robust prompt templating engine with variable substitution", "Develop prompt versioning and history tracking".
   * **LLM Provider Integration**: E.g., "Abstract LLM provider interface and implement OpenAI connector", "Implement secure API key management for LLM providers".
   * **IDE/Workspace Integration**: E.g., "Develop service for workspace-aware code context retrieval", "Design mechanism for injecting context into active editor".
   * **User Interface/API (if applicable)**: E.g., "Design and implement core API for prompt management (CRUD operations)", "Develop basic UI for creating and testing prompts".
   * **Essential Tooling/Setup**: E.g., "Establish comprehensive logging and error handling framework", "Set up automated testing pipeline for core modules". (Only if not present and clearly essential).

4. **Leverage Context & Be Specific** (CRITICAL):
   * **Reference specific files and directories** that are mentioned in the codebase context if they are relevant to the new task.
   * If README.md or PLAN.md content is included, ensure tasks align with their stated goals and plans.
   * Create tasks that build upon the existing structure or propose clear new structures. E.g., "Extend \`src/llm/providers\` to support Anthropic Claude API".
   * For new projects, tasks should define the creation of these key structures.

5. **Format Output**: For each proposed task, provide the required information in the exact format specified below. Ensure all fields are thoughtfully completed.

# REQUIRED TASK FIELDS (Provide all for each task, ensuring high quality and detail):
1. **TITLE**: Concise, action-oriented, and specific title (e.g., "Implement Secure API Key Storage using Vault").
2. **DESCRIPTION**: Detailed explanation (3-5 sentences) of the task's purpose, scope, key deliverables, and its importance to the project. If it builds on existing code, mention how. If it creates something new, describe what and why. Reference actual files/folders from the codebase context where applicable.
3. **PRIORITY**: Choose one: critical, high, medium. Base this on urgency and foundational impact for a new project.
4. **COMPLEXITY**: Integer rating from 1 (very simple) to 10 (very complex), reflecting estimated effort.
5. **TAGS**: Comma-separated list of 3-5 highly relevant keywords (e.g., \`frontend\`, \`authentication\`, \`api\`, \`database\`, \`backend\`, \`security\`, \`server\`).
6. **SUBTASKS**: List 2-4 concrete, actionable first steps or sub-components required to complete this task. Each subtask needs a clear title and a brief (1-sentence) description of what needs to be done and its expected outcome.
   * *Example Subtask Format:* \`- Define API key encryption strategy: Research and select suitable encryption algorithms and key management practices.\`

# IMPORTANT NOTES:
- Ensure tasks specifically relate to prompt engineering, LLM integration, IDE integration, or foundational elements for such a tool.
- Tasks should directly build on any detected directories and files or propose creation of core new ones.
- Focus on concrete implementations rather than vague design tasks. Titles and descriptions must be specific.
- Emphasize high-quality, well-defined tasks that a developer can pick up and begin working on.
- If suggesting a task for an existing file/directory, be specific about what needs to be *added* or *changed*.
`;

      try {
        const result = await this.llmManager.sendRequest({ 
          prompt,
          taskName: "initialize-project" // Add taskName for provider routing
        });

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
      status: TaskStatus.TODO,
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

    
    const subtaskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const subtask: Task = {
      id: subtaskId,
      title,
      description,
      priority: parentTask.priority,
      status: parentTask.status,
      complexity: 5,
      createdAt: now,
      updatedAt: now,
      dependencies: [],
      tags: [],
      notes: [],
      subtasks: [],
      parent: parentId
    };

    
    parentTask.subtasks = parentTask.subtasks || [];
    parentTask.subtasks.push(subtaskId);
    this.tasks.set(parentId, parentTask);

    
    this.tasks.set(subtaskId, subtask);
    this.saveTasks();

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
          
          let codebaseContextString = 'Codebase context analysis not available or failed.';
          try {
            const structuredAnalysis = await this.getStructuredCodebaseAnalysis();
            codebaseContextString = this._getCodebaseContextString(structuredAnalysis);
          } catch (e) {
            logger.warn(`Codebase analysis failed during task enhancement for ${task.id}:`, e);
          }

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
${codebaseContextString}

# EXISTING SUBTASKS (if any):
${subtasks.length > 0 ? subtasks.map(s => `- ${s.title}: ${s.description ? s.description.substring(0,150) + '...' : '(No description)'}`).join('\n') : 'None'}

# INSTRUCTIONS:
First, provide a JSON object containing metadata for the task. Enclose this JSON object in triple backticks with the language specifier "json".
The JSON object should have the following optional fields:
- "priority": string (one of "critical", "high", "medium", "low", "backlog")
- "complexity": number (integer between 1 and 10)
- "tags": array of strings
- "estimatedEffort": string (e.g., "2 days", "4 hours")
- "suggestedSubtasks": array of objects, where each object has "title" (string) and "description" (string). Limit to 3-5 subtasks.

Example JSON block:
\`\`\`json
{
  "priority": "high",
  "complexity": 7,
  "tags": ["refactor", "api", "performance"],
  "estimatedEffort": "3 days",
  "suggestedSubtasks": [
    { "title": "Define API contract", "description": "Specify request/response formats." },
    { "title": "Implement core logic", "description": "Write the main processing functions." }
  ]
}
\`\`\`

After the JSON block, generate a comprehensive, step-by-step implementation plan based *only* on the information provided above. The plan should be clear enough for another developer to follow.

**Output Format for the plan (after the JSON block):** Use Markdown.
**MUST include the following sections in the Markdown part:**

1.  **## Implementation Plan:**
    *   Provide a numbered list of specific, actionable steps from start to finish. The plan should be practical for a developer to execute.
    *   Break down larger steps into smaller, manageable actions.
    *   If referring to specific files or code sections from the 'CODEBASE CONTEXT SUMMARY', be precise.
    *   Include concise code snippets, pseudocode, or configuration examples where they add significant clarity.
    *   Clearly consider the order of operations and any dependencies between steps.

2.  **## Key Considerations:**
    *   Highlight important technical decisions, potential challenges, or architectural points.
    *   Mention any assumptions made. If your suggested metadata (priority, complexity, estimated effort) in the JSON block represents a significant change or might not be immediately obvious, briefly justify your reasoning here.
    *   Suggest specific libraries or tools if relevant and not already implied by the context, explaining the benefit.

3.  **## Verification & Testing:**
    *   Describe concrete verification steps for key parts of the implementation.
    *   Suggest specific testing approaches (e.g., unit tests for specific functions, integration tests for API endpoints, manual E2E checks for UI flows) relevant to the plan. Outline example test cases if appropriate.

4.  **## Missing Information (Optional):**
    *   If critical information is missing to create a robust plan, clearly state what specific questions need to be answered or what details are required.

**Tone:** Professional, clear, and concise. Be comprehensive but avoid unnecessary verbosity.

# FINAL CHECKLIST BEFORE RESPONDING:
- Does the response start *exactly* with the \`\`\`json block?
- Is the JSON block valid and contains the specified fields (priority, complexity, tags, estimatedEffort, suggestedSubtasks)?
- Is the JSON block immediately followed by the Markdown plan?
- Does the Markdown plan include ALL required sections (Implementation Plan, Key Considerations, Verification & Testing)?
- Are the implementation steps concrete, actionable, and reference codebase context where relevant?
- Is the response free of any other introductory/concluding text or apologies?
`;

          try {
            let llmOutput = '';
            let metadata: any = null;
            let markdownContent = '';
            const maxAttempts = 2; 

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              const currentPrompt = (attempt > 1 && task.notes.find(n => n.type === 'comment' && n.author === 'AI_PROMPT_REFINER')?.content) 
                ? task.notes.find(n => n.type === 'comment' && n.author === 'AI_PROMPT_REFINER')!.content
                : prompt;
              
              const result = await this.llmManager.sendRequest({ prompt: currentPrompt });
              llmOutput = result.text.trim();

              
              const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
              const jsonMatch = llmOutput.match(jsonBlockRegex);

              if (jsonMatch && jsonMatch[1]) {
                const jsonString = jsonMatch[1].trim();
                try {
                  
                  
                  
                  const parsedJson = JSON.parse(jsonString); 
                  if (typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson)) {
                    metadata = parsedJson;
                    markdownContent = llmOutput.substring(jsonMatch[0].length).trim();
                    logger.info(`Successfully parsed JSON metadata on attempt ${attempt} for task ${task.id}`);
                    break; 
                  } else {
                    logger.warn(`Parsed JSON is not a single object on attempt ${attempt} for task ${task.id}: ${jsonString}`);
                  }
                } catch (parseError) {
                  logger.warn(`Failed to parse extracted JSON on attempt ${attempt} for task ${task.id}: ${jsonString}`, { error: parseError });
                }
              } else {
                logger.warn(`Could not find JSON block in LLM output on attempt ${attempt} for task ${task.id}: ${llmOutput.substring(0,200)}...`);
              }

              
              if (!metadata && attempt < maxAttempts) {
                logger.info(`Attempting to refine prompt for task ${task.id} after failed attempt ${attempt}`);
                const desiredSpec = `The response must start with a JSON object enclosed in \`\`\`json ... \`\`\` containing fields: priority, complexity, tags, estimatedEffort, suggestedSubtasks. Example:
\`\`\`json
{
  "priority": "medium",
  "complexity": 5,
  "tags": ["ui", "refactor"],
  "estimatedEffort": "1 day",
  "suggestedSubtasks": [{"title": "Subtask 1", "description": "Desc 1"}]
}
\`\`\`
The rest of the response should be Markdown.`;
                try {
                  const refinedPromptText = await this.llmManager.refinePrompt(prompt, llmOutput, desiredSpec);
                  
                  this.addTaskNote(task.id, refinedPromptText, 'AI_PROMPT_REFINER', 'comment');
                  logger.info(`Successfully refined prompt for task ${task.id}`);
                } catch (refinementError) {
                  logger.error(`Failed to refine prompt for task ${task.id}`, { error: refinementError });
                  break; 
                }
              }
            }

            if (metadata) {
              if (metadata.priority && typeof metadata.priority === 'string') {
                task.priority = this.stringToPriority(metadata.priority) || task.priority;
              }

              if (metadata.complexity && typeof metadata.complexity === 'number') {
                task.complexity = Math.min(Math.max(1, Math.round(metadata.complexity)), 10);
              }

              if (metadata.tags && Array.isArray(metadata.tags)) {
                task.tags = metadata.tags.filter((tag: any) => typeof tag === 'string');
              }

              if (metadata.estimatedEffort && typeof metadata.estimatedEffort === 'string') {
                task.estimatedEffort = metadata.estimatedEffort;
              }

              if (metadata.suggestedSubtasks && Array.isArray(metadata.suggestedSubtasks) &&
                  (!task.subtasks || task.subtasks.length === 0)) {
                task.subtasks = []; 

                for (const subTaskData of metadata.suggestedSubtasks.slice(0, this.config.defaultSubtasks)) {
                  if (subTaskData && typeof subTaskData.title === 'string' && typeof subTaskData.description === 'string') {
                    const subId = await this.createSubtask(
                      task.id,
                      subTaskData.title,
                      subTaskData.description
                    );

                    if (subId) {
                      logger.info(`Created LLM suggested subtask ${subId} for task ${task.id}`);
                    }
                  }
                }
              }
              
              
              if (markdownContent) {
                this.addTaskNote(task.id, `# AI Generated Plan\n\n${markdownContent}`, 'AI_PLANNER', 'solution');
              }
              task.updatedAt = Date.now();
              logger.info(`Successfully enhanced task ${task.id} with LLM and parsed metadata.`);

            } else {
              logger.warn(`Failed to extract metadata from LLM response for task ${task.id} after all attempts: ${llmOutput.substring(0, 200)}...`);
              this.setDefaultTaskMetadata(task);
               
              this.addTaskNote(task.id, `# AI Enhancement Attempt (Metadata Failed)\n\n${llmOutput}`, 'SYSTEM_ERROR', 'comment');
            }
          } catch (llmRequestError) {
            logger.error(`LLM request error during task enhancement for ${task.id}`, llmRequestError);
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

    
    const sanitizedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const note: TaskNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      content: sanitizedContent,
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
CRITICAL SYSTEM INSTRUCTION: You are an expert system that parses Product Requirements Documents (PRDs) and extracts actionable, high-quality, well-defined development tasks in a structured JSON format.
Your ENTIRE response MUST be ONLY a valid JSON array of task objects, with ABSOLUTELY NOTHING else (no introductory text, no explanations, no markdown, no code block specifiers like \`\`\`json).

# INPUT DOCUMENT (PRD):
\`\`\`
${content}
\`\`\`

# TASK EXTRACTION GUIDELINES:
1.  Identify distinct features, user stories, epics, or key requirements from the PRD.
2.  For each, create a task object. Tasks should represent manageable, yet meaningful, units of work. Break down very large features into multiple, more granular tasks if appropriate for clarity and actionability.
3.  **Titles** should be concise, highly descriptive, and action-oriented (e.g., "Implement user login via email/password", "Design database schema for product inventory"). Ensure titles clearly reflect the core purpose of the task.
4.  **Descriptions** should comprehensively summarize the relevant section of the PRD, clearly state the task's objective, key deliverables, and any important context. If the PRD mentions specific components or modules, reference them.
5.  **Priority, Complexity, Tags**: Infer these based on the PRD's emphasis, implied effort, and common software development best practices. Strive for realistic complexity assessments.
    - Priority: Indicate the relative importance and urgency.
    - Complexity: Reflect the estimated effort and intricacy.
    - Tags: Use relevant keywords that categorize the task (e.g., module name, feature type, technology).
6.  **Acceptance Criteria**: Extract or formulate 3-5 specific, testable, and verifiable acceptance criteria for each task. These criteria should clearly define what "done" means for the task. If not clearly defined in the PRD, formulate them based on a reasonable interpretation of the requirements. Each criterion should be a distinct statement.

# STRICTLY ENFORCE JSON OUTPUT FORMAT:
1.  The response MUST start with an opening square bracket \'[\'.
2.  The response MUST end with a closing square bracket \']\'.
3.  There must be NO text or characters whatsoever before the initial \'[\' or after the final \']\'.
4.  Each task object within the array must adhere to the specified schema.

# REQUIRED JSON SCHEMA FOR EACH TASK OBJECT:
{
  "title": "string (Concise, action-oriented, and highly descriptive task title)",
  "description": "string (Comprehensive description: objective, deliverables, PRD context. Min 20 words.)",
  "priority": "string (enum: \'critical\', \'high\', \'medium\', \'low\', \'backlog\')",
  "complexity": "number (integer 1-10, realistic assessment)",
  "tags": "array of strings (e.g., [\\\"frontend\\\", \\\"api\\\", \\\"database\\\", \\\"user-auth\\\"])",
  "acceptanceCriteria": "array of strings (3-5 specific, testable criteria, e.g., [\\\"User can log in with valid credentials\\\", \\\"Error shown for invalid credentials\\\", \\\"Successful login redirects to dashboard\\\"])"
}

# EXAMPLE OF A SINGLE TASK OBJECT (Illustrative):
{
  "title": "Develop User Profile Page API Endpoints",
  "description": "Create backend API endpoints for managing user profiles as detailed in PRD section 3.2. This includes GET to retrieve profile data, PUT to update profile information (name, email), and POST for profile picture upload. Ensure appropriate validation and error handling for all endpoints.",
  "priority": "high",
  "complexity": 7,
  "tags": ["backend", "user-profile", "api", "rest"],
  "acceptanceCriteria": [
    "GET /api/users/me returns the authenticated user's profile data.",
    "PUT /api/users/me successfully updates user's name and email.",
    "POST /api/users/me/avatar allows uploading a valid image file as a profile picture.",
    "Invalid input to PUT or POST requests returns a 400 error with a clear message.",
    "Endpoints are secured and only accessible by authenticated users."
  ]
}

7.  **Handling Ambiguity**: If the PRD is ambiguous for a potential task:
    a. If the ambiguity is minor and an assumption can be safely made, proceed with the task definition and briefly note the assumption in the description (e.g., "Assuming standard OAuth 2.0 flow for this integration.").
    b. If the ambiguity is significant and blocks clear task definition, formulate a specific task aimed at resolving this ambiguity (e.g., title: "Clarify Authentication Mechanism for X Feature", description: "The PRD section on X feature does not specify the authentication mechanism. Research and decide between token-based auth and OAuth 2.0, and document the chosen approach.").

# STRICTLY ENFORCE JSON OUTPUT FORMAT (CRITICAL FOR PARSING):
1.  The response MUST start with \'[\' and end with \']\'.
2.  The response MUST contain ONLY the JSON array. No introductory text, explanations, apologies, summaries, or markdown formatting (\`\`\`).
3.  Each object in the array MUST conform to the schema.

# FINAL CHECKLIST BEFORE RESPONDING:
- Does the entire response start *exactly* with \'[\' and end *exactly* with \']\'?
- Is there absolutely NO other text or formatting outside the JSON array?
- Does each task object contain all required fields (title, description, priority, complexity, tags, acceptanceCriteria) and meet quality standards (e.g. descriptive, actionable, testable ACs)?
- Is the JSON valid?

Output the JSON array directly:
`;

        console.log(`Sending LLM request for PRD parsing...`);
          const result = await this.llmManager.sendRequest({ 
            prompt,
            systemPrompt: "CRITICAL: You are a JSON-only response system. Output raw JSON array ONLY with no other text or formatting.",
            options: {
              temperature: 0.05 
            },
            taskName: "parse-prd" // Add taskName for provider routing
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

      
      markdown = markdown.replace(/<\/?details>/gi, '').replace(/<summary>[\s\S]*?<\/summary>/gi, '');
      
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

            const subtasksBlock = taskBlock.match(/\*\*Subtasks:\*\*\s*\n((?:- .*?\n)*)/);
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

            const notesBlock = taskBlock.match(/\*\*Notes:\*\*\s*\n((?:- .*?\n)*)/);
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

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
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

  
  async getStructuredCodebaseAnalysis(projectName?: string, projectDescription?: string): Promise<CodebaseAnalysisSummary | null> {
    const analysisDir = this.workspaceRoot;
    logger.info(`Performing structured codebase analysis at ${analysisDir}`);

    const stats = {
      totalFiles: 0,
      totalLines: 0,
      fileTypes: new Map<string, number>(),
      topLevelDirs: new Map<string, number>(),
      languages: new Map<string, number>()
    };

    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'out', '.next', '.vscode', 'coverage', '__pycache__'];

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
    
    const keyFileNames = ['README.md', 'PLAN.md', 'README.txt', 'ROADMAP.md', 'DESIGN.md'];

    const allProjectFiles: string[] = []; 

    const scanDirectory = async (dirPath: string, isTopLevel = false): Promise<void> => {
      try {
        if (!fs.existsSync(dirPath)) return; 

        const items = await fs.promises.readdir(dirPath);

        for (const item of items) {
          const fullPath = path.join(dirPath, item);

          if (skipDirs.includes(item)) continue;

          try {
            const fileStats = await fs.promises.stat(fullPath);

            if (fileStats.isDirectory()) {
              if (isTopLevel) {
                const count = stats.topLevelDirs.get(item) || 0;
                stats.topLevelDirs.set(item, count + 1);
              }
              await scanDirectory(fullPath); 
            } else if (fileStats.isFile()) {
              stats.totalFiles++;
              allProjectFiles.push(fullPath); 

              
              const lowerItemName = item.toLowerCase();
              if (keyFileNames.some(key => key.toLowerCase() === lowerItemName)) {
                logger.info(`Found key file: ${item} at ${fullPath}`);
                importantFiles[item] = fullPath;
                
                
                if (lowerItemName === 'readme.md' || lowerItemName === 'plan.md') {
                  try {
                    const content = await fs.promises.readFile(fullPath, 'utf8');
                    
                    importantFiles[`${item}_content`] = content;
                  } catch (readError) {
                    logger.warn(`Failed to read key file ${fullPath}: ${readError}`);
                  }
                }
              }

              const ext = path.extname(item).toLowerCase();
              if (ext) {
                const count = stats.fileTypes.get(ext) || 0;
                stats.fileTypes.set(ext, count + 1);

                const language = extensionToLanguage[ext] || 'Other';
                const langCount = stats.languages.get(language) || 0;
                stats.languages.set(language, langCount + 1);
              }

              try {
                const content = await fs.promises.readFile(fullPath, 'utf8');
                const lines = content.split('\n').length;
                stats.totalLines += lines;
              } catch (readError) {
                logger.warn(`Failed to read file ${fullPath} during analysis: ${readError}`);
              }
            }
          } catch (statError) {
            logger.warn(`Failed to stat ${fullPath} during analysis: ${statError}`);
          }
        }
      } catch (readdirError) {
        logger.warn(`Failed to read directory ${dirPath} during analysis: ${readdirError}`);
      }
    };

    try {
      const rootItems = await fs.promises.readdir(analysisDir);
      for (const item of rootItems) {
        const fullPath = path.join(analysisDir, item);
        try {
          if ((await fs.promises.stat(fullPath)).isDirectory() && !skipDirs.includes(item)) {
            const count = stats.topLevelDirs.get(item) || 0;
            stats.topLevelDirs.set(item, count + 1);
          }
        } catch (error) {
           logger.warn(`Failed to stat item in root ${fullPath}: ${error}`);
        }
      }

      await scanDirectory(analysisDir, true); 

      
      if (this.llmManager && allProjectFiles.length > 0) {
        const relativeProjectFiles = allProjectFiles.map(fp => path.relative(analysisDir, fp));
        
        const filesForLlm = relativeProjectFiles.length > 150 ? relativeProjectFiles.slice(0, 150) : relativeProjectFiles;

        
        let readmeContent = '';
        let planContent = '';
        
        if (importantFiles['README.md_content']) {
          readmeContent = `\n\nREADME.md Content:\n${importantFiles['README.md_content']}`;
        }
        
        if (importantFiles['PLAN.md_content']) {
          planContent = `\n\nPLAN.md Content:\n${importantFiles['PLAN.md_content']}`;
        }

        const keyFilesPrompt = `
You are an AI assistant helping to analyze a software project.
Project Name: ${projectName || "Not specified"}
Project Description: ${projectDescription || "No project description provided."}
${readmeContent}
${planContent}

List of project files (up to ${filesForLlm.length} files shown):
${filesForLlm.join('\n')}
${relativeProjectFiles.length > 150 ? `\n... and ${relativeProjectFiles.length - 150} more files.` : ''}

Based on the project name, description, README/PLAN content (if provided), and the file list, identify up to 10-15 key project files that are most important for understanding the project's purpose, structure, and main functionality.
These could include:
- Main entry points (e.g., index.js, main.py, App.java, vite.config.ts, next.config.js)
- Core configuration files (e.g., package.json, webpack.config.js, tsconfig.json, pom.xml, .env files, Dockerfile, docker-compose.yml)
- High-level documentation or planning files (e.g., README.md, PLAN.md, ROADMAP.md, CONTRIBUTING.md, LICENSE)
- Key source code modules or classes that define core logic (e.g., main service files, core utility modules).
- API definition files (e.g., OpenAPI specs, GraphQL schemas)

Return your answer as a JSON array of strings, where each string is a file path relative to the project root.
Ensure the paths are exactly as they appear in the provided list if they are from there.
Example:
["src/index.ts", "README.md", "package.json", "docs/ARCHITECTURE.md"]
If no specific key files can be identified, or if the project seems trivial, return an empty array.
Provide ONLY the JSON array.
`;
        try {
          const llmResponse = await this.llmManager.sendRequest({ prompt: keyFilesPrompt, options: { temperature: 0.1 } });
          if (llmResponse && llmResponse.text && llmResponse.text.trim().startsWith('[')) { 
            const identifiedRelativePaths: string[] = JSON.parse(llmResponse.text.trim());
            for (const relPath of identifiedRelativePaths) {
              if (typeof relPath === 'string') {
                const fullPath = path.join(analysisDir, relPath);
                
                try {
                    const stat = await fs.promises.stat(fullPath);
                    if (stat.isFile()) {
                        importantFiles[path.basename(relPath)] = fullPath;
                        
                        
                        if (['.md', '.txt'].includes(path.extname(relPath).toLowerCase())) {
                          try {
                            const content = await fs.promises.readFile(fullPath, 'utf8');
                            importantFiles[`${path.basename(relPath)}_content`] = content;
                          } catch (readError) {
                            logger.warn(`Failed to read key file content ${fullPath}: ${readError}`);
                          }
                        }
                    } else {
                        logger.warn(`LLM identified key path is not a file: ${fullPath}`);
                    }
                } catch (e) {
                    logger.warn(`LLM identified key file does not exist or is inaccessible: ${fullPath}`);
                }
              }
            }
            logger.info(`LLM identified key files: ${Object.keys(importantFiles).filter(k => !k.endsWith('_content')).join(', ')}`);
          } else {
            logger.warn(`LLM response for key files was not a valid JSON array: ${llmResponse}`);
          }
        } catch (error) {
          logger.error(`Error getting key files from LLM: ${error}`);
        }
      }

      let summaryLines: string[] = [`# Codebase Analysis for Project at ${analysisDir}\n`];

      summaryLines.push(`## I. Overall Stats`);
      summaryLines.push(`- Total Files Scanned: ${stats.totalFiles}`);
      summaryLines.push(`- Total Lines of Code (approx.): ${stats.totalLines}`);
      summaryLines.push('');

      
      let readmeSummary: string[] = [];
      let planMdSummary: string[] = [];
      
      if (importantFiles['README.md_content']) {
        readmeSummary.push('README.md found and analyzed.');
        
        
        const headings = importantFiles['README.md_content']
          .split('\n')
          .filter(line => line.startsWith('#'))
          .map(line => line.trim())
          .slice(0, 5); 
          
        if (headings.length > 0) {
          readmeSummary.push('Key sections:');
          readmeSummary.push(...headings);
        }
      }
      
      if (importantFiles['PLAN.md_content']) {
        planMdSummary.push('PLAN.md found and analyzed.');
        
        
        const headings = importantFiles['PLAN.md_content']
          .split('\n')
          .filter(line => line.startsWith('#'))
          .map(line => line.trim())
          .slice(0, 5); 
          
        if (headings.length > 0) {
          planMdSummary.push('Key sections:');
          planMdSummary.push(...headings);
        }
      }

      
      const projectType = this.determineProjectType(stats, importantFiles);

      
      const languageSummary: Record<string, { count: number, percentage: number }> = {};
      const totalLanguageFiles = Array.from(stats.languages.values()).reduce((sum, count) => sum + count, 0);
      for (const [lang, count] of stats.languages.entries()) {
        languageSummary[lang] = {
          count,
          percentage: totalLanguageFiles > 0 ? (count / totalLanguageFiles) * 100 : 0
        };
      }

      
      const keyConfigFileInsights: Record<string, string> = {};
      for (const [filename, filepath] of Object.entries(importantFiles)) {
        if (filename.endsWith('_content')) continue; 
        
        const fileExt = path.extname(filename).toLowerCase();
        if (['.json', '.md', '.yml', '.yaml', '.toml'].includes(fileExt)) {
          try {
            const content = await fs.promises.readFile(filepath, 'utf8');
            
            if (fileExt === '.json') {
              try {
                const json = JSON.parse(content);
                
                if (filename === 'package.json') {
                  const name = json.name || 'Unknown';
                  const version = json.version || 'Unknown';
                  const mainScript = json.main || 'Unknown';
                  const dependencies = json.dependencies ? Object.keys(json.dependencies).length : 0;
                  const devDependencies = json.devDependencies ? Object.keys(json.devDependencies).length : 0;
                  
                  keyConfigFileInsights[filename] = 
                    `Node.js package: ${name}@${version}, main: ${mainScript}, ` +
                    `${dependencies} dependencies, ${devDependencies} dev dependencies`;
                } else {
                  keyConfigFileInsights[filename] = `JSON file: ${Object.keys(json).length} top-level keys`;
                }
              } catch (jsonError) {
                keyConfigFileInsights[filename] = `JSON file (parsing failed)`;
              }
            } else if (fileExt === '.md') {
              if (filename === 'README.md') {
                keyConfigFileInsights[filename] = `Documentation: ${readmeSummary.length > 0 ? readmeSummary[0] : 'Contains project documentation'}`;
              } else if (filename === 'PLAN.md') {
                keyConfigFileInsights[filename] = `Planning document: ${planMdSummary.length > 0 ? planMdSummary[0] : 'Contains project planning information'}`;
              } else {
                keyConfigFileInsights[filename] = `Markdown document`;
              }
            } else {
              keyConfigFileInsights[filename] = `Configuration file`;
            }
          } catch (error) {
            keyConfigFileInsights[filename] = `File found but could not be analyzed: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          keyConfigFileInsights[filename] = `Source file`;
        }
      }

      
      return {
        projectType,
        languageSummary,
        keyConfigFileInsights,
        readmeSummary,
        planMdSummary,
        structureSummary: Array.from(stats.topLevelDirs.keys()),
        keyEntryPoints: this.identifyKeyEntryPoints(allProjectFiles, analysisDir, projectType),
      };
    } catch (error) {
      
      const errorMessage = `Error during structured codebase analysis: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage, error);
      
      
      return {
        projectType: 'Unknown (Analysis Error)',
        languageSummary: {},
        keyConfigFileInsights: {
          'ERROR': `Codebase analysis failed: ${errorMessage}`
        },
        readmeSummary: ['Error reading codebase'],
        planMdSummary: [],
        structureSummary: [],
        keyEntryPoints: [],
        analysisError: errorMessage
      };
    }
  }
  
  
  private determineProjectType(stats: {
    totalFiles: number;
    totalLines: number;
    fileTypes: Map<string, number>;
    topLevelDirs: Map<string, number>;
    languages: Map<string, number>;
  }, importantFiles: Record<string, string>): string {
    
    const files = Object.keys(importantFiles).filter(k => !k.endsWith('_content'));
    
    if (files.includes('package.json')) {
      if (files.some(f => ['next.config.js', 'next.config.ts'].includes(f))) {
        return 'Next.js Project';
      }
      if (files.some(f => ['vite.config.js', 'vite.config.ts'].includes(f))) {
        return 'Vite Project';
      }
      if (files.some(f => f.includes('react'))) {
        return 'React Project';
      }
      if (stats.fileTypes.get('.ts') || stats.fileTypes.get('.tsx')) {
        return 'TypeScript Node.js Project';
      }
      return 'Node.js Project';
    }
    
    if (files.some(f => ['pom.xml', 'build.gradle'].includes(f))) {
      return 'Java Project';
    }
    
    if (files.some(f => ['requirements.txt', 'setup.py', 'pyproject.toml'].includes(f))) {
      return 'Python Project';
    }
    
    if (files.some(f => ['Cargo.toml'].includes(f))) {
      return 'Rust Project';
    }
    
    if (files.some(f => ['go.mod'].includes(f))) {
      return 'Go Project';
    }
    
    
    const languages = Array.from(stats.languages.entries())
      .sort((a, b) => b[1] - a[1]);
      
    if (languages.length > 0) {
      const [topLanguage] = languages[0];
      return `${topLanguage} Project`;
    }
    
    return 'Generic Project';
  }
  
  
  private identifyKeyEntryPoints(allFiles: string[], analysisDir: string, projectType: string): string[] {
    const entryPoints: string[] = [];
    const relativeFiles = allFiles.map(fp => path.relative(analysisDir, fp));
    
    
    if (projectType.includes('Node.js') || projectType.includes('TypeScript')) {
      
      const patterns = [
        'src/index.ts', 'src/index.js',
        'src/app.ts', 'src/app.js',
        'src/main.ts', 'src/main.js',
        'index.ts', 'index.js',
        'app.ts', 'app.js',
        'main.ts', 'main.js'
      ];
      
      for (const pattern of patterns) {
        const match = relativeFiles.find(f => f === pattern || f.endsWith(`/${pattern}`));
        if (match) entryPoints.push(match);
      }
    } else if (projectType.includes('Python')) {
      
      const patterns = [
        'main.py', 'app.py', '__main__.py',
        'src/main.py', 'src/app.py'
      ];
      
      for (const pattern of patterns) {
        const match = relativeFiles.find(f => f === pattern || f.endsWith(`/${pattern}`));
        if (match) entryPoints.push(match);
      }
    }
    
    return entryPoints;
  }

  
  async analyzeCodebase(): Promise<string> {
     const structuredSummary = await this.getStructuredCodebaseAnalysis();
     if (!structuredSummary) {
         return "Failed to analyze codebase.";
     }
     
     
     if (structuredSummary.analysisError) {
         return `Error analyzing codebase: ${structuredSummary.analysisError}`;
     }
     
     
     
     let summaryLines: string[] = [`# Codebase Analysis for Project at ${this.workspaceRoot}\n`];
     summaryLines.push(`## I. Overall Stats`);
     
     
     const totalFiles = Object.values(structuredSummary.languageSummary)
        .reduce((sum, data) => sum + data.count, 0);
     
     const totalLines = "Unknown - detailed line counts not available";
     
     summaryLines.push(`- Total Files Scanned: ${totalFiles}`);
     summaryLines.push(`- Total Lines of Code (approx.): ${totalLines}`);
     summaryLines.push('');

     summaryLines.push(`## II. Detected Languages (Top 5)`);
     if (structuredSummary.languageSummary && Object.keys(structuredSummary.languageSummary).length > 0) {
        const sortedLanguages = Object.entries(structuredSummary.languageSummary)
          .sort(([,a],[,b]) => b.count - a.count)
          .slice(0, 5);
        for (const [language, data] of sortedLanguages) {
          summaryLines.push(`- ${language}: ${data.count} files (${data.percentage.toFixed(1)}%)`);
        }
      } else {
        summaryLines.push("- No specific language files detected in significant quantity.");
      }
      summaryLines.push('');
      
      summaryLines.push(`## III. Project Structure (Key Top-Level Directories)`);
      if (structuredSummary.structureSummary.length > 0) {
        summaryLines.push(structuredSummary.structureSummary.map(dir => `- ${dir}/`).join('\n'));
      } else {
        summaryLines.push("- No distinct top-level directories found (or project root is flat).");
      }
      summaryLines.push('');

      summaryLines.push(`## IV. Key Configuration Files & Insights`);
      if (structuredSummary.keyConfigFileInsights) {
          const files = Object.entries(structuredSummary.keyConfigFileInsights);
          if (files.length > 0) {
              for (const [filename, insight] of files) {
                  summaryLines.push(`- \`${filename}\`: ${insight}`);
              }
          } else {
              summaryLines.push("- No configuration files analyzed.");
          }
      } else {
          summaryLines.push("- No configuration files found or analyzed.");
      }
      summaryLines.push('');

      summaryLines.push(`## V. Detected Project Type`);
      summaryLines.push(`- Primary Detected Type: ${structuredSummary.projectType}`);
      if (structuredSummary.keyEntryPoints && structuredSummary.keyEntryPoints.length > 0) {
        summaryLines.push(`- Potential Entry Point(s): ${structuredSummary.keyEntryPoints.join(', ')}`);
      }
      summaryLines.push('');

      if (structuredSummary.readmeSummary && structuredSummary.readmeSummary.length > 0) {
        summaryLines.push(`## VI. README.md Summary`);
        structuredSummary.readmeSummary.forEach(line => summaryLines.push(`- ${line}`));
        summaryLines.push('');
      }
      
      if (structuredSummary.planMdSummary && structuredSummary.planMdSummary.length > 0) {
        summaryLines.push(`## VII. PLAN.md Summary`);
        structuredSummary.planMdSummary.forEach(line => summaryLines.push(`- ${line}`));
        summaryLines.push('');
      }
      
      
      if (structuredSummary.detailedFileAnalyses && structuredSummary.detailedFileAnalyses.length > 0) {
        summaryLines.push(`## VIII. Detailed Analysis of Key Files`);
        structuredSummary.detailedFileAnalyses.forEach(fileAnalysis => {
          summaryLines.push(`### File: ${fileAnalysis.filePath}`);
          if (fileAnalysis.imports.length > 0) {
            summaryLines.push(`- Imports: ${fileAnalysis.imports.map(imp => imp.moduleSpecifier).slice(0,5).join(', ')}${fileAnalysis.imports.length > 5 ? '...' : ''}`);
          }
          if (fileAnalysis.exports.length > 0) {
            summaryLines.push(`- Exports: ${fileAnalysis.exports.map(exp => exp.name).slice(0,5).join(', ')}${fileAnalysis.exports.length > 5 ? '...' : ''}`);
          }
          if (fileAnalysis.symbols.length > 0) {
            summaryLines.push(`- Key Symbols:`);
            fileAnalysis.symbols.slice(0, 5).forEach(sym => {
              summaryLines.push(`  - ${sym.name} (${sym.type})`);
            });
            if (fileAnalysis.symbols.length > 5) summaryLines.push(`  ... and ${fileAnalysis.symbols.length - 5} more.`);
          }
          summaryLines.push('');
        });
      }
      
      if (structuredSummary.moduleDependencyGraph && (structuredSummary.moduleDependencyGraph.nodes.length > 0 || structuredSummary.moduleDependencyGraph.edges.length > 0)) {
        summaryLines.push(`## IX. Module Dependency Graph (Simplified)`);
        summaryLines.push(`- Nodes: ${structuredSummary.moduleDependencyGraph.nodes.length}, Edges: ${structuredSummary.moduleDependencyGraph.edges.length}`);
        summaryLines.push(`  (Full graph data available via structured analysis)`);
        summaryLines.push('');
      }

      summaryLines.push(`## X. Task Management Context`);
      summaryLines.push(`- This project utilizes Conductor Tasks. Current tasks are managed in: ${this.tasksFilePath}`);
      summaryLines.push(`- Use Conductor Tasks' AI features to break down requirements, plan implementations, and track progress.\n`);
      
      return summaryLines.join('\n');
  }


  private async performDetailedFileAnalyses(entryPoints: string[], analysisDir: string): Promise<FileAnalysis[]> {
    const analyzedFiles: FileAnalysis[] = [];
    
    const filesToAnalyze = entryPoints.slice(0, 3); 

    for (const relativeFilePath of filesToAnalyze) {
      const absoluteFilePath = path.join(analysisDir, relativeFilePath);
      
      if (fs.existsSync(absoluteFilePath) && (absoluteFilePath.endsWith('.ts') || absoluteFilePath.endsWith('.js'))) {
        try {
          const fileContent = await fs.promises.readFile(absoluteFilePath, 'utf8');
          const sourceFile = ts.createSourceFile(
            absoluteFilePath,
            fileContent,
            ts.ScriptTarget.Latest,
            true 
          );
          const fileAnalysis = this.extractSymbolsFromFile(sourceFile, relativeFilePath);
          analyzedFiles.push(fileAnalysis);
        } catch (e) {
          logger.warn(`Failed to perform AST analysis on ${absoluteFilePath}:`, e);
        }
      }
    }
    return analyzedFiles;
  }

  private extractSymbolsFromFile(sourceFile: ts.SourceFile, relativeFilePath: string): FileAnalysis {
    const symbols: CodeSymbol[] = [];
    const imports: FileAnalysis['imports'] = [];
    const exports: FileAnalysis['exports'] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        const name = node.name?.getText(sourceFile) || '[anonymous_function]';
        const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
        const signature = this.extractFunctionSignature(node, sourceFile);
        const isExported = (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 || 
                           (node.parent && ts.isExportAssignment(node.parent));

        symbols.push({
          name,
          type: CodeSymbolType.FUNCTION,
          filePath: relativeFilePath,
          startLine: startLine + 1,
          endLine: endLine + 1,
          signature,
          exported: isExported,
          comment: this.getNodeComment(node, sourceFile)
        });
      } else if (ts.isClassDeclaration(node)) {
        const name = node.name?.getText(sourceFile) || '[anonymous_class]';
        const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
        const isExported = (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
        
        const classMembers: CodeSymbol[] = [];
        node.members.forEach(member => {
          const memberNameNode = (member as any).name; 
          const memberName = memberNameNode ? memberNameNode.getText(sourceFile) : '[anonymous_member]';
          const { line: memberStartLine } = ts.getLineAndCharacterOfPosition(sourceFile, member.getStart(sourceFile));
          const { line: memberEndLine } = ts.getLineAndCharacterOfPosition(sourceFile, member.getEnd());
          let memberSymbol: Partial<CodeSymbol> = {
            name: memberName,
            filePath: relativeFilePath,
            startLine: memberStartLine + 1,
            endLine: memberEndLine + 1,
            exported: (ts.getCombinedModifierFlags(member as ts.Declaration) & ts.ModifierFlags.Static) !== 0, 
            comment: this.getNodeComment(member, sourceFile)
          };

          if (ts.isMethodDeclaration(member)) {
            memberSymbol.type = CodeSymbolType.FUNCTION; 
            memberSymbol.signature = this.extractFunctionSignature(member, sourceFile);
          } else if (ts.isPropertyDeclaration(member)) {
            memberSymbol.type = CodeSymbolType.VARIABLE; 
            if (member.type) {
              memberSymbol.signature = { returnType: member.type.getText(sourceFile) }; 
            }
          } else if (ts.isConstructorDeclaration(member)) {
            memberSymbol.name = "constructor";
            memberSymbol.type = CodeSymbolType.FUNCTION; 
            memberSymbol.signature = this.extractFunctionSignature(member, sourceFile);
          } else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
            memberSymbol.type = CodeSymbolType.FUNCTION; 
            memberSymbol.signature = this.extractFunctionSignature(member, sourceFile);
          }
          
          if(memberSymbol.type) { 
            symbols.push(memberSymbol as CodeSymbol); 
          }
        });

        symbols.push({
          name,
          type: CodeSymbolType.CLASS,
          filePath: relativeFilePath,
          startLine: startLine + 1,
          endLine: endLine + 1,
          exported: isExported,
          comment: this.getNodeComment(node, sourceFile),
          
        });

      } else if (ts.isInterfaceDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
        const isExported = (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
        symbols.push({
          name,
          type: CodeSymbolType.INTERFACE,
          filePath: relativeFilePath,
          startLine: startLine + 1,
          endLine: endLine + 1,
          exported: isExported,
          comment: this.getNodeComment(node, sourceFile)
        });
      } else if (ts.isVariableDeclaration(node) && node.name) {
          const name = node.name.getText(sourceFile);
          const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
          const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
          let isExported = false;
          if(node.parent?.parent && ts.isVariableStatement(node.parent.parent)){
            const variableStatement = node.parent.parent;
            if (variableStatement.modifiers) {
              isExported = variableStatement.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
            }
          }
          symbols.push({
            name,
            type: ts.isFunctionLike(node.initializer) ? CodeSymbolType.FUNCTION : CodeSymbolType.VARIABLE,
            filePath: relativeFilePath,
            startLine: startLine + 1,
            endLine: endLine + 1,
            exported: isExported,
            comment: this.getNodeComment(node.parent.parent, sourceFile) 
          });
      } else if (ts.isEnumDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
        const isExported = (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
        symbols.push({
          name,
          type: CodeSymbolType.ENUM,
          filePath: relativeFilePath,
          startLine: startLine + 1,
          endLine: endLine + 1,
          exported: isExported,
          comment: this.getNodeComment(node, sourceFile)
        });
      } else if (ts.isTypeAliasDeclaration(node)) {
        const name = node.name.getText(sourceFile);
        const { line: startLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const { line: endLine } = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
        const isExported = (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;
        symbols.push({
          name,
          type: CodeSymbolType.TYPE_ALIAS,
          filePath: relativeFilePath,
          startLine: startLine + 1,
          endLine: endLine + 1,
          exported: isExported,
          comment: this.getNodeComment(node, sourceFile)
        });
      } else if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
        const importClause = node.importClause;
        const importedItems: string[] = [];
        let defaultImportName: string | undefined;
        let namespaceImportName: string | undefined;

        if (importClause) {
          if (importClause.name) { 
            defaultImportName = importClause.name.getText(sourceFile);
            importedItems.push(defaultImportName);
          }
          if (importClause.namedBindings) {
            if (ts.isNamespaceImport(importClause.namedBindings)) { 
              namespaceImportName = importClause.namedBindings.name.getText(sourceFile);
              importedItems.push(`* as ${namespaceImportName}`);
            } else if (ts.isNamedImports(importClause.namedBindings)) { 
              importClause.namedBindings.elements.forEach(element => {
                let name = element.name.getText(sourceFile);
                if (element.propertyName) {
                  name = `${element.propertyName.getText(sourceFile)} as ${name}`;
                }
                importedItems.push(name);
              });
            }
          }
        }
        imports.push({ 
          moduleSpecifier, 
          importedNames: importedItems.length > 0 ? importedItems : undefined, 
          isDefaultImport: !!defaultImportName, 
          namespaceImport: namespaceImportName 
        });
      } else if (ts.isExportDeclaration(node)) { 
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach(element => {
            exports.push({ name: element.name.getText(sourceFile), type: CodeSymbolType.VARIABLE }); 
          });
        } else if (node.moduleSpecifier) {
          
          exports.push({ name: `* from ${node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '')}`, type: CodeSymbolType.MODULE });
        }
      } else if (ts.isExportAssignment(node)) { 
        exports.push({ name: node.expression.getText(sourceFile), type: CodeSymbolType.EXPORT }); 
      }


      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);

    return { filePath: relativeFilePath, symbols, imports, exports };
  }

  private _buildDependencyGraph(
    fileAnalyses: FileAnalysis[],
    analysisDir: string
  ): CodebaseAnalysisSummary['moduleDependencyGraph'] {
    const nodes: Array<{ id: string; label?: string; type?: string }> = [];
    const edges: Array<{ from: string; to: string; label?: string }> = [];
    const filePaths = new Set<string>();

    fileAnalyses.forEach(analysis => {
      filePaths.add(analysis.filePath);
      analysis.imports.forEach(imp => {
        
        
        let targetPath = imp.moduleSpecifier;
        if (targetPath.startsWith('.')) { 
          targetPath = path.normalize(path.join(path.dirname(analysis.filePath), targetPath));
          
          if (!targetPath.endsWith('.ts') && !targetPath.endsWith('.js')) {
            if (fs.existsSync(path.join(analysisDir, `${targetPath}.ts`))) {
              targetPath += '.ts';
            } else if (fs.existsSync(path.join(analysisDir, `${targetPath}.js`))) {
              targetPath += '.js';
            } else if (fs.existsSync(path.join(analysisDir, targetPath, 'index.ts'))) {
                targetPath = path.join(targetPath, 'index.ts');
            } else if (fs.existsSync(path.join(analysisDir, targetPath, 'index.js'))) {
                targetPath = path.join(targetPath, 'index.js');
            }
          }
        } else {
          
          
          
          filePaths.add(targetPath); 
          return; 
        }
        
        
        
        
        const absoluteTargetPath = path.join(analysisDir, targetPath);
        if (fs.existsSync(absoluteTargetPath) || fileAnalyses.some(fa => fa.filePath === targetPath)) {
            filePaths.add(targetPath); 
            edges.push({ from: analysis.filePath, to: targetPath });
        } else {
            filePaths.add(imp.moduleSpecifier); 
        }
      });
    });

    filePaths.forEach(fp => {
      nodes.push({ id: fp, label: path.basename(fp), type: "file" });
    });

    return { nodes, edges };
  }

  
  private _getCodebaseContextString(analysisSummary: CodebaseAnalysisSummary | null): string {
    if (!analysisSummary) {
      return 'Codebase analysis data is not available.';
    }
    
    if (analysisSummary.analysisError) {
      return `Error during codebase analysis: ${analysisSummary.analysisError}`;
    }

    let contextLines: string[] = [];
    contextLines.push("## Codebase Context Summary:");

    
    contextLines.push(`- **Project Type:** ${analysisSummary.projectType || 'Unknown'}`);
    if (analysisSummary.languageSummary) {
      const topLangs = Object.entries(analysisSummary.languageSummary)
                             .sort(([,a],[,b]) => b.count - a.count)
                             .slice(0,3)
                             .map(([lang, data]) => `${lang} (${data.percentage.toFixed(1)}%)`);
      if (topLangs.length > 0) contextLines.push(`- **Top Languages:** ${topLangs.join(', ')}`);
    }

    
    const keyFiles: string[] = [];
    if (analysisSummary.keyConfigFileInsights) {
      keyFiles.push(...Object.keys(analysisSummary.keyConfigFileInsights));
    }
    if (analysisSummary.readmeSummary) {
      
      if (!keyFiles.includes('README.md') && analysisSummary.keyConfigFileInsights && analysisSummary.keyConfigFileInsights['README.md'] === undefined) {
         if (analysisSummary.readmeSummary.join('').includes("README.md found")) {
             keyFiles.push('README.md');
         }
      } else if (analysisSummary.readmeSummary.join('').includes("README.md found")) {
          
          if (!keyFiles.includes('README.md')) keyFiles.push('README.md');
      }
    }
    
    
    if (analysisSummary.planMdSummary && analysisSummary.planMdSummary.length > 0) {
      if (!keyFiles.includes('PLAN.md') && analysisSummary.planMdSummary.join('').includes("PLAN.md found")) {
        keyFiles.push('PLAN.md');
      }
    }
    
    
    if (keyFiles.length > 0) {
        contextLines.push(`- **Key Files Found:** ${[...new Set(keyFiles)].join(', ')}`); 
    } else {
        contextLines.push("- **Key Files Found:** No standard configuration or documentation files detected at the root.");
    }


    
    if (analysisSummary.structureSummary && analysisSummary.structureSummary.length > 0) {
      contextLines.push(`- **Top-Level Directories:** ${analysisSummary.structureSummary.slice(0, 7).join(', ')}${analysisSummary.structureSummary.length > 7 ? '...' : ''}`);
    } else {
      contextLines.push("- **Top-Level Directories:** Project appears flat or structure unclear.");
    }

    
    if (analysisSummary.keyEntryPoints && analysisSummary.keyEntryPoints.length > 0) {
      contextLines.push(`- **Potential Entry Point(s):** ${analysisSummary.keyEntryPoints.join(', ')}`);
    }
    
    
    if (analysisSummary.readmeSummary && analysisSummary.readmeSummary.length > 0 && !analysisSummary.readmeSummary[0].includes("Error reading")) {
        const firstHeading = analysisSummary.readmeSummary.find(line => !line.includes("README.md found"));
        if (firstHeading) {
            contextLines.push(`- **README Summary:** Starts with section "${firstHeading}".`);
        } else {
             contextLines.push(`- **README Summary:** Found, but structure unclear.`);
        }
    }
    
    
    if (analysisSummary.planMdSummary && analysisSummary.planMdSummary.length > 0) {
        const firstHeading = analysisSummary.planMdSummary.find(line => !line.includes("PLAN.md found"));
        if (firstHeading) {
            contextLines.push(`- **PLAN.md Summary:** Includes section "${firstHeading}".`);
        } else {
            contextLines.push(`- **PLAN.md Summary:** Found and will be considered for task planning.`);
        }
    }

    
    contextLines.push(''); 

    return contextLines.join('\n');
  }


  private extractFunctionSignature(node: ts.FunctionLikeDeclarationBase, sourceFile: ts.SourceFile): CodeSymbolSignature {
    const parameters: CodeSymbolParameter[] = node.parameters.map(param => {
      const name = param.name.getText(sourceFile);
      const type = param.type?.getText(sourceFile);
      const optional = !!param.questionToken;
      const defaultValue = param.initializer?.getText(sourceFile);
      return { name, type, optional, defaultValue };
    });
    const returnType = node.type?.getText(sourceFile);
    return { parameters, returnType };
  }
  
  private getNodeComment(node: ts.Node | undefined, sourceFile: ts.SourceFile): string | undefined {
    if (!node) return undefined;
    
    const fullText = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
    if (commentRanges && commentRanges.length > 0) {
      return commentRanges.map(range => fullText.substring(range.pos, range.end)).join('\n');
    }
    return undefined;
  }


  

  private getTaskTemplatesDir(): string {
    
    return path.join(this.workspaceRoot, '.conductor', 'templates');
  }

  async listTaskTemplates(): Promise<string[]> {
    const templatesDir = this.getTaskTemplatesDir();
    if (!fs.existsSync(templatesDir)) {
      logger.info(`Task templates directory does not exist: ${templatesDir}`);
      return [];
    }
    try {
      const files = await fs.promises.readdir(templatesDir);
      return files
        .filter(file => file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.parse(file).name); 
    } catch (error) {
      logger.error(`Error listing task templates in ${templatesDir}:`, error);
      return [];
    }
  }

  async getTaskTemplate(templateName: string): Promise<TaskTemplate | undefined> {
    const templatesDir = this.getTaskTemplatesDir();
    
    const extensionsToTry = ['.json', '.yaml', '.yml'];
    let templatePath = '';
    let found = false;

    for (const ext of extensionsToTry) {
      templatePath = path.join(templatesDir, `${templateName}${ext}`);
      if (fs.existsSync(templatePath)) {
        found = true;
        break;
      }
    }

    if (!found) {
      logger.warn(`Task template not found: ${templateName} in ${templatesDir}`);
      return undefined;
    }

    try {
      const fileContent = await fs.promises.readFile(templatePath, 'utf8');
      if (templatePath.endsWith('.json')) {
        return JSON.parse(fileContent) as TaskTemplate;
      } else if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
        
        
        
        logger.warn(`YAML parsing for templates is not fully implemented yet. Attempting JSON parse for ${templateName}`);
        
        
        
        try {
            return JSON.parse(fileContent) as TaskTemplate; 
        } catch (e) {
            throw new Error(`Failed to parse YAML/JSON template ${templateName}: ${e}`);
        }
      }
    } catch (error) {
      logger.error(`Error reading or parsing task template ${templateName} from ${templatePath}:`, error);
    }
    return undefined;
  }

  private _applyTemplateVariables(text: string, variables: Record<string, string>): string {
    let processedText = text;
    for (const key in variables) {
      const placeholder = `{{${key}}}`;
      
      processedText = processedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), variables[key]);
    }
    return processedText;
  }

  private async createTaskFromTemplateDefinition(
    templateDefinition: TaskTemplateDefinition,
    variables: Record<string, string>,
    parentId?: string
  ): Promise<string> {
    const title = this._applyTemplateVariables(templateDefinition.title, variables);
    const description = this._applyTemplateVariables(templateDefinition.description, variables);
    
    const tags = templateDefinition.tags 
      ? templateDefinition.tags.map((tag: string) => this._applyTemplateVariables(tag, variables))
      : [];

    
    const taskId = await this.createTask(title, description, undefined, parentId);
    const task = this.getTask(taskId);

    if (task) {
      if (templateDefinition.priority) task.priority = templateDefinition.priority;
      if (templateDefinition.complexity) task.complexity = templateDefinition.complexity;
      task.tags = tags;
      
      
      this.updateTask(taskId, { 
        priority: task.priority, 
        complexity: task.complexity, 
        tags: task.tags 
      });
    } else {
      throw new Error(`Failed to create or retrieve task for template definition: ${title}`);
    }

    
    if (templateDefinition.subtask_templates && templateDefinition.subtask_templates.length > 0) {
      for (const subTemplate of templateDefinition.subtask_templates) {
        await this.createTaskFromTemplateDefinition(subTemplate, variables, taskId);
      }
    }
    return taskId;
  }

  async createTaskFromTemplate(templateName: string, variables: Record<string, string>, parentId?: string): Promise<string | undefined> {
    const template = await this.getTaskTemplate(templateName);
    if (!template) {
      throw new Error(`Task template "${templateName}" not found.`);
    }

    
    

    return this.createTaskFromTemplateDefinition(template.task, variables, parentId);
  }

  

  public async generateDiffForChange(
    filePath: string, 
    changeDescription: string, 
    selection?: { startLine: number; endLine: number }
  ): Promise<string> {
    const absoluteFilePath = path.resolve(this.workspaceRoot, filePath);
    if (!fs.existsSync(absoluteFilePath)) {
      throw new Error(`File not found: ${absoluteFilePath}`);
    }

    let fileContent = fs.readFileSync(absoluteFilePath, 'utf8');
    let contextContent = fileContent;

    if (selection) {
      const lines = fileContent.split('\n');
      
      contextContent = lines.slice(selection.startLine - 1, selection.endLine).join('\n');
    }

    let broaderCodebaseContext = 'Broader codebase context not available.';
    try {
        const structuredAnalysis = await this.getStructuredCodebaseAnalysis();
        broaderCodebaseContext = this._getCodebaseContextString(structuredAnalysis);
    } catch (e) {
        logger.warn(`Failed to get broader codebase context for diff generation for ${filePath}:`, e);
        
    }

    const prompt = `
You are an expert software engineer. Your task is to generate a diff in the unified format based on the provided file content and a description of the desired change.

# Overall Codebase Context:
${broaderCodebaseContext}

# Specific File Details:
File Path: ${filePath}
Desired Change: ${changeDescription}

Current File Content (or relevant selection if provided):
\`\`\`${path.extname(filePath).substring(1) || 'text'}
${contextContent}
\`\`\`

Please provide ONLY the diff in the unified format that achieves the desired change.
The diff should be applicable to the provided content.
Your entire response MUST be ONLY the diff. Do not include any explanations, comments, code block specifiers (like \`\`\`diff), or any text whatsoever other than the diff itself.
The diff must start with "--- a/${filePath}" and include "+++ b/${filePath}".
`;

    try {
      const result = await this.llmManager.sendRequest({
        prompt,
        systemPrompt: "You are a diff generation tool. Output only the unified diff format.",
        options: { temperature: 0.0 } 
      });
      
      
      const diffOutput = result.text.trim();
      if (!diffOutput.startsWith('--- a/') || !diffOutput.includes('+++ b/')) {
        logger.warn(`LLM did not return a valid-looking diff for ${filePath}. Output: ${diffOutput.substring(0, 200)}...`);
        
        
        
        
      }
      return diffOutput;

    } catch (error) {
      logger.error(`Error generating diff for ${filePath}:`, error);
      throw errorHandler.createLLMError(
        `Failed to generate diff for ${filePath}`,
        { operation: 'generate_diff', additionalInfo: { filePath, changeDescription } },
        ErrorSeverity.ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
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

    let codebaseContext = 'Codebase context analysis not available or failed.';
    try {
      const structuredAnalysis = await this.getStructuredCodebaseAnalysis();
      codebaseContext = this._getCodebaseContextString(structuredAnalysis);
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

# FINAL CHECKLIST BEFORE RESPONDING:
- Does the response use Markdown formatting?
- Are all four main sections (## Implementation Plan, ## Key Considerations, ## Verification & Testing, ## Missing Information (Optional)) included?
- Are implementation steps concrete, actionable, and broken down appropriately?
- Is the response free of any introductory/concluding text or apologies outside the defined structure?
`;

    try {
      const result = await this.llmManager.sendRequest({ 
        prompt,
        taskName: "generate-implementation-steps" // Add taskName for provider routing
      });

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
${projectContext || 'No specific project context provided.'}

# CODEBASE CONTEXT SUMMARY (for overall project understanding, may not be directly relevant to task structure but provides background):
${await (async () => { 
    try { 
        const structuredAnalysis = await this.getStructuredCodebaseAnalysis(); 
        return this._getCodebaseContextString(structuredAnalysis); 
    } catch (e) { 
        logger.warn('Failed to analyze codebase for task expansion', e); 
        return 'Codebase analysis failed or not available.'; 
    } 
})()}

# ADDITIONAL EXPANSION REQUIREMENTS FROM USER:
${expansionPrompt || 'None provided.'}\n\n
# INSTRUCTIONS:
Based *only* on the information provided, expand and refine the task. Your response **must** include the following sections clearly marked. Be comprehensive but avoid unnecessary verbosity.

1.  **## Expanded Description:**
    *   Rewrite the original description to be significantly more detailed, specific, and unambiguous.
    *   Incorporate any relevant details from the project context or user requirements to provide full clarity.
    *   Ensure the expanded description clearly and comprehensively states the goal and scope of the task.

2.  **## Suggested Metadata:**
    *   **Complexity**: Suggest an appropriate complexity score (integer 1-10). Briefly justify your suggestion based on the expanded scope. (Current: ${task.complexity || 'Not Set'})
    *   **Priority**: Suggest an appropriate priority level (\`critical\`, \`high\`, \`medium\`, \`low\`, \`backlog\`). Briefly justify your suggestion. (Current: ${task.priority})
    *   **Tags**: Suggest 3-5 additional or revised relevant tags. (Current: ${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'})

3.  **## Proposed Subtasks:**
    *   Define 3-5 distinct, concrete, and actionable subtasks required to complete the main task.
    *   Each subtask title should be action-oriented. Each description should be a clear, brief explanation of what needs to be done for that subtask.
    *   Format *exactly* as: \`- [Subtask Title]: [Brief subtask description]\` (one per line).
    *   Ensure subtasks are logically sequenced if possible, representing a clear path to completion.

4.  **## Acceptance Criteria:**
    *   List 3-5 specific, measurable, achievable, relevant, and time-bound (SMART-like) criteria.
    *   Each criterion should be a single, verifiable statement that defines what conditions must be met for the main task to be considered "Done".

**Output Format:**
*   Use Markdown.
*   Strictly follow the section headings (e.g., \`## Expanded Description:\`) and formatting specified above.
*   Focus on actionable improvements and clarity.

# FINAL CHECKLIST BEFORE RESPONDING:
- Does the response use Markdown formatting?
- Are all four main sections (## Expanded Description, ## Suggested Metadata, ## Proposed Subtasks, ## Acceptance Criteria) included?
- Is the "Proposed Subtasks" section formatted correctly as a list of "- [Title]: [Description]"?
- Is the response free of any introductory/concluding text or apologies outside the defined structure?
`; 

    try {
      const result = await this.llmManager.sendRequest({ 
        prompt,
        taskName: "expand-task" // Add taskName for provider routing
      });

      if (!this.tasks.has(taskId)) {
        throw new Error(`Task with ID ${taskId} was deleted while expanding`);
      }

      
      const output = result.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      
      
      const newSubtasks: { title: string, description: string }[] = [];
      const subtaskRegex = /-\s*\[([^\]]+)\]:\s*(.+)/g; 
      let match;
      const proposedSubtasksSectionMatch = output.match(/## Proposed Subtasks:\s*([\s\S]*?)(?=\n## Acceptance Criteria:|$)/i);

      if (proposedSubtasksSectionMatch && proposedSubtasksSectionMatch[1]) {
        const subtasksBlock = proposedSubtasksSectionMatch[1];
        while ((match = subtaskRegex.exec(subtasksBlock)) !== null) {
          newSubtasks.push({ title: match[1].trim(), description: match[2].trim() });
        }
      }


      if (newSubtasks.length > 0) {
        
        for (const subTaskData of newSubtasks) {
          await this.createSubtask(taskId, subTaskData.title, subTaskData.description);
        }
      }
      
      
      const expandedDescMatch = output.match(/## Expanded Description:\s*([\s\S]*?)(?=\n## Suggested Metadata:|$)/i);
      if (expandedDescMatch && expandedDescMatch[1]) {
        task.description = expandedDescMatch[1].trim();
      }

      
      const complexityMatch = output.match(/Complexity\s*:\s*Suggest an appropriate complexity score \(integer 1-10\)\.\s*Briefly justify your suggestion based on the expanded scope\.\s*\(Current: [^\)]+\)\s*([0-9]+)/i);
      if (complexityMatch && complexityMatch[1]) {
        const newComplexity = parseInt(complexityMatch[1], 10);
        if (!isNaN(newComplexity) && newComplexity >= 1 && newComplexity <= 10) {
          task.complexity = newComplexity;
        }
      }
      

      this.updateTask(taskId, { 
        description: task.description, 
        complexity: task.complexity 
        
      });

      this.addTaskNote(
        taskId,
        `# AI Task Expansion Output:\n\n${output}`, 
        'AI_EXPANDER',
        'solution' 
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
${subtasks.length > 0 ? subtasks.map(s => `- [${s.status === TaskStatus.DONE ? 'x' : ' '}] ${s.title} (Status: ${s.status})`).join('\n') : 'None'}

# CODEBASE CONTEXT SUMMARY (for overall project understanding):
${await (async () => { 
    try { 
        const structuredAnalysis = await this.getStructuredCodebaseAnalysis(); 
        return this._getCodebaseContextString(structuredAnalysis); 
    } catch (e) { 
        logger.warn('Failed to analyze codebase for task improvement suggestions', e); 
        return 'Codebase analysis failed or not available.'; 
    } 
})()}\n\n
# INSTRUCTIONS:
Based *only* on the information provided, analyze the task and provide specific, actionable suggestions for improvement. Focus on making the task clearer, more manageable, and more likely to succeed. Your suggestions should be concrete and directly implementable.

**Output Format:** Use Markdown.
**Address the following areas specifically, using these exact headings. Be thorough yet concise in your suggestions under each heading:**

1.  **## Clarity & Specificity:**
    *   Critique the current title and description for clarity, unambiguity, and specificity. If improvements are needed, provide concrete suggestions for rewording or adding detail.
    *   Assess if the task's goals are well-defined and measurable. If not, suggest how to make them so.

2.  **## Completeness:**
    *   Identify any obvious missing details, requirements, or acceptance criteria. For each identified gap, suggest specific information or criteria that should be added.

3.  **## Structure & Breakdown:**
    *   Evaluate if the task is appropriately sized for effective management. If it appears too large or complex, suggest how it could be broken down into more manageable subtasks (provide example titles/descriptions for 2-3 key subtasks).
    *   If subtasks exist, assess their logical flow and sufficiency. Suggest improvements if needed.

4.  **## Metadata Accuracy:**
    *   **Priority**: Does the current priority (\`${task.priority}\`) accurately reflect its importance given the task details and context? Justify your assessment and suggest a change if appropriate.
    *   **Complexity**: Does the current complexity score (\`${task.complexity || 'Not Set'}/10\`) seem accurate? Justify and suggest a revised score if needed.
    *   **Tags**: Are the current tags (\`${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'}\`) relevant and sufficient? Suggest specific tags to add or remove, with brief rationale.

5.  **## Potential Blockers & Dependencies:**
    *   Identify any potential risks, blockers, or dependencies implied by the task information that are not explicitly tracked. List them clearly.

**Tone:** Constructive, professional, and helpful.
`;

    try {
      const result = await this.llmManager.sendRequest({ 
        prompt,
        taskName: "suggest-task-improvements" // Add taskName for provider routing
      });

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
    absoluteFilePath: string 
  ): Promise<string> {
    try {
      if (!absoluteFilePath) {
        throw new Error("absoluteFilePath is required for task initialization");
      }
      if (!path.isAbsolute(absoluteFilePath)) {
        logger.error(`mcpInitializeTasks received a non-absolute path: ${absoluteFilePath}. This is unexpected and should be resolved by the caller.`);
        throw new Error(`mcpInitializeTasks expects an absolute filePath. Received: ${absoluteFilePath}`);
      }
      
      logger.info(`Initializing tasks with project: ${projectName}, using absoluteFilePath: ${absoluteFilePath}`);
      
      
      
      this.workspaceRoot = path.dirname(absoluteFilePath);
      logger.info(`Workspace root set to directory of TASKS.md: ${this.workspaceRoot}`);

      try {
        
        
        process.chdir(this.workspaceRoot);
        logger.info(`Changed process.cwd() to workspace root: ${process.cwd()}`);
      } catch (err) {
        logger.warn(`Failed to change process.cwd() to workspace root: ${err}. Operations will rely on explicit paths.`);
      }

      
      
      
      
      await this.initialize(projectName, projectDescription, absoluteFilePath);
      
      
      
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
