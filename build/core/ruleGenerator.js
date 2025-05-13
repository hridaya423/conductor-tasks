import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { IDEType } from './types.js';
/**
 * Generator for project rules documentation
 */
export class RuleGenerator {
    constructor(projectRoot, ideType = IDEType.AUTO) {
        this.projectRoot = projectRoot;
        this.ideType = ideType;
    }
    /**
     * Generates all rule files for the project
     */
    async generateAllRules() {
        try {
            // Create rules directories if they don't exist
            this.createRulesDirectories();
            // Generate IDE-specific rule files
            await this.generateIDERules();
            // Generate workflow and development rules
            await this.generateWorkflowRules();
            // Generate standard rule files
            await this.generateCursorRules();
            await this.generateWindsurfRules();
            await this.generateRooRules();
            // Generate MCP tools documentation
            await this.generateMCPToolsRules();
            // Generate task lifecycle documentation
            await this.generateTaskLifecycleRules();
            // Generate AI implementation assistance documentation
            await this.generateAIAssistanceRules();
            // Generate task visualization documentation
            await this.generateVisualizationRules();
            // Generate rules index
            await this.generateRulesIndex();
            logger.info('Successfully generated all rule files for the project');
        }
        catch (error) {
            logger.error('Failed to generate rule files', { error });
            throw error;
        }
    }
    /**
     * Creates necessary directories for rules
     */
    createRulesDirectories() {
        const directories = [
            path.join(this.projectRoot, '.cursor', 'rules'),
            path.join(this.projectRoot, '.roo', 'rules'),
            path.join(this.projectRoot, '.roo', 'rules-architect'),
            path.join(this.projectRoot, '.roo', 'rules-ask'),
            path.join(this.projectRoot, '.roo', 'rules-code'),
            path.join(this.projectRoot, '.roo', 'rules-debug'),
            path.join(this.projectRoot, '.roo', 'rules-test')
        ];
        for (const dir of directories) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.debug(`Created directory: ${dir}`);
            }
        }
    }
    /**
     * Generates IDE-specific rule files based on the current IDE type
     */
    async generateIDERules() {
        // Implementation will generate IDE-specific rule files
        logger.debug('Generating IDE-specific rules');
    }
    /**
     * Generates workflow and development rules
     */
    async generateWorkflowRules() {
        // Implementation will generate workflow rules
        logger.debug('Generating workflow rules');
    }
    /**
     * Generates Cursor rules
     */
    async generateCursorRules() {
        const cursorRulesDir = path.join(this.projectRoot, '.cursor', 'rules');
        // Create cursor_rules.mdc
        const cursorRulesPath = path.join(cursorRulesDir, 'cursor_rules.mdc');
        const cursorRulesContent = this.getCursorRulesTemplate();
        fs.writeFileSync(cursorRulesPath, cursorRulesContent);
        logger.debug(`Generated cursor rules at: ${cursorRulesPath}`);
        const devWorkflowPath = path.join(cursorRulesDir, 'dev_workflow.mdc');
        const devWorkflowContent = this.getDevWorkflowTemplate();
        fs.writeFileSync(devWorkflowPath, devWorkflowContent);
        logger.debug(`Generated dev workflow rules at: ${devWorkflowPath}`);
        const conductorTasksPath = path.join(cursorRulesDir, 'conductor_tasks.mdc');
        const conductorTasksContent = this.getConductorTasksTemplate();
        fs.writeFileSync(conductorTasksPath, conductorTasksContent);
        logger.debug(`Generated conductor tasks rules at: ${conductorTasksPath}`);
    }
    /**
     * Generates Windsurf rules
     */
    async generateWindsurfRules() {
        const windsurfRulesPath = path.join(this.projectRoot, '.windsurfrules');
        const windsurfRulesContent = this.getWindsurfRulesTemplate();
        fs.writeFileSync(windsurfRulesPath, windsurfRulesContent);
        logger.debug(`Generated windsurf rules at: ${windsurfRulesPath}`);
    }
    /**
     * Generates Roo rules
     */
    async generateRooRules() {
        const rooRulesDir = path.join(this.projectRoot, '.roo', 'rules');
        // Create roo_rules.md
        const rooRulesPath = path.join(rooRulesDir, 'roo_rules.md');
        const rooRulesContent = this.getRooRulesTemplate();
        fs.writeFileSync(rooRulesPath, rooRulesContent);
        logger.debug(`Generated roo rules at: ${rooRulesPath}`);
    }
    /**
     * Generates MCP tools rule documentation
     */
    async generateMCPToolsRules() {
        const cursorRulesDir = path.join(this.projectRoot, '.cursor', 'rules');
        // Create mcp_tools.mdc
        const mcpToolsPath = path.join(cursorRulesDir, 'mcp_tools.mdc');
        const mcpToolsContent = this.getMCPToolsTemplate();
        fs.writeFileSync(mcpToolsPath, mcpToolsContent);
        logger.debug(`Generated MCP tools rules at: ${mcpToolsPath}`);
    }
    /**
     * Generates task lifecycle rule documentation
     */
    async generateTaskLifecycleRules() {
        const cursorRulesDir = path.join(this.projectRoot, '.cursor', 'rules');
        // Create task_lifecycle.mdc
        const taskLifecyclePath = path.join(cursorRulesDir, 'task_lifecycle.mdc');
        const taskLifecycleContent = this.getTaskLifecycleTemplate();
        fs.writeFileSync(taskLifecyclePath, taskLifecycleContent);
        logger.debug(`Generated task lifecycle rules at: ${taskLifecyclePath}`);
    }
    /**
     * Generates AI implementation assistance rule documentation
     */
    async generateAIAssistanceRules() {
        const cursorRulesDir = path.join(this.projectRoot, '.cursor', 'rules');
        // Create ai_assistance.mdc
        const aiAssistancePath = path.join(cursorRulesDir, 'ai_assistance.mdc');
        const aiAssistanceContent = this.getAIAssistanceTemplate();
        fs.writeFileSync(aiAssistancePath, aiAssistanceContent);
        logger.debug(`Generated AI assistance rules at: ${aiAssistancePath}`);
    }
    /**
     * Generates task visualization rule documentation
     */
    async generateVisualizationRules() {
        const cursorRulesDir = path.join(this.projectRoot, '.cursor', 'rules');
        // Create visualization.mdc
        const visualizationPath = path.join(cursorRulesDir, 'visualization.mdc');
        const visualizationContent = this.getVisualizationTemplate();
        fs.writeFileSync(visualizationPath, visualizationContent);
        logger.debug(`Generated visualization rules at: ${visualizationPath}`);
    }
    /**
     * Generates rules index documentation
     */
    async generateRulesIndex() {
        const cursorRulesDir = path.join(this.projectRoot, '.cursor', 'rules');
        // Create rules_index.mdc
        const rulesIndexPath = path.join(cursorRulesDir, 'rules_index.mdc');
        const rulesIndexContent = this.getRulesIndexTemplate();
        fs.writeFileSync(rulesIndexPath, rulesIndexContent);
        logger.debug(`Generated rules index at: ${rulesIndexPath}`);
    }
    /**
     * Template for cursor_rules.mdc
     */
    getCursorRulesTemplate() {
        return `---
description: Guidelines for creating and maintaining Cursor rules for Conductor Tasks
globs: **/*
alwaysApply: true
---

- **Required Rule Structure:**
  \`\`\`markdown
  ---
  description: Clear, one-line description of what the rule enforces
  globs: path/to/files/*.ext, other/path/**/*
  alwaysApply: boolean
  ---

  - **Main Points in Bold**
    - Sub-points with details
    - Examples and explanations
  \`\`\`

- **File References:**
  - Use \`[filename](mdc:path/to/file)\` ([filename](mdc:filename)) to reference files
  - Example: [conductor_tasks.mdc](mdc:.cursor/rules/conductor_tasks.mdc) for rule references
  - Example: [package.json](mdc:package.json) for code references

- **Code Examples:**
  - Use language-specific code blocks
  \`\`\`typescript
  // ✅ DO: Show good examples
  const goodExample = true;
  
  // ❌ DON'T: Show anti-patterns
  const badExample = false;
  \`\`\`

- **Rule Content Guidelines:**
  - Start with high-level overview
  - Include specific, actionable requirements
  - Show examples of correct implementation
  - Reference existing code when possible
  - Keep rules DRY by referencing other rules

- **Rule Maintenance:**
  - Update rules when new patterns emerge
  - Add examples from actual codebase
  - Remove outdated patterns
  - Cross-reference related rules

- **Best Practices:**
  - Use bullet points for clarity
  - Keep descriptions concise
  - Include both DO and DON'T examples
  - Reference actual code over theoretical examples
  - Use consistent formatting across rules
`;
    }
    /**
     * Template for dev_workflow.mdc
     */
    getDevWorkflowTemplate() {
        return `# Conductor Tasks Development Workflow

This guide outlines the typical process for using Conductor Tasks to manage software development projects.

## Primary Interaction: MCP Server vs. CLI

Conductor Tasks offers two primary ways to interact:

1.  **MCP Server (Recommended for Integrated Tools)**:
    - For AI agents and integrated development environments (like Cursor), interacting via the **MCP server is the preferred method**.
    - The MCP server exposes Conductor Tasks functionality through a set of tools (e.g., \`get-task\`, \`create-task\`).
    - This method offers better performance, structured data exchange, and richer error handling compared to CLI parsing.
    - Refer to [conductor_tasks.mdc](mdc:.cursor/rules/conductor_tasks.mdc) for details on the MCP architecture and available tools.
    - **Restart the MCP server** if core logic changes.

2.  **\`conductor-tasks\` CLI (For Users & Fallback)**:
    - The CLI command provides a user-friendly interface for direct terminal interaction.
    - It can also serve as a fallback if the MCP server is inaccessible or a specific function isn't exposed via MCP.
    - Install globally with \`npm install -g conductor-tasks\` or use locally via \`npx conductor-tasks\`.
    - The CLI commands often mirror the MCP tools (e.g., \`conductor-tasks list\` corresponds to \`list-tasks\`).
    - Refer to [conductor_tasks.mdc](mdc:.cursor/rules/conductor_tasks.mdc) for a detailed command reference.

## Standard Development Workflow Process

- Start new projects by running \`initialize-tasks\` tool or \`conductor-tasks init\` or parse a PRD with \`parse-prd\` / \`conductor-tasks parse-prd-file <file>\`
- Begin coding sessions with \`list-tasks\` / \`conductor-tasks list\` to see current tasks, status, and IDs
- Determine the next task to work on using \`get-next-task\` / \`conductor-tasks next\`
- View specific task details using \`get-task\` / \`conductor-tasks get <id>\` to understand implementation requirements
- Break down complex tasks using \`expand-task\` / \`conductor-tasks expand <taskId>\`
- Implement code following task details, dependencies, and project standards
- Add progress notes with \`add-task-note\` / \`conductor-tasks add-note <taskId>\`
- Mark completed tasks with \`update-task\` / \`conductor-tasks update <id> --status done\`
- Visualize your progress with \`visualize-tasks-kanban\` / \`conductor-tasks kanban\`

## Task Breakdown Process

- For complex tasks, use \`expand-task\` / \`conductor-tasks expand <taskId>\`
- Add context with \`--expansionPrompt\` to guide the breakdown process
- Review and refine the generated subtasks
- Implement each subtask systematically

## Task Status Management

- Use statuses to track progress: \`backlog\`, \`todo\`, \`in_progress\`, \`review\`, \`done\`, \`blocked\`
- Update task status as it moves through the development lifecycle
- Filter tasks by status when listing to focus on current work

## Task Structure Fields

- **id**: Unique identifier for the task
- **title**: Brief, descriptive title
- **description**: Concise summary of what the task involves
- **status**: Current state of the task
- **priority**: Importance level (\`critical\`, \`high\`, \`medium\`, \`low\`, \`backlog\`)
- **complexity**: Difficulty rating (1-10)
- **dependencies**: IDs of prerequisite tasks
- **tags**: Categories or labels for the task
- **assignee**: Person responsible for the task
- **notes**: Additional context, progress updates, or implementation details

## AI-Assisted Implementation

- Use \`help-implement-task\` / \`conductor-tasks help-implement <taskId>\` for AI guidance
- Provide additional context with \`--additionalContext\` for more tailored assistance
- Use \`generate-implementation-steps\` / \`conductor-tasks generate-steps <taskId>\` for detailed steps
- Get improvement suggestions with \`suggest-task-improvements\` / \`conductor-tasks suggest-improvements <taskId>\`

## Visualization Options

- Kanban board: \`visualize-tasks-kanban\` / \`conductor-tasks kanban\`
- Dependency tree: \`visualize-tasks-dependency-tree\` / \`conductor-tasks tree\`
- Dashboard: \`visualize-tasks-dashboard\` / \`conductor-tasks dashboard\`
- Filter visualizations by priority, tag, or other criteria for focused views

---
*This workflow provides a general guideline. Adapt it based on your specific project needs and team practices.*
`;
    }
    /**
     * Template for conductor_tasks.mdc
     */
    getConductorTasksTemplate() {
        return `# Conductor Tasks Tool & Command Reference

This document provides a detailed reference for interacting with Conductor Tasks, covering both the recommended MCP tools (for integrated environments like Cursor) and the corresponding CLI commands (for direct terminal usage).

**Note:** For integrated environments, using the **MCP tools is strongly recommended** due to better performance, structured data, and error handling.

## Task Management

### 1. Create Task (\`create-task\`)
- **MCP Tool:** \`create-task\`
- **CLI:** \`conductor-tasks create --title="..." --description="..."\`
- **Description:** Creates a new task with specified details
- **Key Parameters:**
  - \`title\`: Task title (required)
  - \`description\`: Detailed task description
  - \`priority\`: Task priority (\`critical\`, \`high\`, \`medium\`, \`low\`, \`backlog\`)
  - \`tags\`: Array of tags for categorization
  - \`dependencies\`: Array of task IDs this task depends on

### 2. Update Task (\`update-task\`)
- **MCP Tool:** \`update-task\`
- **CLI:** \`conductor-tasks update <id> --status="..." --priority="..."\`
- **Description:** Updates an existing task's details
- **Key Parameters:**
  - \`id\`: Task ID to update (required)
  - \`title\`, \`description\`, \`status\`, \`priority\`, etc.: Fields to update

### 3. List Tasks (\`list-tasks\`)
- **MCP Tool:** \`list-tasks\`
- **CLI:** \`conductor-tasks list [--status="..."] [--priority="..."]\`
- **Description:** Lists tasks with optional filtering
- **Key Parameters:**
  - \`status\`: Filter by status
  - \`priority\`: Filter by priority
  - \`tags\`: Filter by tags
  - \`sortBy\`: Field to sort by

### 4. Get Task (\`get-task\`)
- **MCP Tool:** \`get-task\`
- **CLI:** \`conductor-tasks get <id>\`
- **Description:** Retrieves detailed information about a specific task
- **Key Parameters:**
  - \`id\`: Task ID to retrieve (required)

### 5. Delete Task (\`delete-task\`)
- **MCP Tool:** \`delete-task\`
- **CLI:** \`conductor-tasks delete <id>\`
- **Description:** Permanently removes a task
- **Key Parameters:**
  - \`id\`: Task ID to delete (required)

### 6. Get Next Task (\`get-next-task\`)
- **MCP Tool:** \`get-next-task\`
- **CLI:** \`conductor-tasks next\`
- **Description:** Identifies the most appropriate next task to work on

### 7. Add Task Note (\`add-task-note\`)
- **MCP Tool:** \`add-task-note\`
- **CLI:** \`conductor-tasks add-note <taskId> --content="..." --author="..." --type="..."\`
- **Description:** Adds a note, comment, or progress update to a task
- **Key Parameters:**
  - \`taskId\`: Task ID to add note to (required)
  - \`content\`: Note content (required)
  - \`author\`: Note author (required)
  - \`type\`: Note type (\`progress\`, \`comment\`, \`blocker\`, \`solution\`)

## Project Setup & PRD Processing

### 8. Initialize Tasks (\`initialize-tasks\`)
- **MCP Tool:** \`initialize-tasks\`
- **CLI:** \`conductor-tasks init [--projectName="..."] [--projectDescription="..."]\`
- **Description:** Sets up the task management system in the current project
- **Key Parameters:**
  - \`projectName\`: Name of the project
  - \`projectDescription\`: Project description
  - \`filePath\`: Custom path for TASKS.md file

### 9. Parse PRD (\`parse-prd\`)
- **MCP Tool:** \`parse-prd\`
- **CLI:** \`conductor-tasks parse-prd --prdContent="..."\`
- **Description:** Processes PRD text to generate initial tasks
- **Key Parameters:**
  - \`prdContent\`: PRD text content (required)
  - \`createTasksFile\`: Whether to create/update TASKS.md

### 10. Parse PRD File (\`parse-prd-file\`)
- **MCP Tool:** \`parse-prd-file\`
- **CLI:** \`conductor-tasks parse-prd-file <filePath>\`
- **Description:** Processes a PRD file to generate initial tasks
- **Key Parameters:**
  - \`filePath\`: Path to PRD file (required)
  - \`createTasksFile\`: Whether to create/update TASKS.md
  - \`verbose\`: Show detailed output

## AI Assistance & Task Enhancement

### 11. Generate Implementation Steps (\`generate-implementation-steps\`)
- **MCP Tool:** \`generate-implementation-steps\`
- **CLI:** \`conductor-tasks generate-steps <taskId>\`
- **Description:** Creates detailed implementation steps for a task
- **Key Parameters:**
  - \`taskId\`: Task ID to generate steps for (required)

### 12. Expand Task (\`expand-task\`)
- **MCP Tool:** \`expand-task\`
- **CLI:** \`conductor-tasks expand <taskId> [--expansionPrompt="..."]\`
- **Description:** Breaks down a task into more detailed information and subtasks
- **Key Parameters:**
  - \`taskId\`: Task ID to expand (required)
  - \`expansionPrompt\`: Additional context for expansion

### 13. Suggest Task Improvements (\`suggest-task-improvements\`)
- **MCP Tool:** \`suggest-task-improvements\`
- **CLI:** \`conductor-tasks suggest-improvements <taskId>\`
- **Description:** Provides AI-generated suggestions to improve a task
- **Key Parameters:**
  - \`taskId\`: Task ID to improve (required)

### 14. Help Implement Task (\`help-implement-task\`)
- **MCP Tool:** \`help-implement-task\`
- **CLI:** \`conductor-tasks help-implement <taskId> [--additionalContext="..."]\`
- **Description:** Provides AI assistance for implementing a specific task
- **Key Parameters:**
  - \`taskId\`: Task ID to help implement (required)
  - \`additionalContext\`: Additional context for implementation

## Visualization

### 15. Visualize Tasks Kanban (\`visualize-tasks-kanban\`)
- **MCP Tool:** \`visualize-tasks-kanban\`
- **CLI:** \`conductor-tasks kanban [--priority="..."] [--tag="..."]\`
- **Description:** Displays tasks in a Kanban board view
- **Key Parameters:**
  - \`priority\`: Filter by priority
  - \`tag\`: Filter by tag
  - \`compact\`: Use compact display mode
  - \`showPriority\`: Show priority indicators
  - \`showComplexity\`: Show complexity indicators

### 16. Visualize Tasks Dependency Tree (\`visualize-tasks-dependency-tree\`)
- **MCP Tool:** \`visualize-tasks-dependency-tree\`
- **CLI:** \`conductor-tasks tree [taskId]\`
- **Description:** Displays the task dependency tree
- **Key Parameters:**
  - \`taskId\`: Optional task ID to focus on

### 17. Visualize Tasks Dashboard (\`visualize-tasks-dashboard\`)
- **MCP Tool:** \`visualize-tasks-dashboard\`
- **CLI:** \`conductor-tasks dashboard\`
- **Description:** Shows a dashboard with task statistics and summaries

## Environment Variables

- **LLM Provider API Keys:**
  - \`ANTHROPIC_API_KEY\`: For Claude models
  - \`OPENAI_API_KEY\`: For GPT models
  - \`MISTRAL_API_KEY\`: For Mistral models
  - \`GROQ_API_KEY\`: For Groq inference
  - \`GEMINI_API_KEY\`: For Google's Gemini models
  - \`XAI_API_KEY\`: For Grok models
  - \`PERPLEXITY_API_KEY\`: For Perplexity
  - \`OLLAMA_ENABLED\`: For local Ollama models

- **Configuration Options:**
  - \`DEFAULT_LLM_PROVIDER\`: Preferred provider
  - \`MODEL\`: Default model to use
  - \`TEMPERATURE\`: Randomness (0-1)
  - \`MAX_TOKENS\`: Maximum tokens to generate
  - \`DEFAULT_SUBTASKS\`: Default number of subtasks
  - \`DEFAULT_PRIORITY\`: Default priority for new tasks
  - \`CONDUCTOR_TASKS_FILE\`: Custom file path
  - \`CONDUCTOR_IDE_TYPE\`: IDE-specific optimizations

For detailed configuration options, see [the MCP setup documentation](mdc:docs/mcp-setup.md).

## Best Practices

- Start each work session with \`list-tasks\` to see overall progress
- Use \`get-next-task\` to identify what to work on
- Add implementation notes regularly using \`add-task-note\`
- Break down complex tasks with \`expand-task\` before implementation
- Use visualizations to maintain project overview
- Update task status as work progresses
- Request AI assistance when implementation details are unclear
`;
    }
    /**
     * Template for .windsurfrules
     */
    getWindsurfRulesTemplate() {
        return `Below you will find important rules for using Conductor Tasks:

---
DEV_WORKFLOW
---
description: Guide for using Conductor Tasks to manage task-driven development workflows
globs: **/*
filesToApplyRule: **/*
alwaysApply: true
---

- **Primary Interaction Methods**
  - Conductor Tasks provides two ways to interact:
    1. **MCP Server** for AI assistants and integrated environments
    2. **CLI** via the \`conductor-tasks\` command for direct terminal use
  - Use MCP in integrated environments for better performance and structured data
  - Use CLI for quick terminal operations or when MCP is unavailable

- **Development Workflow Process**
  - Start projects by running \`conductor-tasks init\` or \`conductor-tasks parse-prd-file <file>\`
  - Begin sessions with \`conductor-tasks list\` to see tasks, status, and IDs
  - View task details with \`conductor-tasks get <id>\`
  - Break down complex tasks using \`conductor-tasks expand <id>\`
  - Implement code following task details and dependencies
  - Add progress notes with \`conductor-tasks add-note <id>\`
  - Update status with \`conductor-tasks update <id> --status=<status>\`
  - Visualize progress with \`conductor-tasks kanban\` or \`conductor-tasks tree\`

- **Task Status Management**
  - Use \`backlog\` for tasks not yet ready for development
  - Use \`todo\` for tasks ready to be worked on
  - Use \`in_progress\` for active development
  - Use \`review\` for tasks awaiting review
  - Use \`done\` for completed and verified tasks
  - Use \`blocked\` for tasks that cannot proceed

- **Task Structure Fields**
  - **id**: Unique identifier
  - **title**: Brief, descriptive title
  - **description**: Concise summary of requirements
  - **status**: Current state
  - **priority**: Importance level (\`critical\`, \`high\`, \`medium\`, \`low\`, \`backlog\`)
  - **complexity**: Difficulty rating (1-10)
  - **dependencies**: IDs of prerequisite tasks
  - **tags**: Categories or labels
  - **notes**: Progress updates, comments, or implementation details

- **AI-Assisted Implementation**
  - Use \`conductor-tasks help-implement <id>\` for implementation guidance
  - Generate step-by-step plans with \`conductor-tasks generate-steps <id>\`
  - Get improvement suggestions with \`conductor-tasks suggest-improvements <id>\`

- **Visualization Options**
  - Kanban board: \`conductor-tasks kanban\`
  - Dependency tree: \`conductor-tasks tree\`
  - Dashboard: \`conductor-tasks dashboard\`
  - Filter by priority, tag, or status for focused views

---
SELF_IMPROVE
---
description: Guidelines for continuously improving this rules document based on emerging practices
globs: **/*
filesToApplyRule: **/*
alwaysApply: true
---

- **Rule Improvement Triggers:**
  - New workflow patterns not covered by existing rules
  - Repeated similar implementation approaches
  - Common task management patterns
  - New tools or features being used consistently
  - Emerging best practices in the project

- **Analysis Process:**
  - Compare current workflow with existing rules
  - Identify patterns that should be standardized
  - Look for optimization opportunities
  - Monitor common development questions
  - Track frequent task operations

- **Rule Updates:**
  - **Add New Rules When:**
    - A new workflow pattern is used consistently
    - Common issues could be prevented by a rule
    - Team members frequently ask the same questions
    - New features are added to Conductor Tasks

  - **Modify Existing Rules When:**
    - Better examples are available
    - Additional edge cases are discovered
    - Related rules have been updated
    - Implementation details have changed

- **Rule Quality Checks:**
  - Rules should be actionable and specific
  - Examples should come from actual project use
  - References should be up to date
  - Patterns should be consistently enforced

- **Continuous Improvement:**
  - Monitor development questions
  - Track common workflow challenges
  - Update rules after significant project changes
  - Add links to relevant documentation
  - Cross-reference related rules

- **Rule Deprecation:**
  - Mark outdated patterns as deprecated
  - Remove rules that no longer apply
  - Update references to deprecated rules
  - Document migration paths for old patterns

- **Documentation Updates:**
  - Keep examples synchronized with actual practice
  - Update references to external docs
  - Maintain links between related rules
  - Document breaking changes
`;
    }
    /**
     * Template for roo_rules.md
     */
    getRooRulesTemplate() {
        return `---
description: Guidelines for using Conductor Tasks within Roo IDE
globs: **/*
alwaysApply: true
---

- **Conductor Tasks Integration**
  - Conductor Tasks provides task management directly within Roo IDE
  - Use slash commands to interact with Conductor Tasks tools
  - Follow the development workflow for systematic task implementation
  - Leverage IDE-specific optimizations when using Conductor Tasks

- **Task Management Commands**
  - Create tasks: \`/conductor-tasks create-task\`
  - List tasks: \`/conductor-tasks list-tasks\`
  - View task details: \`/conductor-tasks get-task\`
  - Update tasks: \`/conductor-tasks update-task\`
  - Get next task: \`/conductor-tasks get-next-task\`
  - Add notes: \`/conductor-tasks add-task-note\`

- **Task Visualization**
  - Kanban board: \`/conductor-tasks visualize-tasks-kanban\`
  - Dependency tree: \`/conductor-tasks visualize-tasks-dependency-tree\`
  - Dashboard: \`/conductor-tasks visualize-tasks-dashboard\`

- **AI Assistance**
  - Get implementation help: \`/conductor-tasks help-implement-task\`
  - Generate implementation steps: \`/conductor-tasks generate-implementation-steps\`
  - Get improvement suggestions: \`/conductor-tasks suggest-task-improvements\`
  - Expand tasks: \`/conductor-tasks expand-task\`

- **Development Workflow**
  - Begin sessions by listing tasks and identifying next steps
  - Break down complex tasks into manageable subtasks
  - Track progress with notes and status updates
  - Visualize task relationships and dependencies
  - Use AI assistance for implementation guidance

- **Best Practices**
  - Create clear, specific task titles and descriptions
  - Update task status as work progresses
  - Establish proper dependencies between related tasks
  - Add implementation notes regularly
  - Use tags for categorization
  - Set appropriate priorities and complexity ratings
`;
    }
    /**
     * Template for mcp_tools.mdc
     */
    getMCPToolsTemplate() {
        return `# MCP Tools Reference Guide

This document provides detailed guidance on using Conductor Tasks MCP tools effectively within AI-assisted development environments like Cursor.

## Using MCP Tools in AI Conversations

When working with AI assistants that support MCP (Model Context Protocol), you can use Conductor Tasks tools directly through natural language prompts. The AI should handle the technical details of making proper MCP calls.

### Best Practices

- **Natural Language Requests**: Ask for what you need using natural language rather than specifying exact syntax.
  - ✅ "Show me my current tasks" (AI will use \`list-tasks\`)
  - ✅ "What should I work on next?" (AI will use \`get-next-task\`)
  - ✅ "Help me implement task ABC123" (AI will use \`help-implement-task\`)

- **Focus on Intent**: Describe what you want to accomplish rather than how to call a specific tool.
  - ✅ "Create a task for implementing user authentication"
  - ❌ "Use the create-task tool with title=auth and priority=high"

- **Provide Necessary Context**: Include relevant details for your request.
  - ✅ "Create a task for building the login page with high priority"
  - ✅ "Show me all high-priority frontend tasks"

### Common Usage Patterns

#### Task Management Flow

1. **Start Session**: "Show me my current tasks" or "What should I work on next?"
2. **Get Details**: "Tell me more about task XYZ"
3. **Plan Work**: "Break down task XYZ into smaller steps"
4. **Get Help**: "Help me implement task XYZ"
5. **Track Progress**: "Mark task XYZ as in progress" and later "Mark task XYZ as done"

#### Project Planning Flow

1. **Initialize**: "Set up Conductor Tasks for my new project"
2. **Create Initial Tasks**: "Parse this PRD to create tasks" or manually "Create tasks for my project"
3. **Organize**: "Visualize my tasks as a kanban board" or "Show me the task dependency tree"
4. **Refine**: "Suggest improvements for task XYZ" or "Add more details to task XYZ"

## Available MCP Tools

Below is a comprehensive list of all available MCP tools in Conductor Tasks:

### Task Management

- **create-task**: Creates a new task with specified details
- **update-task**: Updates an existing task's properties
- **list-tasks**: Lists all tasks, with optional filtering
- **get-task**: Retrieves detailed information about a specific task
- **add-task-note**: Adds a note or comment to a task
- **get-next-task**: Recommends the next task to work on
- **delete-task**: Removes a task

### Project Setup

- **initialize-tasks**: Sets up the task management system for a project
- **parse-prd**: Processes PRD text to create initial tasks
- **parse-prd-file**: Processes a PRD file to create initial tasks

### AI Assistance

- **generate-implementation-steps**: Creates detailed steps for implementing a task
- **expand-task**: Breaks down a task into more detailed subtasks
- **suggest-task-improvements**: Provides suggestions to improve a task
- **help-implement-task**: Gives AI assistance for implementing a specific task

### Visualization

- **visualize-tasks-kanban**: Shows tasks in a kanban board format
- **visualize-tasks-dependency-tree**: Displays the task dependency hierarchy
- **visualize-tasks-dashboard**: Shows a dashboard with task statistics

## Advanced Tips

- **Chaining Operations**: You can request multiple operations in sequence.
  - "Create a task for the login page and then break it down into subtasks"

- **Filtering and Sorting**: Specify criteria when listing or visualizing tasks.
  - "Show me all high priority frontend tasks sorted by due date"

- **Task References**: Refer to tasks by ID when updating or requesting information.
  - "Tell me more about task ABC123"

- **Additional Context**: Provide extra information for AI-powered tools.
  - "Help me implement task XYZ, focusing on React best practices"

By leveraging these MCP tools effectively through natural language, you can create a smooth, AI-assisted development workflow with Conductor Tasks.
`;
    }
    /**
     * Template for task_lifecycle.mdc
     */
    getTaskLifecycleTemplate() {
        return `# Task Lifecycle Management Guide

This document outlines the complete lifecycle of tasks in Conductor Tasks, from creation to completion, with best practices for each stage.

## Task Lifecycle Overview

Tasks in Conductor Tasks follow a progression through several states:

\`\`\`
Backlog → Todo → In Progress → Review → Done
                    ↓
                 Blocked
\`\`\`

Each state represents a specific phase in the task's lifecycle, with clear transitions and responsibilities.

## 1. Task Creation Phase

### Creating New Tasks

Tasks can be created in several ways:

- **Manual Creation**: Using \`create-task\` / \`conductor-tasks create\`
- **PRD Parsing**: Using \`parse-prd\` / \`conductor-tasks parse-prd-file\`
- **Task Breakdown**: As subtasks via \`expand-task\` / \`conductor-tasks expand\`

### Task Creation Best Practices

- **Clear Titles**: Use action-oriented, specific titles (e.g., "Implement user login form")
- **Complete Descriptions**: Include context, requirements, and acceptance criteria
- **Appropriate Priority**: Set realistic priority based on business value and urgency
  - \`critical\`: Must be completed immediately, blocking other work
  - \`high\`: Important for current milestone
  - \`medium\`: Standard priority, should be completed in reasonable time
  - \`low\`: Nice to have, can be deferred if necessary
  - \`backlog\`: For future consideration
- **Proper Dependencies**: Establish clear prerequisites with \`dependencies\` field
- **Accurate Complexity**: Rate from 1-10 based on effort and difficulty
- **Relevant Tags**: Add categorizing tags (e.g., "frontend", "api", "bugfix")

## 2. Planning and Preparation Phase

### Task Refinement

- **Expand Complex Tasks**: Break down tasks with 7+ complexity using \`expand-task\`
- **Generate Implementation Steps**: For technical tasks, use \`generate-implementation-steps\`
- **Resolve Ambiguities**: Add notes to clarify requirements or implementation approach
- **Improve Task Quality**: Use \`suggest-task-improvements\` to enhance task details

### Dependency Management

- Ensure all dependencies are correctly identified and established
- Verify dependency chain makes logical sense
- Review dependencies when planning work to avoid circular references

## 3. Implementation Phase

### Starting Work

- Update status to \`in_progress\` when beginning work on a task
- Review all dependencies to ensure prerequisites are completed
- Use \`help-implement-task\` for implementation guidance

### Progress Tracking

- Add regular progress notes using \`add-task-note\` with type \`progress\`
- Document key decisions, approaches, and challenges
- Update estimated effort as understanding evolves
- If blocked, change status to \`blocked\` and add note explaining the blocker

### Implementation Best Practices

- Follow project coding standards and architecture
- Break implementation into discrete steps
- Keep focus on meeting the task's acceptance criteria
- Document non-obvious implementation details

## 4. Review Phase

### Pre-Review Checklist

- Verify all acceptance criteria are met
- Ensure implementation is complete
- Update task with any relevant implementation notes
- Change status to \`review\`

### Review Process

- Have another team member review the work
- Document review feedback as task notes
- Address all review comments
- If significant changes needed, return to \`in_progress\`

## 5. Completion Phase

### Task Completion

- Update status to \`done\` when all criteria are met and review is passed
- Add final notes about implementation outcome if needed
- Record actual effort spent for future estimation reference

### Post-Completion

- Update dependent tasks if implementation details affect them
- Consider creating follow-up tasks for improvements or technical debt
- Share knowledge gained during implementation

## Task Transitions and Signals

### Status Change Guidelines

- **backlog → todo**: Task is ready to be worked on in upcoming sprint/cycle
- **todo → in_progress**: Active development has started
- **in_progress → blocked**: External dependency or issue preventing progress
- **blocked → in_progress**: Blocker resolved, work resumed
- **in_progress → review**: Implementation complete, awaiting verification
- **review → in_progress**: Issues found during review
- **review → done**: Review passed, task complete

### Communication Through Task Updates

- Use task notes to communicate important information
- Update task status promptly to reflect current state
- Tag relevant team members in notes when attention is needed
- Use note types effectively:
  - \`progress\`: Updates on implementation
  - \`comment\`: General information or questions
  - \`blocker\`: Describe impediments
  - \`solution\`: Document resolved issues

## Task Visualization and Reporting

- Monitor overall project progress with \`visualize-tasks-dashboard\`
- Track workflow with \`visualize-tasks-kanban\`
- Understand dependencies with \`visualize-tasks-dependency-tree\`
- Use these visualizations in team meetings and planning sessions

By following this lifecycle management approach, you can ensure all tasks move efficiently from creation to completion while maintaining clarity and focus throughout the development process.
`;
    }
    /**
     * Template for ai_assistance.mdc
     */
    getAIAssistanceTemplate() {
        return `# AI-Assisted Implementation Guide

This document outlines strategies for effectively using Conductor Tasks' AI assistance features to implement tasks efficiently and with high quality.

## Available AI Assistance Tools

Conductor Tasks provides several AI-powered tools to help with task implementation:

1. **help-implement-task**: Provides comprehensive implementation guidance for a specific task
2. **generate-implementation-steps**: Creates a structured breakdown of implementation steps
3. **expand-task**: Breaks down a complex task into more manageable subtasks
4. **suggest-task-improvements**: Offers suggestions to improve task definition and clarity

## When to Use Each AI Tool

### Help Implement Task

Use \`help-implement-task\` / \`conductor-tasks help-implement <taskId>\` when:
- You're ready to begin implementing a task
- You need guidance on approach, architecture, or specific techniques
- You want code examples or implementation patterns
- You're stuck on a particular aspect of implementation

**Example Usage:**
\`\`\`
conductor-tasks help-implement task-123 --additionalContext="We're using React 18 with TypeScript"
\`\`\`

**Best Practices:**
- Provide additional context about technology stack, constraints, or preferences
- Ask specific questions if you need guidance on particular aspects
- Share existing code snippets if you need help integrating with them
- Iterate with follow-up questions to refine the implementation

### Generate Implementation Steps

Use \`generate-implementation-steps\` / \`conductor-tasks generate-steps <taskId>\` when:
- You need a structured approach to a complex task
- You want to break down implementation into discrete, manageable steps
- You're planning your implementation approach
- You need to share the implementation plan with team members

**Example Usage:**
\`\`\`
conductor-tasks generate-steps task-456
\`\`\`

**Best Practices:**
- Review and refine the generated steps before implementation
- Use the steps as a checklist during implementation
- Add generated steps to the task as implementation notes
- Modify steps as needed if requirements or understanding changes

### Expand Task

Use \`expand-task\` / \`conductor-tasks expand <taskId>\` when:
- A task is too complex to implement as a single unit
- You need to divide responsibility among team members
- You want to track progress on different components separately
- The task has a complexity rating of 7+

**Example Usage:**
\`\`\`
conductor-tasks expand task-789 --expansionPrompt="Focus on separating frontend and backend concerns"
\`\`\`

**Best Practices:**
- Provide guidance in the expansion prompt about how to divide the task
- Review subtasks and adjust as needed
- Ensure subtasks have clear dependencies if they need to be done in sequence
- Keep subtasks focused on specific, concrete deliverables

### Suggest Task Improvements

Use \`suggest-task-improvements\` / \`conductor-tasks suggest-improvements <taskId>\` when:
- Task description seems vague or incomplete
- You're not sure about the acceptance criteria
- You want to ensure all edge cases are considered
- You need to improve a task before implementation

**Example Usage:**
\`\`\`
conductor-tasks suggest-improvements task-321
\`\`\`

**Best Practices:**
- Apply suggested improvements selectively based on relevance
- Use improvement suggestions to enhance task documentation
- Consider improvement suggestions as discussion points for team clarification
- Update the task with the refined details using \`update-task\`

## Effective AI Collaboration Patterns

### 1. The Planning-Implementation Cycle

1. Start with \`generate-implementation-steps\` to create a plan
2. Review and refine the plan
3. Use \`help-implement-task\` for each major step in the plan
4. Document progress and challenges with task notes
5. Iterate as needed

### 2. The Progressive Breakdown Approach

1. Begin with \`expand-task\` to create subtasks
2. Prioritize subtasks based on dependencies
3. Implement each subtask using \`help-implement-task\`
4. Mark subtasks as done progressively
5. Review the overall implementation when all subtasks are complete

### 3. The Iterative Refinement Loop

1. Start implementation with initial understanding
2. When stuck or unclear, use \`suggest-task-improvements\`
3. Refine the task definition
4. Continue implementation with better clarity
5. Repeat as needed until completion

## Task-Specific AI Assistance

Different types of tasks benefit from different AI assistance approaches:

### For Frontend Tasks
- Focus on component structure, state management, and UI/UX patterns
- Request examples with styling and responsive considerations
- Ask about accessibility compliance
- Consider browser compatibility

### For Backend Tasks
- Focus on API design, data models, and business logic
- Request examples with error handling and validation
- Ask about performance considerations
- Consider security implications

### For Database Tasks
- Focus on schema design, query optimization, and data integrity
- Request examples of migrations and data transformations
- Ask about indexing and performance
- Consider data consistency and backup strategies

### For DevOps Tasks
- Focus on automation, deployment strategies, and infrastructure
- Request examples of configuration and script snippets
- Ask about monitoring, logging, and observability
- Consider security and scalability

## Enhancing AI Assistance with Context

The more context you provide, the more tailored the AI assistance will be:

1. **Project Context**: Describe the overall project architecture and goals
2. **Technical Stack**: Specify frameworks, libraries, and tools in use
3. **Conventions**: Mention coding standards, patterns, and naming conventions
4. **Constraints**: Note any limitations or requirements that must be considered
5. **Examples**: Reference similar existing implementations in the project

## Balancing AI Guidance with Human Expertise

While AI assistance is powerful, remember to:

- Critically evaluate AI suggestions against project requirements
- Apply your domain knowledge and experience
- Consider edge cases that might not be immediately obvious to the AI
- Maintain project consistency even if AI suggests different approaches
- Use AI as a collaborative tool, not a replacement for human judgment

By effectively leveraging these AI assistance features, you can accelerate implementation while maintaining high quality standards in your development process.
`;
    }
    /**
     * Template for visualization.mdc
     */
    getVisualizationTemplate() {
        return `# Task Visualization Guide

This document explains how to use Conductor Tasks' visualization tools to gain insights into project progress, task relationships, and overall status.

## Available Visualization Tools

Conductor Tasks provides three main visualization tools:

1. **Kanban Board**: View tasks organized by status (\`visualize-tasks-kanban\`)
2. **Dependency Tree**: Understand task relationships and prerequisites (\`visualize-tasks-dependency-tree\`)
3. **Dashboard**: See overall project metrics and progress (\`visualize-tasks-dashboard\`)

## Kanban Board Visualization

The Kanban board provides a status-based view of all tasks, organized into columns.

### Usage

**MCP Tool**: \`visualize-tasks-kanban\`
**CLI Command**: \`conductor-tasks kanban [options]\`

**Key Options**:
- \`priority\`: Filter by priority level
- \`tag\`: Filter by specific tag
- \`compact\`: Use compact display mode (default: false)
- \`showPriority\`: Display priority indicators (default: true)
- \`showComplexity\`: Display complexity indicators (default: true)

### Example Output

\`\`\`
┌─────────────┬──────────────────┬───────────────────┬──────────────┬──────────┐
│   BACKLOG   │       TODO       │   IN PROGRESS     │    REVIEW    │   DONE   │
├─────────────┼──────────────────┼───────────────────┼──────────────┼──────────┤
│ ⭐⭐⭐ 🔷🔷   │ ⭐⭐⭐ 🔷🔷🔷      │ ⭐⭐ 🔷🔷🔷         │ ⭐⭐ 🔷        │ ⭐⭐ 🔷🔷   │
│ #123 Setup  │ #124 Implement   │ #126 Create user  │ #127 Build   │ #121 Init│
│ database    │ authentication   │ profile page      │ settings UI  │ project  │
├─────────────┼──────────────────┼───────────────────┼──────────────┼──────────┤
│ ⭐ 🔷        │ ⭐⭐ 🔷🔷           │                   │              │ ⭐ 🔷      │
│ #125 Add    │ #128 Implement   │                   │              │ #122 Setup│
│ analytics   │ file upload      │                   │              │ CI/CD    │
└─────────────┴──────────────────┴───────────────────┴──────────────┴──────────┘
Legend: Priority (⭐) - Complexity (🔷)
\`\`\`

### Best Uses

- **Daily Standups**: Review current work in progress
- **Sprint Planning**: Assess workload across statuses
- **Progress Tracking**: Monitor task movement across the board
- **Workload Balancing**: Identify bottlenecks in specific statuses

### Interpretation Tips

- **Column Balance**: Ideally, work should flow steadily across columns
- **Bottlenecks**: Many tasks in one column may indicate process issues
- **Priority Distribution**: Notice if high-priority items are stalled
- **Complexity Patterns**: Watch for high-complexity tasks getting stuck

## Dependency Tree Visualization

The dependency tree shows hierarchical relationships between tasks, helping identify prerequisites and task ordering.

### Usage

**MCP Tool**: \`visualize-tasks-dependency-tree\`
**CLI Command**: \`conductor-tasks tree [taskId]\`

**Key Options**:
- \`taskId\`: Optional focus on a specific task and its dependencies

### Example Output

\`\`\`
Task Dependency Tree:

[!] #121 Initialize project ✅
└── [!] #122 Setup CI/CD pipeline ✅
    └── [!] #123 Setup database schema 🕒
        ├── [!!] #124 Implement authentication 🕒
        │   └── [!!] #126 Create user profile page 👨‍💻
        └── [!] #125 Add analytics integration 🕒
            └── [!!] #127 Build settings UI 👀
                └── [!!] #128 Implement file upload 🕒

Legend: [!!!] Critical  [!!] High  [!] Medium  [·] Low
Status: ✅ Done  🕒 Todo  👨‍💻 In Progress  👀 Review  ⛔ Blocked
\`\`\`

### Best Uses

- **Planning**: Understand prerequisites before assigning work
- **Blockers**: Identify critical path tasks that may block progress
- **Estimation**: Assess the depth and complexity of dependency chains
- **Onboarding**: Help new team members understand project structure

### Interpretation Tips

- **Long Chains**: Long dependency chains increase project risk
- **Branching**: Multiple branches allow parallel work
- **Status Gaps**: Look for "done" tasks with "pending" predecessors (may indicate errors)
- **Critical Path**: Focus on the longest chain with the most dependencies

## Dashboard Visualization

The dashboard provides high-level metrics and summaries of project progress.

### Usage

**MCP Tool**: \`visualize-tasks-dashboard\`
**CLI Command**: \`conductor-tasks dashboard\`

### Example Output

\`\`\`
PROJECT DASHBOARD: My Awesome Project

Task Status Summary:
┌────────────┬────────┬──────────┬─────────┬────────┬──────────┐
│ Status     │ Count  │ % Total  │ High+   │ Avg    │ Recently │
│            │        │          │ Critical│ Complex.│ Updated  │
├────────────┼────────┼──────────┼─────────┼────────┼──────────┤
│ Done       │ 12     │ 30.0%    │ 5       │ 4.2    │ 2        │
│ In Progress│ 8      │ 20.0%    │ 6       │ 6.7    │ 8        │
│ Review     │ 4      │ 10.0%    │ 2       │ 5.5    │ 4        │
│ Todo       │ 14     │ 35.0%    │ 8       │ 5.9    │ 0        │
│ Blocked    │ 2      │ 5.0%     │ 2       │ 7.5    │ 1        │
└────────────┴────────┴──────────┴─────────┴────────┴──────────┘

Priority Distribution:        Complexity Distribution:
Critical: ███░░░░░░░ 28%      8-10: ██░░░░░░░░ 18%
High:     ████░░░░░░ 35%      5-7:  █████░░░░░ 50%
Medium:   ███░░░░░░░ 25%      1-4:  ███░░░░░░░ 32%
Low:      █░░░░░░░░░ 12%

Recent Activity (Last 7 Days):
- 14 status changes
- 8 new tasks created
- 22 notes added
- 5 tasks completed

Tags with Most Open Tasks:
- frontend: 12 tasks
- api: 8 tasks
- documentation: 5 tasks
- devops: 4 tasks
\`\`\`

### Best Uses

- **Executive Summaries**: High-level project status reporting
- **Team Meetings**: Overview of project health and focus areas
- **Project Tracking**: Monitor progress over time
- **Resource Allocation**: Identify where effort is being spent

### Interpretation Tips

- **Status Distribution**: Healthy projects maintain balanced distribution
- **Priority vs. Status**: High priority items should be in progress or done
- **Complexity vs. Status**: High complexity items in early stages need attention
- **Recent Activity**: Low activity may indicate team blockers
- **Tag Distribution**: Identify potential imbalances in work areas

## Combining Visualizations

Each visualization provides different insights. Use them together for comprehensive understanding:

1. **Dashboard** for overall project health and metrics
2. **Kanban** for current workflow and task status
3. **Dependency Tree** for understanding relationships and blockers

## Visualization Best Practices

- **Regular Reviews**: Make visualization part of regular workflow
  - Daily: Kanban board for tactical work
  - Weekly: Dependency tree for planning
  - Monthly: Dashboard for strategic overview

- **Targeted Filtering**: Use filters to focus on relevant subsets
  - Filter kanban by tag for team-specific views
  - Focus dependency tree on critical path tasks
  - Compare dashboard metrics by time period

- **Interpretation Context**: Consider visualizations in context
  - Not all blocked tasks indicate problems (may be intentionally deferred)
  - High complexity isn't bad if properly managed
  - Status distribution varies by project phase

- **Actionable Insights**: Turn observations into specific actions
  - Address bottlenecks identified in kanban
  - Focus on high-priority blockers in dependency tree
  - Rebalance effort based on dashboard metrics

By effectively using these visualization tools, you can gain valuable insights into your project's progress, identify potential issues early, and make data-driven decisions about resource allocation and prioritization.
`;
    }
    /**
     * Template for rules_index.mdc
     */
    getRulesIndexTemplate() {
        return `# Conductor Tasks Rules Documentation

This document serves as an index of all rule files provided by Conductor Tasks to help AI assistants provide optimal guidance and support for your development workflow.

## Purpose of Rules Files

The rules files in this project serve several important purposes:

1. **Guiding AI Assistants**: They provide structured knowledge to help AI understand how to interact with Conductor Tasks effectively.
2. **Standardizing Workflows**: They document best practices and standard processes for consistent task management.
3. **Optimizing Tool Usage**: They explain how to use Conductor Tasks tools effectively in different environments.
4. **Providing Context**: They give AI assistants the necessary context to make helpful suggestions.

## Available Rules Files

Below is a comprehensive list of available rules files, organized by category:

### Core Development Workflow

- [**dev_workflow.mdc**](mdc:.cursor/rules/dev_workflow.mdc): Comprehensive guide for using Conductor Tasks in your development process, covering the entire workflow from project initialization to task completion.

- [**task_lifecycle.mdc**](mdc:.cursor/rules/task_lifecycle.mdc): Detailed explanation of the task lifecycle, from creation to completion, with best practices for each stage.

### Tool Usage Guides

- [**mcp_tools.mdc**](mdc:.cursor/rules/mcp_tools.mdc): Reference guide for using Conductor Tasks MCP tools effectively within AI-assisted development environments.

- [**conductor_tasks.mdc**](mdc:.cursor/rules/conductor_tasks.mdc): Detailed reference for all available Conductor Tasks commands and tools, including both MCP and CLI usage.

### Specialized Guidance

- [**ai_assistance.mdc**](mdc:.cursor/rules/ai_assistance.mdc): Strategies for effectively using AI assistance features to implement tasks efficiently.

- [**visualization.mdc**](mdc:.cursor/rules/visualization.mdc): Guide to using task visualization tools to gain insights into project progress and task relationships.

### IDE-Specific Rules

- [**cursor_rules.mdc**](mdc:.cursor/rules/cursor_rules.mdc): Format and structure guidelines for Cursor IDE rule files.

- [**.windsurfrules**](mdc:.windsurfrules): Windsurf IDE-specific rules and formatting guidelines.

- [**.roo/rules/roo_rules.md**](mdc:.roo/rules/roo_rules.md): Roo IDE-specific rules and guidelines.

## How to Use These Rules

AI assistants should:

1. **Consult Appropriate Rules**: Reference the most relevant rule file based on the current context and user question.

2. **Follow Documented Patterns**: Adhere to the patterns, formats, and practices documented in these rules.

3. **Prioritize Rule Specificity**: 
   - IDE-specific rules take precedence when in that specific environment
   - Task-specific rules apply when working on related tasks
   - General workflow rules provide the foundation for all interactions

4. **Cross-Reference When Needed**: Different rule files may contain complementary information that should be considered together.

5. **Explain Rule-Based Recommendations**: When making suggestions based on these rules, briefly mention the relevant rule to help users understand the recommendation context.

## Rule Maintenance

These rules are automatically generated during project initialization but can be customized to better suit your project's specific needs:

1. **Modifying Rules**: Edit rule files directly to update guidance as your workflow evolves.

2. **Adding New Rules**: Create new rule files in the appropriate directories following the formats specified in existing files.

3. **Regenerating Rules**: If needed, rules can be regenerated by running the initialization command again with the appropriate flags.

By leveraging these comprehensive rules, AI assistants can provide more consistent, accurate, and helpful guidance throughout your development process with Conductor Tasks.
`;
    }
}
//# sourceMappingURL=ruleGenerator.js.map