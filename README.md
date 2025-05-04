# Conductor Tasks

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**An AI-powered task management system designed for developers.**

Conductor Tasks allows you to manage development tasks, parse requirements, generate implementation steps, get AI assistance, and visualize your workflow. It works both as a standalone CLI tool and integrates seamlessly with AI-assisted editors like Cursor via the Model Context Protocol (MCP).

**Supported LLM Providers:**

*   Anthropic (Claude)
*   OpenAI (GPT)
*   Mistral AI
*   Groq
*   Google (Gemini)
*   xAI (Grok)

Configure your preferred provider using API keys via environment variables (see configuration details below).

## Features

*   **Task Management:** Create, update, list, get, and delete tasks.
*   **AI Integration:**
    *   Parse Product Requirements Documents (PRDs) into tasks.
    *   Generate detailed implementation steps for tasks.
    *   Expand tasks with more details or subtasks using AI.
    *   Get AI-powered suggestions for task improvements.
    *   Receive direct AI assistance for implementing tasks.
*   **Rich Task Details:** Support for priority, status, assignee, tags, due dates, complexity, and dependencies.
*   **Notes:** Add progress updates, comments, blockers, or solutions to tasks.
*   **Visualization:** View tasks as a Kanban board, dependency tree, or dashboard summary.
*   **CLI & MCP:** Usable as both a standalone command-line tool and an MCP server for IDE integration.
*   **Configurable:** Supports multiple LLM providers (see list above) via environment variables.
*   **Flexible Storage:** Stores tasks in a local `TASKS.md` file.



## Getting Started / Setup

There are two primary ways to configure and use Conductor Tasks:

