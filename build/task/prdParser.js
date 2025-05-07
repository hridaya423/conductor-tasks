import fs from 'fs';
import path from 'path';
import { ErrorHandler, ErrorCategory, ErrorSeverity, TaskError } from '../core/errorHandler.js';
import { TaskPriority, TaskStatus } from '../core/types.js';
import { z } from 'zod';
import { JsonUtils } from '../core/jsonUtils.js';
const errorHandler = ErrorHandler.getInstance();
const ExtractedTaskSchema = z.object({
    title: z.string().min(3).max(150),
    description: z.string().min(10),
    priority: z.enum(['critical', 'high', 'medium', 'low', 'backlog']),
    complexity: z.number().int().min(1).max(10),
    dependencies: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([])
});
const ExtractedTasksSchema = z.array(ExtractedTaskSchema);
export class PRDParser {
    constructor(taskManager, llmClient) {
        this.maxRetries = 2;
        this.allowedDocumentTypes = ['.md', '.txt', '.doc', '.docx', '.pdf', '.html'];
        this.taskManager = taskManager;
        this.llmClient = llmClient;
        if (process.env.PRD_PARSER_MAX_RETRIES) {
            this.maxRetries = parseInt(process.env.PRD_PARSER_MAX_RETRIES, 10);
        }
    }
    async parsePRD(prdFilePath, createTasksFile = false) {
        try {
            if (!this.validateFileType(prdFilePath)) {
                throw new TaskError(`Unsupported file type. Supported types: ${this.allowedDocumentTypes.join(', ')}`, ErrorCategory.VALIDATION, ErrorSeverity.ERROR, { operation: 'parsePRD', targetFile: prdFilePath });
            }
            const prdContent = await this.readPRDFile(prdFilePath);
            if (!prdContent) {
                throw new TaskError(`Could not read PRD file at ${prdFilePath}`, ErrorCategory.FILESYSTEM, ErrorSeverity.ERROR, { operation: 'parsePRD', targetFile: prdFilePath });
            }
            const tasks = await this.extractTasksFromPRD(prdContent);
            if (tasks.length === 0) {
                throw new TaskError('No tasks could be extracted from the PRD document', ErrorCategory.PARSING, ErrorSeverity.ERROR, { operation: 'parsePRD', targetFile: prdFilePath, additionalInfo: { contentLength: prdContent.length } });
            }
            const taskIds = this.createTasksFromExtraction(tasks);
            if (createTasksFile) {
                await this.generateTasksMarkdown();
            }
            return taskIds;
        }
        catch (error) {
            const taskError = error instanceof TaskError ? error : new TaskError(`Error parsing PRD: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.PARSING, ErrorSeverity.ERROR, { operation: 'parsePRD', targetFile: prdFilePath }, error instanceof Error ? error : undefined);
            errorHandler.handleError(taskError);
            throw taskError;
        }
    }
    validateFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.allowedDocumentTypes.includes(ext);
    }
    async readPRDFile(prdFilePath) {
        try {
            const fullPath = path.resolve(prdFilePath);
            return fs.readFileSync(fullPath, 'utf-8');
        }
        catch (error) {
            errorHandler.handleError(new TaskError(`Error reading PRD file: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.FILESYSTEM, ErrorSeverity.ERROR, { operation: 'readPRDFile', targetFile: prdFilePath }, error instanceof Error ? error : undefined));
            return null;
        }
    }
    preprocessContent(content) {
        let processed = content.replace(/\s+/g, ' ');
        processed = processed.replace(/#{1,6}\s+/g, '');
        if (processed.length < 100) {
            errorHandler.handleError(new TaskError('PRD content seems too short for meaningful analysis', ErrorCategory.VALIDATION, ErrorSeverity.WARNING, { operation: 'preprocessContent', additionalInfo: { contentLength: content.length } }));
        }
        return processed;
    }
    extractJsonFromText(text) {
        try {
            const jsonArray = JsonUtils.extractJsonArray(text, false);
            if (jsonArray !== null) {
                return jsonArray;
            }
            throw new Error(`Could not extract valid JSON array from response after multiple attempts`);
        }
        catch (sanitizeError) {
            throw new Error(`Failed to extract JSON from response: ${sanitizeError instanceof Error ? sanitizeError.message : 'Unknown error'}`);
        }
    }
    async extractTasksFromPRD(prdContent) {
        const processedContent = this.preprocessContent(prdContent);
        const systemPrompt = `CRITICAL: You are a pure JSON response system that creates tasks from project requirements documents.
Your ONLY output must be a valid JSON array containing task objects - NOTHING else.
ANY text outside the JSON array will cause system failure.
DO NOT use markdown code blocks, explanations, prefixes, or any non-JSON text.
The first character of your response must be '[' and the last character must be ']'.`;
        const prompt = `PURE JSON RESPONSE REQUIRED: Convert this PRD into tasks as a JSON array.

Here's the PRD:
---
${processedContent}
---

===== RESPONSE FORMAT REQUIREMENTS =====
1. Your ENTIRE response must be ONLY a valid JSON array
2. NO text, explanations, or comments before or after the JSON
3. NO markdown formatting, backticks, or code blocks
4. FIRST response character MUST be '['
5. LAST response character MUST be ']'
6. NEVER include "Here is the JSON:" or any similar prefix text

Task object schema:
{
  "title": "Short descriptive task title (3-150 chars)",
  "description": "Detailed implementation description (10+ chars)",
  "priority": "critical|high|medium|low|backlog",
  "complexity": Integer from 1-10,
  "dependencies": ["ids", "of", "prerequisite", "tasks"],
  "tags": ["relevant", "tags"]
}

Example of CORRECT response format:
[{"title":"Task 1","description":"Description 1","priority":"high","complexity":5,"dependencies":[],"tags":["frontend"]},{"title":"Task 2","description":"Description 2","priority":"medium","complexity":3,"dependencies":["Task 1"],"tags":["backend"]}]

TECHNICAL REQUIREMENT: Your response must be valid JSON parseable by JavaScript's JSON.parse() function.
ANY characters outside the JSON array will cause a system crash.`;
        let retryCount = 0;
        let lastError = null;
        while (retryCount <= this.maxRetries) {
            try {
                if (retryCount > 0) {
                    const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    const retrySystemPrompt = `${systemPrompt}\n\nCRITICAL REMINDER: Your previous response had formatting issues. You MUST output ONLY the JSON array with NO other text. Start with '[' and end with ']'. No explanations or code blocks.`;
                }
                const response = await this.llmClient.complete({
                    prompt: prompt,
                    systemPrompt: systemPrompt,
                    maxTokens: 4000,
                    temperature: 0.01,
                });
                let tasksData;
                try {
                    tasksData = this.extractJsonFromText(response);
                    if (!tasksData || !Array.isArray(tasksData) || tasksData.length === 0) {
                        throw new Error('Extracted data is not a valid non-empty array');
                    }
                }
                catch (jsonError) {
                    const errorMsg = `Failed to extract JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`;
                    errorHandler.handleError(new TaskError(errorMsg, ErrorCategory.PARSING, ErrorSeverity.ERROR, { operation: 'extractTasksFromPRD' }, jsonError instanceof Error ? jsonError : undefined));
                    if (retryCount < this.maxRetries) {
                        retryCount++;
                        continue;
                    }
                    throw new Error(errorMsg);
                }
                try {
                    const validatedTasks = ExtractedTasksSchema.parse(tasksData);
                    return validatedTasks;
                }
                catch (validationError) {
                    errorHandler.handleError(new TaskError(`Task validation error: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`, ErrorCategory.VALIDATION, ErrorSeverity.ERROR, { operation: 'extractTasksFromPRD' }, validationError instanceof Error ? validationError : undefined));
                    if (retryCount < this.maxRetries) {
                        retryCount++;
                        continue;
                    }
                    throw new Error(`Task validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                errorHandler.handleError(new TaskError(`Error during PRD parsing (attempt ${retryCount + 1}/${this.maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.PARSING, ErrorSeverity.ERROR, { operation: 'extractTasksFromPRD', additionalInfo: { retryCount } }, error instanceof Error ? error : undefined));
                if (retryCount < this.maxRetries) {
                    retryCount++;
                    continue;
                }
                if (lastError) {
                    throw lastError;
                }
                else {
                    throw new Error('Failed to extract tasks from PRD after multiple attempts');
                }
            }
        }
        throw new Error('Unreachable code: all PRD parsing attempts failed');
    }
    createTasksFromExtraction(extractedTasks) {
        const taskIds = [];
        const titleToIdMap = new Map();
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
                }
                catch (error) {
                    errorHandler.handleError(new TaskError(`Failed to create task "${task.title}": ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.UNKNOWN, ErrorSeverity.ERROR, { operation: 'createTasksFromExtraction' }, error instanceof Error ? error : undefined));
                }
            }
            for (let i = 0; i < extractedTasks.length; i++) {
                const task = extractedTasks[i];
                const taskId = taskIds[i];
                if (!taskId)
                    continue;
                try {
                    const dependencyIds = task.dependencies
                        .map(depTitle => titleToIdMap.get(depTitle))
                        .filter(Boolean);
                    if (dependencyIds.length > 0) {
                        this.taskManager.updateTask(taskId, {
                            dependencies: dependencyIds
                        });
                    }
                }
                catch (error) {
                    errorHandler.handleError(new TaskError(`Failed to update dependencies for task "${task.title}": ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.UNKNOWN, ErrorSeverity.WARNING, { operation: 'createTasksFromExtraction', taskId }, error instanceof Error ? error : undefined));
                }
            }
        }
        catch (error) {
            errorHandler.handleError(new TaskError(`Error creating tasks from extraction: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.UNKNOWN, ErrorSeverity.ERROR, { operation: 'createTasksFromExtraction' }, error instanceof Error ? error : undefined));
        }
        return taskIds;
    }
    mapStringToPriority(priority) {
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
    async generateTasksMarkdown() {
        try {
            const tasks = this.taskManager.getTasks({
                sortBy: 'priority',
                sortDirection: 'asc'
            });
            let markdown = `# Project Tasks\n\n`;
            markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
            const statusCounts = new Map();
            const priorityCounts = new Map();
            tasks.forEach(task => {
                statusCounts.set(task.status, (statusCounts.get(task.status) || 0) + 1);
                priorityCounts.set(task.priority, (priorityCounts.get(task.priority) || 0) + 1);
            });
            markdown += `## Task Statistics\n\n`;
            markdown += `Total Tasks: ${tasks.length}\n\n`;
            markdown += `### Status Breakdown\n\n`;
            for (const [status, count] of statusCounts.entries()) {
                markdown += `- ${status}: ${count} (${Math.round(count / tasks.length * 100)}%)\n`;
            }
            markdown += `\n### Priority Breakdown\n\n`;
            for (const [priority, count] of priorityCounts.entries()) {
                markdown += `- ${priority}: ${count} (${Math.round(count / tasks.length * 100)}%)\n`;
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
        }
        catch (error) {
            errorHandler.handleError(new TaskError(`Error generating tasks markdown: ${error instanceof Error ? error.message : String(error)}`, ErrorCategory.FILESYSTEM, ErrorSeverity.ERROR, { operation: 'generateTasksMarkdown' }, error instanceof Error ? error : undefined));
        }
    }
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
}
//# sourceMappingURL=prdParser.js.map