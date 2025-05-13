#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import logger from "./core/logger.js";
import { ContextManager } from "./core/contextManager.js";
import { LLMManager } from "./llm/llmManager.js";
import { TaskManager } from "./task/taskManager.js";
import { TaskPriority, TaskStatus } from "./core/types.js";
import { IDERulesManager } from "./ide/ideRulesManager.js";
import { CreateTaskSchema, createTaskHandler } from "./commands/createTaskHandler.js";
import { UpdateTaskSchema, updateTaskHandler } from "./commands/updateTaskHandler.js";
import { ListTasksSchema, listTasksHandler } from "./commands/listTasksHandler.js";
import { GetTaskSchema, getTaskHandler } from "./commands/getTaskHandler.js";
import { AddTaskNoteSchema, addTaskNoteHandler } from "./commands/addTaskNoteHandler.js";
import { GetNextTaskSchema, getNextTaskHandler } from "./commands/getNextTaskHandler.js";
import { ParsePrdSchema, parsePrdHandler } from "./commands/parsePrdHandler.js";
import { DeleteTaskSchema, deleteTaskHandler } from "./commands/deleteTaskHandler.js";
import { InitializeProjectSchema, initializeProjectHandler } from "./commands/initializeProjectHandler.js";
import { GenerateImplementationStepsSchema, generateImplementationStepsHandler } from "./commands/generateImplementationStepsHandler.js";
import { ExpandTaskSchema, expandTaskHandler } from "./commands/expandTaskHandler.js";
import { SuggestTaskImprovementsSchema, suggestTaskImprovementsHandler } from "./commands/suggestTaskImprovementsHandler.js";
import { HelpImplementTaskSchema, helpImplementTaskHandler } from "./commands/helpImplementTaskHandler.js";
import { VisualizeTasksKanbanSchema, visualizeTasksKanbanHandler } from "./commands/visualizeTasksKanbanHandler.js";
import { VisualizeTasksDependencyTreeSchema, visualizeTasksDependencyTreeHandler } from "./commands/visualizeTasksDependencyTreeHandler.js";
import { VisualizeTasksDashboardSchema, visualizeTasksDashboardHandler } from "./commands/visualizeTasksDashboardHandler.js";
import { ParsePrdFileSchema, parsePrdFileHandler } from "./commands/parsePrdFileHandler.js";
import packageInfo from '../package.json' with { type: 'json' };
dotenv.config();
const llmManager = new LLMManager();
const contextManager = new ContextManager();
const taskManager = new TaskManager(llmManager, contextManager);
const createTaskSchemaObject = z.object(CreateTaskSchema);
const updateTaskSchemaObject = z.object(UpdateTaskSchema);
const listTasksSchemaObject = z.object(ListTasksSchema);
const getTaskSchemaObject = z.object(GetTaskSchema);
const addTaskNoteSchemaObject = z.object(AddTaskNoteSchema);
const getNextTaskSchemaObject = z.object(GetNextTaskSchema);
const parsePrdSchemaObject = z.object(ParsePrdSchema);
const deleteTaskSchemaObject = z.object(DeleteTaskSchema);
const initializeProjectSchemaObject = z.object(InitializeProjectSchema);
const generateImplementationStepsSchemaObject = z.object(GenerateImplementationStepsSchema);
const expandTaskSchemaObject = z.object(ExpandTaskSchema);
const suggestTaskImprovementsSchemaObject = z.object(SuggestTaskImprovementsSchema);
const helpImplementTaskSchemaObject = z.object(HelpImplementTaskSchema);
const visualizeTasksKanbanSchemaObject = z.object(VisualizeTasksKanbanSchema);
const visualizeTasksDependencyTreeSchemaObject = z.object(VisualizeTasksDependencyTreeSchema);
const visualizeTasksDashboardSchemaObject = z.object(VisualizeTasksDashboardSchema);
const parsePrdFileSchemaObject = z.object(ParsePrdFileSchema);
function setupTaskManager(filePath) {
    const workspaceRoot = taskManager.getWorkspaceRoot() || process.cwd();
    const effectivePath = filePath
        ? path.resolve(workspaceRoot, filePath)
        : path.resolve(workspaceRoot, taskManager['config']?.tasksFileName || 'TASKS.md');
    const projectName = path.basename(path.dirname(effectivePath));
    const dir = path.dirname(effectivePath);
    if (!fs.existsSync(dir)) {
        logger.info(`Creating directory for tasks file: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    }
    taskManager.setTasksFilePath(effectivePath);
    logger.info(`TaskManager initialized with tasks file: ${taskManager.getTasksFilePath()}`);
    return taskManager;
}
function formatOutput(data) {
    if (typeof data === 'string') {
        return data;
    }
    return JSON.stringify(data, null, 2);
}
async function runCliCommand(handler, args, schema) {
    const tm = setupTaskManager(args.file);
    const handlerArgs = { ...args };
    delete handlerArgs.$0;
    delete handlerArgs._;
    delete handlerArgs.file;
    delete handlerArgs.serveMcp;
    try {
        const validatedParams = schema ? schema.parse(handlerArgs) : handlerArgs;
        const result = await handler(tm, validatedParams);
        console.log(formatOutput(result));
    }
    catch (error) {
        logger.error(`CLI command failed: ${error.message}`, error);
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}
async function runInitializeCliCommand(args) {
    const tm = taskManager;
    const handlerArgs = { ...args };
    delete handlerArgs.$0;
    delete handlerArgs._;
    delete handlerArgs.file;
    delete handlerArgs.serveMcp;
    try {
        const filePath = args.file || path.join(process.cwd(), 'TASKS.md');
        const dir = path.dirname(filePath);
        const projectName = args.projectName || path.basename(dir);
        const projectDescription = args.projectDescription || `Project located at ${dir}`;
        const params = {
            filePath: filePath,
            projectName: projectName,
            projectDescription: projectDescription
        };
        const validatedParams = initializeProjectSchemaObject.parse(params);
        const result = await initializeProjectHandler(tm, validatedParams);
        console.log(formatOutput(result));
    }
    catch (error) {
        logger.error(`CLI command 'init-project' failed: ${error.message}`, error);
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}
async function startMcpServer() {
    process.env.MCP_MODE = "true";
    if (!process.env.IDE) {
        process.env.IDE = "cursor";
        logger.info(`No IDE environment variable found, setting default: ${process.env.IDE}`);
    }
    else {
        logger.info(`Using IDE environment variable: ${process.env.IDE}`);
    }
    logger.info(`
========================================================
Conductor Task Management System Starting (MCP Mode)
========================================================
Current directory: ${process.cwd()}
Default Tasks file path: ${path.join(process.cwd(), 'TASKS.md')}
IDE Type: ${process.env.IDE}
========================================================
`);
    const tm = setupTaskManager(undefined);
    if (fs.existsSync(tm.getTasksFilePath())) {
        logger.info(`TASKS.md exists at ${tm.getTasksFilePath()}`);
        logger.info(`Task count: ${tm.getTaskCount()}`);
        logger.info(`TaskManager initialized: ${tm.isInitialized()}`);
    }
    else {
        logger.warn(`TASKS.md not found at ${tm.getTasksFilePath()}. Use 'initialize-project' tool.`);
    }
    try {
        const ideRulesManager = IDERulesManager.getInstance();
        ideRulesManager.setIDEType(process.env.IDE.toLowerCase());
        await ideRulesManager.loadRules();
        const currentIdeType = ideRulesManager.getIDEType();
        logger.info(`Using IDE type: ${currentIdeType}`);
        const ideRules = await ideRulesManager.getRules();
        if (ideRules) {
            logger.info(`Loaded ${ideRules.rules.length} IDE-specific rules`);
        }
        else {
            logger.warn('No IDE-specific rules loaded');
        }
        contextManager.setIDERulesManager(ideRulesManager);
    }
    catch (error) {
        logger.error('Failed to initialize IDERulesManager', { error });
    }
    logger.info('=== Conductor Task Management System Started (MCP Mode) ===');
    logger.info(`Default LLM Provider: ${llmManager.getDefaultProvider()}`);
    logger.info(`Available Providers: ${llmManager.getAvailableProviders().join(', ')}`);
    logger.info(`Tasks File Path Used by Server: ${tm.getTasksFilePath()}`);
    logger.info('==================================');
    const server = new McpServer({
        name: "conductor",
        version: packageInfo.version,
    });
    server.tool("create-task", "Create a new task with details", CreateTaskSchema, async (params) => {
        return createTaskHandler(tm, params);
    });
    server.tool("update-task", "Update an existing task's details", UpdateTaskSchema, async (params) => updateTaskHandler(tm, params));
    server.tool("list-tasks", "Get a list of tasks with filtering and sorting options", ListTasksSchema, async (params) => listTasksHandler(tm, params));
    server.tool("get-task", "Get details of a specific task", GetTaskSchema, async (params) => getTaskHandler(tm, params));
    server.tool("add-task-note", "Add a note, progress update, or comment to a task", AddTaskNoteSchema, async (params) => addTaskNoteHandler(tm, params));
    server.tool("get-next-task", "Get the next task to work on", GetNextTaskSchema, async (params) => getNextTaskHandler(tm, params));
    server.tool("parse-prd", "Parse a PRD (Product Requirements Document) and create tasks from it", ParsePrdSchema, async (params) => parsePrdHandler(tm, params));
    server.tool("delete-task", "Delete a task", DeleteTaskSchema, async (params) => deleteTaskHandler(tm, params));
    server.tool("initialize-project", "Initialize the project, including task management (TASKS.md) and IDE rules.", InitializeProjectSchema, async (params) => initializeProjectHandler(tm, params));
    server.tool("generate-implementation-steps", "Generate detailed implementation steps for a task", GenerateImplementationStepsSchema, async (params) => generateImplementationStepsHandler(tm, params));
    server.tool("expand-task", "Expand a task with more detailed information and subtasks", ExpandTaskSchema, async (params) => expandTaskHandler(tm, params));
    server.tool("suggest-task-improvements", "Get AI suggestions for improving a task", SuggestTaskImprovementsSchema, async (params) => suggestTaskImprovementsHandler(tm, params));
    server.tool("help-implement-task", "Get AI assistance to implement a specific task", HelpImplementTaskSchema, async (params) => helpImplementTaskHandler(tm, llmManager, contextManager, params));
    server.tool("visualize-tasks-kanban", "Display tasks in a Kanban board view", VisualizeTasksKanbanSchema, async (params) => visualizeTasksKanbanHandler(tm, params));
    server.tool("visualize-tasks-dependency-tree", "Display task dependency tree", VisualizeTasksDependencyTreeSchema, async (params) => visualizeTasksDependencyTreeHandler(tm, params));
    server.tool("visualize-tasks-dashboard", "Display task dashboard with summary statistics", VisualizeTasksDashboardSchema, async (params) => visualizeTasksDashboardHandler(tm, params));
    server.tool("parse-prd-file", "Parse a PRD file from disk and extract tasks", ParsePrdFileSchema, async (params) => parsePrdFileHandler(tm, params));
    server.tool("list-task-templates", "List available task templates", {}, async (params) => (await import('./commands/listTaskTemplatesHandler.js')).listTaskTemplatesHandler(tm));
    server.tool("get-task-template", "Get details of a specific task template", (await import('./commands/getTaskTemplateHandler.js')).GetTaskTemplateSchema, async (params) => (await import('./commands/getTaskTemplateHandler.js')).getTaskTemplateHandler(tm, params));
    server.tool("create-task-from-template", "Create a new task from a template", (await import('./commands/createTaskFromTemplateHandler.js')).CreateTaskFromTemplateSchema, async (params) => (await import('./commands/createTaskFromTemplateHandler.js')).createTaskFromTemplateHandler(tm, params));
    server.tool("research-topic", "Research a topic using available LLM capabilities (e.g., Perplexity, tool-calling for search).", (await import('./commands/researchTopicHandler.js')).ResearchTopicSchema, async (params) => (await import('./commands/researchTopicHandler.js')).researchTopicHandler(tm, llmManager, params));
    server.tool("generate-diff", "Generate a diff for a file based on a change description.", (await import('./commands/generateDiffHandler.js')).GenerateDiffSchema, async (params) => (await import('./commands/generateDiffHandler.js')).generateDiffHandler(tm, params));
    server.tool("propose-diff", "Propose a diff to be applied to a file. Currently acknowledges only; does not apply.", (await import('./commands/proposeDiffHandler.js')).ProposeDiffSchema, async (params) => (await import('./commands/proposeDiffHandler.js')).proposeDiffHandler(tm, params));
    function isLLMAvailable() {
        try {
            return llmManager.getAvailableProviders().length > 0;
        }
        catch (error) {
            logger.error('Failed to check LLM provider availability', { error });
            return false;
        }
    }
    if (!isLLMAvailable()) {
        logger.warn("No LLM providers available. AI-related features (enhancement, parsing, generation) might be limited or unavailable.");
        logger.warn("To enable LLM features, set at least one API key (e.g., ANTHROPIC_API_KEY, OPENAI_API_KEY) in your environment variables or .env file.");
    }
    logger.info('Starting Conductor MCP Server connection...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Conductor MCP Server connected and listening...');
}
async function main() {
    const cliArgs = yargs(hideBin(process.argv))
        .scriptName("conductor-tasks")
        .option('file', {
        alias: 'f',
        type: 'string',
        description: 'Path to the TASKS.md file',
        global: true
    })
        .option('serve-mcp', {
        type: 'boolean',
        description: 'Run in MCP server mode (for IDE integration)',
        default: false
    })
        .command('init-project', 'Initialize the project, including TASKS.md and IDE rules.', (y) => y
        .option('projectName', { type: 'string', desc: 'Name of the project (inferred from directory if not provided)' })
        .option('projectDescription', { type: 'string', desc: 'Description of the project' })
        .option('filePath', { type: 'string', alias: 'f', desc: 'Path to the TASKS.md file (overrides global -f if used here)' }), (argv) => runInitializeCliCommand(argv))
        .command('create', 'Create a new task', (y) => y
        .option('title', { type: 'string', demandOption: true, desc: 'Title of the task' })
        .option('description', { type: 'string', desc: 'Detailed description' })
        .option('priority', { choices: Object.values(TaskPriority), desc: 'Priority level' })
        .option('status', { choices: Object.values(TaskStatus), desc: 'Initial status' })
        .option('assignee', { type: 'string', desc: 'Assignee username or email' })
        .option('tags', { type: 'array', string: true, desc: 'List of tags' })
        .option('dueDate', { type: 'string', desc: 'Due date (e.g., YYYY-MM-DD)' })
        .option('complexity', { type: 'number', desc: 'Complexity score (1-10)' })
        .option('dependencies', { type: 'array', string: true, desc: 'List of task IDs this task depends on' }), (argv) => runCliCommand(createTaskHandler, argv, createTaskSchemaObject))
        .command('update <id>', 'Update an existing task', (y) => y
        .positional('id', { type: 'string', demandOption: true, desc: 'ID of the task to update' })
        .option('title', { type: 'string', desc: 'New title' })
        .option('description', { type: 'string', desc: 'New description' })
        .option('priority', { choices: Object.values(TaskPriority), desc: 'New priority' })
        .option('status', { choices: Object.values(TaskStatus), desc: 'New status' })
        .option('assignee', { type: 'string', desc: 'New assignee' })
        .option('tags', { type: 'array', string: true, desc: 'Replace tags' })
        .option('dueDate', { type: 'string', desc: 'New due date' })
        .option('complexity', { type: 'number', desc: 'New complexity score' })
        .option('dependencies', { type: 'array', string: true, desc: 'Replace dependencies' }), (argv) => runCliCommand(updateTaskHandler, argv, updateTaskSchemaObject))
        .command('list', 'List tasks', (y) => y
        .option('status', { choices: Object.values(TaskStatus), desc: 'Filter by status' })
        .option('priority', { choices: Object.values(TaskPriority), desc: 'Filter by priority' })
        .option('tags', { type: 'array', string: true, desc: 'Filter by tags (any match)' })
        .option('sortBy', { choices: ['priority', 'dueDate', 'createdAt', 'updatedAt', 'complexity'], desc: 'Field to sort by' })
        .option('sortDirection', { choices: ['asc', 'desc'], default: 'asc', desc: 'Sort direction' }), (argv) => runCliCommand(listTasksHandler, argv, listTasksSchemaObject))
        .command('get <id>', 'Get details of a specific task', (y) => y.positional('id', { type: 'string', demandOption: true, desc: 'ID of the task' }), (argv) => runCliCommand(getTaskHandler, argv, getTaskSchemaObject))
        .command('add-note <taskId>', 'Add a note to a task', (y) => y
        .positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' })
        .option('content', { type: 'string', demandOption: true, desc: 'Content of the note' })
        .option('author', { type: 'string', demandOption: true, desc: 'Author of the note' })
        .option('type', { choices: ['progress', 'comment', 'blocker', 'solution'], default: 'comment', desc: 'Type of note' }), (argv) => runCliCommand(addTaskNoteHandler, argv, addTaskNoteSchemaObject))
        .command('next', 'Get the next task to work on (simple logic)', (y) => y.option('random_string', { type: 'string', default: 'dummy', hidden: true }), (argv) => runCliCommand(getNextTaskHandler, argv, getNextTaskSchemaObject))
        .command('parse-prd', 'Parse PRD content from stdin or string argument to create tasks', (y) => y
        .option('prdContent', { type: 'string', demandOption: true, desc: 'The PRD content as a string' })
        .option('createTasksFile', { type: 'boolean', default: true, desc: 'Create/update the TASKS.md file' }), (argv) => runCliCommand(parsePrdHandler, argv, parsePrdSchemaObject))
        .command('parse-prd-file <filePath>', 'Parse a PRD file from disk', (y) => y
        .positional('filePath', { type: 'string', demandOption: true, desc: 'Path to the PRD file' })
        .option('createTasksFile', { type: 'boolean', default: true, desc: 'Create/update the TASKS.md file' })
        .option('verbose', { type: 'boolean', default: false, desc: 'Show detailed output' }), (argv) => runCliCommand(parsePrdFileHandler, argv, parsePrdFileSchemaObject))
        .command('delete <id>', 'Delete a task', (y) => y.positional('id', { type: 'string', demandOption: true, desc: 'ID of the task to delete' }), (argv) => runCliCommand(deleteTaskHandler, argv, deleteTaskSchemaObject))
        .command('generate-steps <taskId>', 'Generate implementation steps for a task', (y) => y.positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' }), (argv) => runCliCommand(generateImplementationStepsHandler, argv, generateImplementationStepsSchemaObject))
        .command('expand <taskId>', 'Expand a task with more details/subtasks', (y) => y
        .positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' })
        .option('expansionPrompt', { type: 'string', desc: 'Additional context for expansion' }), (argv) => runCliCommand(expandTaskHandler, argv, expandTaskSchemaObject))
        .command('suggest-improvements <taskId>', 'Suggest improvements for a task', (y) => y.positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' }), (argv) => runCliCommand(suggestTaskImprovementsHandler, argv, suggestTaskImprovementsSchemaObject))
        .command('help-implement <taskId>', 'Get AI assistance to implement a task', (y) => y
        .positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' })
        .option('additionalContext', { type: 'string', desc: 'Additional context for implementation' }), async (argv) => {
        const tm = setupTaskManager(argv.file);
        const handlerArgs = { ...argv };
        delete handlerArgs.$0;
        delete handlerArgs._;
        delete handlerArgs.file;
        delete handlerArgs.serveMcp;
        try {
            const validatedParams = helpImplementTaskSchemaObject.parse(handlerArgs);
            const result = await helpImplementTaskHandler(tm, llmManager, contextManager, validatedParams);
            console.log(formatOutput(result));
        }
        catch (error) {
            logger.error(`CLI command 'help-implement' failed: ${error.message}`, error);
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    })
        .command('kanban', 'Display tasks in a Kanban board view', (y) => y
        .option('priority', { choices: ['critical', 'high', 'medium', 'low', 'backlog'], desc: 'Filter by priority' })
        .option('tag', { type: 'string', desc: 'Filter by tag' })
        .option('compact', { type: 'boolean', default: false, desc: 'Use compact display' })
        .option('showPriority', { type: 'boolean', default: true, desc: 'Show priority indicators' })
        .option('showComplexity', { type: 'boolean', default: true, desc: 'Show complexity indicators' }), (argv) => runCliCommand(visualizeTasksKanbanHandler, argv, visualizeTasksKanbanSchemaObject))
        .command('tree [taskId]', 'Display task dependency tree', (y) => y.positional('taskId', { type: 'string', desc: 'ID of the task to focus on (optional)' }), (argv) => runCliCommand(visualizeTasksDependencyTreeHandler, argv, visualizeTasksDependencyTreeSchemaObject))
        .command('dashboard', 'Display task dashboard', (y) => y.option('random_string', { type: 'string', default: 'dummy', hidden: true }), (argv) => runCliCommand(visualizeTasksDashboardHandler, argv, visualizeTasksDashboardSchemaObject))
        .demandCommand(0, 'Please specify a command or use --serve-mcp to start the server.')
        .strict()
        .help()
        .alias('help', 'h')
        .alias('version', 'v');
    const argv = await cliArgs.argv;
    if (argv.serveMcp || argv._.length === 0) {
        if (argv._.length > 0 && !argv.serveMcp) {
            console.error("Error: Unknown command provided. Use --help to see available commands.");
            cliArgs.showHelp();
            process.exit(1);
        }
        if (argv.serveMcp && argv._.length > 0) {
            logger.warn(`Ignoring commands (${argv._.join(', ')}) because --serve-mcp flag is set.`);
        }
        await startMcpServer();
    }
    else {
        logger.debug('CLI command executed.');
    }
}
main().catch(err => {
    logger.error('Unhandled error in main execution:', err);
    console.error('An unexpected error occurred:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map