1.  **MCP Integration (Recommended for IDEs like Cursor):** Configure API keys and settings directly within your editor's MCP configuration for seamless AI interaction. 
    *   [Jump to MCP Setup Guide](#mcp-integration-recommended-for-ides)
    *   [View detailed MCP environment variables](./docs/mcp-setup.md)
2.  **Command Line Interface (CLI):** Use `conductor-tasks` directly from your terminal. Configure using a `.env` file.
    *   [Jump to CLI Usage Guide](#cli-usage)
    *   [Jump to CLI Configuration (.env)](#cli-configuration-env)

## MCP Integration (Recommended for IDEs)

While Conductor Tasks works great as a standalone CLI tool, it truly shines when integrated into an environment supporting the **Model Context Protocol (MCP)**, such as the [Cursor IDE](https://cursor.sh/). This allows the AI assistant in your editor to directly interact with Conductor for seamless task management.

**Setup:**

Configuring Conductor via MCP involves setting environment variables directly within your editor's MCP server configuration. This method is often preferred over `.env` files when using integrated tools.

1.  **Locate your editor's MCP configuration file** (e.g., `mcp.json` or similar).
2.  **Add or modify the server entry for Conductor Tasks.**

**Example Configuration (e.g., for Cursor):**

```json
{
  "mcpServers": {
    "conductor-tasks": {
      "command": "npx", // Or 'conductor-tasks' if installed globally
      "args": [
          "-y", // Only needed if using npx and not installed globally
          "conductor-tasks",
          "--serve-mcp"
      ],
      "env": {
        // Required: At least one API Key
        "GROQ_API_KEY": "gsk_YOUR_GROQ_API_KEY",
        // Optional: Specify preferred provider and model
        "DEFAULT_LLM_PROVIDER": "groq",
        "GROQ_MODEL": "llama3-8b-8192"
        // Optional: Override default task file location
        // "CONDUCTOR_TASKS_FILE": "/path/to/your/project/TASKS.md"
      }
    }
  }
}
```

**For a comprehensive list of all available MCP environment variables and detailed setup instructions, please refer to the [MCP Configuration Guide](./docs/mcp-setup.md).**

Running `conductor-tasks --serve-mcp` manually from your terminal will also start the server, but it's primarily intended for integration tools to launch.

## CLI Usage

### Installation

```bash
npm install -g conductor-tasks
```

Alternatively, you can use `npx` to run commands without global installation:

```bash
npx conductor-tasks [command] [options]
```

The main command is `conductor-tasks`.

```bash
conductor-tasks [command] [options]
```

**Global Options:**

*   `-f, --file <path>`: Path to the `TASKS.md` file (defaults to `./TASKS.md` in the current directory).
*   `--help, -h`: Show help.
*   `--version, -v`: Show version number.
*   `--serve-mcp`: Run in MCP server mode (for IDE integration, not for direct CLI use - see MCP section above).

**Commands:**

*   **`init`**: Initialize the task management system.
    *   `--projectName <name>`: Name of the project.
    *   `--projectDescription <desc>`: Description of the project.
    *   Example: `conductor-tasks init --projectName my-new-app --projectDescription "A cool web app" -f ./project/docs/TASKS.md`

*   **`create`**: Create a new task.
    *   `--title <title>`: (Required) Title of the task.
    *   `--description <desc>`: Detailed description.
    *   `--priority <level>`: (`critical`, `high`, `medium`, `low`, `backlog`)
    *   `--status <status>`: (`backlog`, `todo`, `in_progress`, `review`, `done`, `blocked`)
    *   `--assignee <user>`: Assignee username or email.
    *   `--tags <tag1> <tag2> ...`: List of tags.
    *   `--dueDate <YYYY-MM-DD>`: Due date.
    *   `--complexity <1-10>`: Complexity score.
    *   `--dependencies <id1> <id2> ...`: List of task IDs this depends on.
    *   Example: `conductor-tasks create --title "Setup CI/CD" --priority high --tags ci cd deployment`

*   **`update <id>`**: Update an existing task.
    *   `<id>`: (Required) ID of the task to update.
    *   Accepts the same options as `create` to update specific fields.
    *   Example: `conductor-tasks update task-123 --status in_progress --assignee user@example.com`

*   **`list`**: List tasks.
    *   `--status <status>`: Filter by status.
    *   `--priority <level>`: Filter by priority.
    *   `--tags <tag1> <tag2> ...`: Filter by tags (any match).
    *   `--sortBy <field>`: (`priority`, `dueDate`, `createdAt`, `updatedAt`, `complexity`)
    *   `--sortDirection <dir>`: (`asc`, `desc`, default: `asc`)
    *   Example: `conductor-tasks list --status todo --priority high --sortBy createdAt --sortDirection desc`

*   **`get <id>`**: Get details of a specific task.
    *   `<id>`: (Required) ID of the task.
    *   Example: `conductor-tasks get task-456`

*   **`add-note <taskId>`**: Add a note to a task.
    *   `<taskId>`: (Required) ID of the task.
    *   `--content <text>`: (Required) Content of the note.
    *   `--author <name>`: (Required) Author of the note.
    *   `--type <type>`: (`progress`, `comment`, `blocker`, `solution`, default: `comment`)
    *   Example: `conductor-tasks add-note task-123 --author "Dev" --type progress --content "Finished setting up the database schema."`

*   **`next`**: Get the next task to work on (based on simple priority/status logic).
    *   Example: `conductor-tasks next`

*   **`parse-prd`**: Parse PRD content to create tasks.
    *   `--prdContent <string>`: (Required) The PRD content as a string.
    *   `--createTasksFile <bool>`: Create/update the TASKS.md file (default: true).
    *   Example: `conductor-tasks parse-prd --prdContent "Feature: User login...
Requirement: Users must be able to login with email/password..."`

*   **`parse-prd-file <filePath>`**: Parse a PRD file from disk.
    *   `<filePath>`: (Required) Path to the PRD file.
    *   `--createTasksFile <bool>`: Create/update the TASKS.md file (default: true).
    *   `--verbose <bool>`: Show detailed output (default: false).
    *   Example: `conductor-tasks parse-prd-file ./docs/requirements.md`

*   **`delete <id>`**: Delete a task.
    *   `<id>`: (Required) ID of the task.
    *   Example: `conductor-tasks delete task-789`

*   **`generate-steps <taskId>`**: Generate implementation steps for a task.
    *   `<taskId>`: (Required) ID of the task.
    *   Example: `conductor-tasks generate-steps task-101`

*   **`expand <taskId>`**: Expand a task with more details/subtasks using AI.
    *   `<taskId>`: (Required) ID of the task.
    *   `--expansionPrompt <text>`: Additional context for expansion.
    *   Example: `conductor-tasks expand task-102 --expansionPrompt "Focus on the database schema design."`

*   **`suggest-improvements <taskId>`**: Get AI suggestions for improving a task.
    *   `<taskId>`: (Required) ID of the task.
    *   Example: `conductor-tasks suggest-improvements task-103`

*   **`help-implement <taskId>`**: Get AI assistance to implement a task.
    *   `<taskId>`: (Required) ID of the task.
    *   `--additionalContext <text>`: Additional context for implementation.
    *   Example: `conductor-tasks help-implement task-104 --additionalContext "Using Typescript and Express."`

*   **`kanban`**: Display tasks in a Kanban board view.
    *   `--priority <level>`: Filter by priority.
    *   `--tag <tag>`: Filter by tag.
    *   `--compact <bool>`: Use compact display (default: false).
    *   `--showPriority <bool>`: Show priority indicators (default: true).
    *   `--showComplexity <bool>`: Show complexity indicators (default: true).
    *   Example: `conductor-tasks kanban --tag backend --compact`

*   **`tree [taskId]`**: Display task dependency tree.
    *   `[taskId]`: (Optional) ID of the task to focus on.
    *   Example: `conductor-tasks tree` (show all) or `conductor-tasks tree task-105`

*   **`dashboard`**: Display task dashboard with summary statistics.
    *   Example: `conductor-tasks dashboard`

## CLI Configuration (.env)

If you are primarily using Conductor Tasks via the command line (not through MCP integration), you can configure it using a `.env` file.

1.  **Create a `.env` file** in the directory where you run `conductor-tasks` (or in your project root).
2.  **Add your API keys and other settings:**

    ```dotenv
    # Example .env file
    OPENAI_API_KEY=sk-...
    ANTHROPIC_API_KEY=sk-ant-api03-...
    # GROQ_API_KEY=gsk_...
    # Add other supported provider keys as needed

    # Optional: Set default provider
    # LLM_PROVIDER=openai

    # Optional: Override default task file path
    # CONDUCTOR_TASKS_FILE=./project/TASKS.md
    ```

**Supported Environment Variables in `.env`:**

*   `OPENAI_API_KEY`: Your OpenAI API key.
*   `ANTHROPIC_API_KEY`: Your Anthropic API key.
*   `GROQ_API_KEY`: Your Groq API key.
*   `MISTRAL_API_KEY`: Your Mistral API key.
*   `GEMINI_API_KEY`: Your Google Gemini API key.
*   `XAI_API_KEY`: Your xAI API key.
*   `LLM_PROVIDER`: Set the default LLM provider (e.g. `openai`, `anthropic`, `groq`). If unset, a default provider order is used.
*   `CONDUCTOR_TASKS_FILE`: Override the default path for the `TASKS.md` file (defaults to `./TASKS.md`).

**Note:** Environment variables set via MCP configuration take precedence over `.env` files when running through an integrated editor.

## Development

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Build the code: `npm run build`
4.  Run in watch mode: `npm run dev`
5.  Run CLI during development: `node ./build/index.js [command] [options]`

## License

MIT