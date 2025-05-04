import fs from 'fs';
import path from 'path';
import { TaskManager } from '../taskManager.js';
import { LLMClient } from '../core/types.js';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../core/errorHandler.js';
import { TaskPriority, TaskStatus } from '../core/types.js';
import { z } from 'zod';

const errorHandler = ErrorHandler.getInstance();

const ExtractedTaskSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(10),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'backlog']),
  complexity: z.number().int().min(1).max(10),
  dependencies: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});

type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

const ExtractedTasksSchema = z.array(ExtractedTaskSchema);

export class PRDParser {
  private taskManager: TaskManager;
  private llmClient: LLMClient;
  private maxRetries: number = 2;
  private allowedDocumentTypes: string[] = ['.md', '.txt', '.doc', '.docx', '.pdf', '.html'];

  constructor(taskManager: TaskManager, llmClient: LLMClient) {
    this.taskManager = taskManager;
    this.llmClient = llmClient;

    if (process.env.PRD_PARSER_MAX_RETRIES) {
      this.maxRetries = parseInt(process.env.PRD_PARSER_MAX_RETRIES, 10);
    }
  }

  async parsePRD(prdFilePath: string, createTasksFile: boolean = false): Promise<string[]> {
    try {
      if (!this.validateFileType(prdFilePath)) {
        throw new TaskError(
          `Unsupported file type. Supported types: ${this.allowedDocumentTypes.join(', ')}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.ERROR,
          { operation: 'parsePRD', targetFile: prdFilePath }
        );
      }

      const prdContent = await this.readPRDFile(prdFilePath);
      if (!prdContent) {
        throw new TaskError(
          `Could not read PRD file at ${prdFilePath}`,
          ErrorCategory.FILESYSTEM,
          ErrorSeverity.ERROR,
          { operation: 'parsePRD', targetFile: prdFilePath }
        );
      }

      const tasks = await this.extractTasksFromPRD(prdContent);

      if (tasks.length === 0) {
        throw new TaskError(
          'No tasks could be extracted from the PRD document',
          ErrorCategory.PARSING,
          ErrorSeverity.ERROR,
          { operation: 'parsePRD', targetFile: prdFilePath, additionalInfo: { contentLength: prdContent.length } }
        );
      }

      const taskIds = this.createTasksFromExtraction(tasks);

      if (createTasksFile) {
        await this.generateTasksMarkdown();
      }

      return taskIds;
    } catch (error) {

      const taskError = error instanceof TaskError ? error : new TaskError(
        `Error parsing PRD: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCategory.PARSING,
        ErrorSeverity.ERROR,
        { operation: 'parsePRD', targetFile: prdFilePath },
        error instanceof Error ? error : undefined
      );

      errorHandler.handleError(taskError);

      throw taskError;
    }
  }

  private validateFileType(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedDocumentTypes.includes(ext);
  }

  private async readPRDFile(prdFilePath: string): Promise<string | null> {
    try {
      const fullPath = path.resolve(prdFilePath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (error) {
      errorHandler.handleError(
        new TaskError(
          `Error reading PRD file: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.FILESYSTEM,
          ErrorSeverity.ERROR,
          { operation: 'readPRDFile', targetFile: prdFilePath },
          error instanceof Error ? error : undefined
        )
      );
      return null;
    }
  }

  private preprocessContent(content: string): string {

    let processed = content.replace(/\s+/g, ' ');

    processed = processed.replace(/#{1,6}\s+/g, '');

    if (processed.length < 100) {
      errorHandler.handleError(
        new TaskError(
          'PRD content seems too short for meaningful analysis',
          ErrorCategory.VALIDATION,
          ErrorSeverity.WARNING,
          { operation: 'preprocessContent', additionalInfo: { contentLength: content.length } }
        )
      );
    }

    return processed;
  }

  private async extractTasksFromPRD(prdContent: string): Promise<ExtractedTask[]> {

    const processedContent = this.preprocessContent(prdContent);

    const prompt = `
You are an expert project manager and developer tasked with breaking down a Product Requirements Document (PRD) into concrete, actionable implementation tasks.

Here's the PRD:
---
${processedContent}
---

Based on the PRD, identify a complete set of implementation tasks required to build this product. Each task should be:
1. Specific and actionable
2. At an appropriate level of granularity (not too broad, not too detailed)
3. Described clearly enough that a developer could understand what needs to be done

For each task, provide:
- A clear, concise title (3-10 words)
- A detailed description (2-5 sentences explaining exactly what needs to be implemented)
- An appropriate priority level (critical, high, medium, low, or backlog)
- A complexity rating from 1-10 (10 being most complex)
- Tags for categorization (e.g., "frontend", "backend", "database", "auth", etc.)
- Dependencies (list any task titles that must be completed before this task can start)

Format your response as a valid JSON array of task objects with these exact fields:
[
  {
    "title": "string",
    "description": "string",
    "priority": "critical|high|medium|low|backlog",
    "complexity": number,
    "dependencies": ["string"],
    "tags": ["string"]
  }
]

Return ONLY the JSON array with no additional text or explanation. Ensure the JSON is properly formatted and valid.
`;

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.maxRetries) {
      try {

        if (retryCount > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));

          errorHandler.handleError(
            new TaskError(
              `Retrying PRD parsing (attempt ${retryCount}/${this.maxRetries})`,
              ErrorCategory.PARSING,
              ErrorSeverity.WARNING,
              { operation: 'extractTasksFromPRD', additionalInfo: { retryCount } }
            ),
            true
          );
        }

        const response = await this.llmClient.complete({
          prompt: prompt,

          maxTokens: 4000,
          temperature: 0.2, 
        });

        const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (!jsonMatch) {
          throw new Error("Could not extract valid JSON from LLM response");
        }

        const jsonText = jsonMatch[0];

        try {

          const parsedTasks = JSON.parse(jsonText);
          const validationResult = ExtractedTasksSchema.safeParse(parsedTasks);

          if (!validationResult.success) {
            throw new Error(`Invalid task format: ${validationResult.error.message}`);
          }

          return validationResult.data;
        } catch (parseError) {
          throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (retryCount < this.maxRetries) {
          retryCount++;
          continue;
        }

        errorHandler.handleError(
          new TaskError(
            `Failed to extract tasks from PRD after ${retryCount} retries: ${lastError.message}`,
            ErrorCategory.PARSING,
            ErrorSeverity.ERROR,
            { operation: 'extractTasksFromPRD' },
            lastError
          )
        );

        return [];
      }
    }

    return [];
  }

  private createTasksFromExtraction(extractedTasks: ExtractedTask[]): string[] {
    const taskIds: string[] = [];
    const titleToIdMap = new Map<string, string>();

    try {

      for (const task of extractedTasks) {
        try {

          const taskId = this.taskManager.addTask({
            title: task.title,
            description: task.description,
            priority: this.mapStringToPriority(task.priority),
            status: TaskStatus.BACKLOG,
            complexity: task.complexity,
            dependencies: [],
            tags: task.tags,
          });

          taskIds.push(taskId);
          titleToIdMap.set(task.title, taskId);
        } catch (error) {

          errorHandler.handleError(
            new TaskError(
              `Failed to create task "${task.title}": ${error instanceof Error ? error.message : String(error)}`,
              ErrorCategory.UNKNOWN,
              ErrorSeverity.ERROR,
              { operation: 'createTasksFromExtraction' },
              error instanceof Error ? error : undefined
            )
          );
        }
      }

      for (let i = 0; i < extractedTasks.length; i++) {
        const task = extractedTasks[i];
        const taskId = taskIds[i];

        if (!taskId) continue;

        try {
          const dependencyIds = task.dependencies
            .map(depTitle => titleToIdMap.get(depTitle))
            .filter(Boolean) as string[];

          if (dependencyIds.length > 0) {
            this.taskManager.updateTask(taskId, {
              dependencies: dependencyIds
            });
          }
        } catch (error) {

          errorHandler.handleError(
            new TaskError(
              `Failed to update dependencies for task "${task.title}": ${error instanceof Error ? error.message : String(error)}`,
              ErrorCategory.UNKNOWN,
              ErrorSeverity.WARNING,
              { operation: 'createTasksFromExtraction', taskId },
              error instanceof Error ? error : undefined
            )
          );
        }
      }
    } catch (error) {

      errorHandler.handleError(
        new TaskError(
          `Error creating tasks from extraction: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.UNKNOWN,
          ErrorSeverity.ERROR,
          { operation: 'createTasksFromExtraction' },
          error instanceof Error ? error : undefined
        )
      );
    }

    return taskIds;
  }

  private mapStringToPriority(priority: string): TaskPriority {
    switch (priority.toLowerCase()) {
      case 'critical':
        return TaskPriority.CRITICAL;
      case 'high':
        return TaskPriority.HIGH;
      case 'medium':
        return TaskPriority.MEDIUM;
      case 'low':
        return TaskPriority.LOW;
      case 'backlog':
        return TaskPriority.BACKLOG;
      default:
        return TaskPriority.MEDIUM;
    }
  }

  private async generateTasksMarkdown(): Promise<void> {
    try {
      const tasks = this.taskManager.getTasks({
        sortBy: 'priority',
        sortDirection: 'asc'
      });

      let markdown = `# Project Tasks\n\n`;
      markdown += `Generated on ${new Date().toLocaleString()}\n\n`;

      const statusCounts = new Map<TaskStatus, number>();
      const priorityCounts = new Map<TaskPriority, number>();

      tasks.forEach(task => {
        statusCounts.set(task.status, (statusCounts.get(task.status) || 0) + 1);
        priorityCounts.set(task.priority, (priorityCounts.get(task.priority) || 0) + 1);
      });

      markdown += `## Task Statistics\n\n`;
      markdown += `Total Tasks: ${tasks.length}\n\n`;

      markdown += `### Status Breakdown\n\n`;
      for (const [status, count] of statusCounts.entries()) {
        markdown += `- ${status}: ${count} (${Math.round(count/tasks.length*100)}%)\n`;
      }

      markdown += `\n### Priority Breakdown\n\n`;
      for (const [priority, count] of priorityCounts.entries()) {
        markdown += `- ${priority}: ${count} (${Math.round(count/tasks.length*100)}%)\n`;
      }

      markdown += `\n## Table of Contents\n\n`;
      for (const task of tasks) {
        markdown += `- [${task.title}](#${this.slugify(task.title)})\n`;
      }

      markdown += `\n## Task Details\n\n`;
      for (const task of tasks) {
        markdown += `### ${task.title}\n\n`;
        markdown += `- **ID**: ${task.id}\n`;
        markdown += `- **Priority**: ${task.priority}\n`;
        markdown += `- **Status**: ${task.status}\n`;
        markdown += `- **Complexity**: ${task.complexity}/10\n`;

        if (task.dependencies && task.dependencies.length > 0) {
          markdown += `- **Dependencies**:\n`;
          for (const depId of task.dependencies) {
            const depTask = this.taskManager.getTask(depId);
            if (depTask) {
              markdown += `  - ${depTask.title}\n`;
            }
          }
        }

        if (task.tags && task.tags.length > 0) {
          markdown += `- **Tags**: ${task.tags.join(', ')}\n`;
        }

        markdown += `\n**Description**:\n\n${task.description}\n\n`;

        if (task.notes && task.notes.length > 0) {
          markdown += `**Notes**:\n\n`;
          for (const note of task.notes) {
            markdown += `- **${note.type}** (${note.author}, ${new Date(note.timestamp).toLocaleString()}):\n  ${note.content}\n\n`;
          }
        }

        markdown += `---\n\n`;
      }

      const tasksFilePath = this.taskManager.getTasksFilePath();
      fs.writeFileSync(tasksFilePath, markdown, 'utf8');
    } catch (error) {
      errorHandler.handleError(
        new TaskError(
          `Error generating tasks markdown: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.FILESYSTEM,
          ErrorSeverity.ERROR,
          { operation: 'generateTasksMarkdown' },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
