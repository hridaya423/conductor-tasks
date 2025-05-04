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
import { CreateTaskSchema, createTaskHandler } from "./commands/createTaskHandler.js";
import { UpdateTaskSchema, updateTaskHandler } from "./commands/updateTaskHandler.js";
import { ListTasksSchema, listTasksHandler } from "./commands/listTasksHandler.js";
import { GetTaskSchema, getTaskHandler } from "./commands/getTaskHandler.js";
import { AddTaskNoteSchema, addTaskNoteHandler } from "./commands/addTaskNoteHandler.js";
import { GetNextTaskSchema, getNextTaskHandler } from "./commands/getNextTaskHandler.js";
import { ParsePrdSchema, parsePrdHandler } from "./commands/parsePrdHandler.js";
import { DeleteTaskSchema, deleteTaskHandler } from "./commands/deleteTaskHandler.js";
import { InitializeTasksSchema, initializeTasksHandler } from "./commands/initializeTasksHandler.js";
import { GenerateImplementationStepsSchema, generateImplementationStepsHandler } from "./commands/generateImplementationStepsHandler.js";
import { ExpandTaskSchema, expandTaskHandler } from "./commands/expandTaskHandler.js";
import { SuggestTaskImprovementsSchema, suggestTaskImprovementsHandler } from "./commands/suggestTaskImprovementsHandler.js";
import { HelpImplementTaskSchema, helpImplementTaskHandler } from "./commands/helpImplementTaskHandler.js";
import { VisualizeTasksKanbanSchema, visualizeTasksKanbanHandler } from "./commands/visualizeTasksKanbanHandler.js";
import { VisualizeTasksDependencyTreeSchema, visualizeTasksDependencyTreeHandler } from "./commands/visualizeTasksDependencyTreeHandler.js";
import { VisualizeTasksDashboardSchema, visualizeTasksDashboardHandler } from "./commands/visualizeTasksDashboardHandler.js";
import { ParsePrdFileSchema, parsePrdFileHandler } from "./commands/parsePrdFileHandler.js";
// Load environment variables from .env file
dotenv.config();
// --- Core Setup ---
const llmManager = new LLMManager();
const contextManager = new ContextManager();
const taskManager = new TaskManager(llmManager, contextManager);
// Create Zod schema objects from the imported plain objects
const InitializeTasksSchemaObject = z.object(InitializeTasksSchema);
const HelpImplementTaskSchemaObject = z.object(HelpImplementTaskSchema);
// --- Helper Functions ---
function setupTaskManager(filePath) {
    const effectivePath = filePath || path.join(process.cwd(), 'TASKS.md');
    const projectName = path.basename(path.dirname(effectivePath));
    // Ensure the directory exists
    const dir = path.dirname(effectivePath);
    if (!fs.existsSync(dir)) {
        logger.info(`Creating directory for tasks file: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    }
    taskManager.setTasksFilePath(effectivePath, projectName);
    logger.info(`TaskManager initialized with tasks file: ${taskManager.getTasksFilePath()}`);
    return taskManager;
}
function formatOutput(data) {
    if (typeof data === 'string') {
        return data;
    }
    // Simple JSON stringification for now, can be enhanced later (e.g., tables)
    return JSON.stringify(data, null, 2);
}
async function runCliCommand(handler, args // Add index signature for yargs internal props
) {
    const tm = setupTaskManager(args.file);
    // Remove yargs-specific fields ($0, _) and the file path before passing to handler
    const handlerArgs = { ...args };
    delete handlerArgs.$0;
    delete handlerArgs._;
    delete handlerArgs.file;
    delete handlerArgs.serveMcp; // Also remove serveMcp if present
    try {
        const result = await handler(tm, handlerArgs);
        console.log(formatOutput(result));
    }
    catch (error) {
        logger.error(`CLI command failed: ${error.message}`, error);
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}
// Special handler for initialize which might not need a pre-setup TaskManager
async function runInitializeCliCommand(args) {
    const tm = taskManager; // Use the global one, setup happens *inside* the handler
    // Prepare args for the handler
    const handlerArgs = { ...args }; // Use type assertion
    delete handlerArgs.$0;
    delete handlerArgs._;
    delete handlerArgs.file; // Keep 'file' for initialize, it's the target path
    delete handlerArgs.serveMcp;
    try {
        // initializeTasksHandler expects filePath, projectName, projectDescription
        const filePath = args.file || path.join(process.cwd(), 'TASKS.md');
        const dir = path.dirname(filePath);
        const projectName = args.projectName || path.basename(dir); // Infer project name from directory
        const projectDescription = args.projectDescription || `Project located at ${dir}`;
        const params = {
            filePath: filePath,
            projectName: projectName,
            projectDescription: projectDescription
        };
        // Use the created schema object to parse
        const validatedParams = InitializeTasksSchemaObject.parse(params);
        const result = await initializeTasksHandler(tm, validatedParams);
        console.log(formatOutput(result));
    }
    catch (error) {
        logger.error(`CLI command 'initialize-tasks' failed: ${error.message}`, error);
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}
async function startMcpServer() {
    logger.info(`
========================================================
Conductor Task Management System Starting (MCP Mode)
========================================================
Current directory: ${process.cwd()}
Default Tasks file path: ${path.join(process.cwd(), 'TASKS.md')}
========================================================
`);
    // Setup TM with default path for MCP server mode initially
    // Handlers might re-initialize if a specific path is given in their params
    const tm = setupTaskManager(undefined); // Use default path for server setup
    if (fs.existsSync(tm.getTasksFilePath())) {
        logger.info(`TASKS.md exists at ${tm.getTasksFilePath()}`);
        logger.info(`Task count: ${tm.getTaskCount()}`);
        logger.info(`TaskManager initialized: ${tm.isInitialized()}`);
    }
    else {
        logger.warn(`TASKS.md not found at ${tm.getTasksFilePath()}. Use 'initialize-tasks' tool.`);
    }
    logger.info('=== Conductor Task Management System Started (MCP Mode) ===');
    logger.info(`Default LLM Provider: ${llmManager.getDefaultProvider()}`);
    logger.info(`Available Providers: ${llmManager.getAvailableProviders().join(', ')}`);
    logger.info(`Tasks File Path Used by Server: ${tm.getTasksFilePath()}`);
    logger.info('==================================');
    const server = new McpServer({
        name: "conductor",
        version: "1.0.0", // Consider reading from package.json
    });
    // Register all tools for MCP
    server.tool("create-task", "Create a new task with details", CreateTaskSchema, (params) => createTaskHandler(tm, params));
    server.tool("update-task", "Update an existing task's details", UpdateTaskSchema, (params) => updateTaskHandler(tm, params));
    server.tool("list-tasks", "Get a list of tasks with filtering and sorting options", ListTasksSchema, (params) => listTasksHandler(tm, params));
    server.tool("get-task", "Get details of a specific task", GetTaskSchema, (params) => getTaskHandler(tm, params));
    server.tool("add-task-note", "Add a note, progress update, or comment to a task", AddTaskNoteSchema, (params) => addTaskNoteHandler(tm, params));
    server.tool("get-next-task", "Get the next task to work on", GetNextTaskSchema, (params) => getNextTaskHandler(tm, params));
    server.tool("parse-prd", "Parse a PRD (Product Requirements Document) and create tasks from it", ParsePrdSchema, (params) => parsePrdHandler(tm, params));
    server.tool("delete-task", "Delete a task", DeleteTaskSchema, (params) => deleteTaskHandler(tm, params));
    server.tool("initialize-tasks", "Initialize the task management system and create TASKS.md", InitializeTasksSchema, (params) => initializeTasksHandler(tm, params));
    server.tool("generate-implementation-steps", "Generate detailed implementation steps for a task", GenerateImplementationStepsSchema, (params) => generateImplementationStepsHandler(tm, params));
    server.tool("expand-task", "Expand a task with more detailed information and subtasks", ExpandTaskSchema, (params) => expandTaskHandler(tm, params));
    server.tool("suggest-task-improvements", "Get AI suggestions for improving a task", SuggestTaskImprovementsSchema, (params) => suggestTaskImprovementsHandler(tm, params));
    server.tool("help-implement-task", "Get AI assistance to implement a specific task", HelpImplementTaskSchema, (params) => helpImplementTaskHandler(tm, llmManager, contextManager, params));
    server.tool("visualize-tasks-kanban", "Display tasks in a Kanban board view", VisualizeTasksKanbanSchema, (params) => visualizeTasksKanbanHandler(tm, params));
    server.tool("visualize-tasks-dependency-tree", "Display task dependency tree", VisualizeTasksDependencyTreeSchema, (params) => visualizeTasksDependencyTreeHandler(tm, params));
    server.tool("visualize-tasks-dashboard", "Display task dashboard with summary statistics", VisualizeTasksDashboardSchema, (params) => visualizeTasksDashboardHandler(tm, params));
    server.tool("parse-prd-file", "Parse a PRD file from disk and extract tasks", ParsePrdFileSchema, (params) => parsePrdFileHandler(tm, params));
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
// --- Main Execution Logic ---
async function main() {
    const cliArgs = yargs(hideBin(process.argv))
        .scriptName("conductor-tasks")
        .option('file', {
        alias: 'f',
        type: 'string',
        description: 'Path to the TASKS.md file',
        global: true // Make it available to all commands
    })
        .option('serve-mcp', {
        type: 'boolean',
        description: 'Run in MCP server mode (for IDE integration)',
        default: false
    })
        .command('init', 'Initialize the task management system and create TASKS.md', (y) => y
        .option('projectName', { type: 'string', desc: 'Name of the project (inferred from directory if not provided)' })
        .option('projectDescription', { type: 'string', desc: 'Description of the project' })
    // Note: 'file' option is handled globally, specifies the target path
    , (argv) => runInitializeCliCommand(argv))
        .command('create', 'Create a new task', (y) => y
        .option('title', { type: 'string', demandOption: true, desc: 'Title of the task' })
        .option('description', { type: 'string', desc: 'Detailed description' })
        .option('priority', { choices: Object.values(TaskPriority), desc: 'Priority level' })
        .option('status', { choices: Object.values(TaskStatus), desc: 'Initial status' })
        .option('assignee', { type: 'string', desc: 'Assignee username or email' })
        .option('tags', { type: 'array', string: true, desc: 'List of tags' })
        .option('dueDate', { type: 'string', desc: 'Due date (e.g., YYYY-MM-DD)' })
        .option('complexity', { type: 'number', desc: 'Complexity score (1-10)' })
        .option('dependencies', { type: 'array', string: true, desc: 'List of task IDs this task depends on' }), (argv) => runCliCommand(createTaskHandler, argv))
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
        .option('dependencies', { type: 'array', string: true, desc: 'Replace dependencies' }), (argv) => runCliCommand(updateTaskHandler, argv))
        .command('list', 'List tasks', (y) => y
        .option('status', { choices: Object.values(TaskStatus), desc: 'Filter by status' })
        .option('priority', { choices: Object.values(TaskPriority), desc: 'Filter by priority' })
        .option('tags', { type: 'array', string: true, desc: 'Filter by tags (any match)' })
        .option('sortBy', { choices: ['priority', 'dueDate', 'createdAt', 'updatedAt', 'complexity'], desc: 'Field to sort by' })
        .option('sortDirection', { choices: ['asc', 'desc'], default: 'asc', desc: 'Sort direction' }), (argv) => runCliCommand(listTasksHandler, argv))
        .command('get <id>', 'Get details of a specific task', (y) => y.positional('id', { type: 'string', demandOption: true, desc: 'ID of the task' }), (argv) => runCliCommand(getTaskHandler, argv))
        .command('add-note <taskId>', 'Add a note to a task', (y) => y
        .positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' })
        .option('content', { type: 'string', demandOption: true, desc: 'Content of the note' })
        .option('author', { type: 'string', demandOption: true, desc: 'Author of the note' })
        .option('type', { choices: ['progress', 'comment', 'blocker', 'solution'], default: 'comment', desc: 'Type of note' }), (argv) => runCliCommand(addTaskNoteHandler, argv))
        .command('next', 'Get the next task to work on (simple logic)', (y) => y.option('random_string', { type: 'string', default: 'dummy', hidden: true }), // Add type annotation
    (argv) => runCliCommand(getNextTaskHandler, argv))
        .command('parse-prd', 'Parse PRD content from stdin or string argument to create tasks', (y) => y
        .option('prdContent', { type: 'string', demandOption: true, desc: 'The PRD content as a string' })
        .option('createTasksFile', { type: 'boolean', default: true, desc: 'Create/update the TASKS.md file' }), (argv) => runCliCommand(parsePrdHandler, argv))
        .command('parse-prd-file <filePath>', 'Parse a PRD file from disk', (y) => y
        .positional('filePath', { type: 'string', demandOption: true, desc: 'Path to the PRD file' })
        .option('createTasksFile', { type: 'boolean', default: true, desc: 'Create/update the TASKS.md file' })
        .option('verbose', { type: 'boolean', default: false, desc: 'Show detailed output' }), (argv) => runCliCommand(parsePrdFileHandler, argv))
        .command('delete <id>', 'Delete a task', (y) => y.positional('id', { type: 'string', demandOption: true, desc: 'ID of the task to delete' }), (argv) => runCliCommand(deleteTaskHandler, argv))
        .command('generate-steps <taskId>', 'Generate implementation steps for a task', (y) => y.positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' }), (argv) => runCliCommand(generateImplementationStepsHandler, argv))
        .command('expand <taskId>', 'Expand a task with more details/subtasks', (y) => y
        .positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' })
        .option('expansionPrompt', { type: 'string', desc: 'Additional context for expansion' }), (argv) => runCliCommand(expandTaskHandler, argv))
        .command('suggest-improvements <taskId>', 'Suggest improvements for a task', (y) => y.positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' }), (argv) => runCliCommand(suggestTaskImprovementsHandler, argv))
        .command('help-implement <taskId>', 'Get AI assistance to implement a task', (y) => y
        .positional('taskId', { type: 'string', demandOption: true, desc: 'ID of the task' })
        .option('additionalContext', { type: 'string', desc: 'Additional context for implementation' }), 
    // This handler needs more managers, create a specific wrapper
    async (argv) => {
        const tm = setupTaskManager(argv.file);
        const handlerArgs = { ...argv }; // Use type assertion
        delete handlerArgs.$0;
        delete handlerArgs._;
        delete handlerArgs.file;
        delete handlerArgs.serveMcp;
        try {
            // Use the created schema object to parse
            const validatedParams = HelpImplementTaskSchemaObject.parse(handlerArgs);
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
        .option('showComplexity', { type: 'boolean', default: true, desc: 'Show complexity indicators' }), (argv) => runCliCommand(visualizeTasksKanbanHandler, argv))
        .command('tree [taskId]', 'Display task dependency tree', (y) => y.positional('taskId', { type: 'string', desc: 'ID of the task to focus on (optional)' }), (argv) => runCliCommand(visualizeTasksDependencyTreeHandler, argv))
        .command('dashboard', 'Display task dashboard', (y) => y.option('random_string', { type: 'string', default: 'dummy', hidden: true }), // Add type annotation
    (argv) => runCliCommand(visualizeTasksDashboardHandler, argv))
        .demandCommand(0, 'Please specify a command or use --serve-mcp to start the server.') // Require a command unless --serve-mcp is used
        .strict() // Fail on unknown commands/options
        .help() // Enable --help
        .alias('help', 'h')
        .alias('version', 'v'); // Enable --version
    const argv = await cliArgs.argv;
    // Decide mode based on parsed arguments
    if (argv.serveMcp || argv._.length === 0) { // Start server if --serve-mcp flag is set or no command was given
        if (argv._.length > 0 && !argv.serveMcp) {
            // This case should ideally be caught by demandCommand, but as a safeguard:
            console.error("Error: Unknown command provided. Use --help to see available commands.");
            cliArgs.showHelp(); // Show help if an unknown command was attempted without --serve-mcp
            process.exit(1);
        }
        if (argv.serveMcp && argv._.length > 0) {
            logger.warn(`Ignoring commands (${argv._.join(', ')}) because --serve-mcp flag is set.`);
        }
        await startMcpServer();
    }
    else {
        // CLI command was parsed and its handler should have been executed by yargs.
        // No further action needed here as handlers exit or complete.
        logger.debug('CLI command executed.');
    }
}
main().catch(err => {
    logger.error('Unhandled error in main execution:', err);
    console.error('An unexpected error occurred:', err);
    process.exit(1);
});
// Ensure build directory exists if it doesn't
const buildDir = path.join(process.cwd(), 'build');
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}
//# sourceMappingURL=index.js.map