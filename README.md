# Conductor Tasks: Task Manager for AI Development

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/conductor-tasks.svg)](https://badge.fury.io/js/conductor-tasks)
<!-- Add other relevant badges here, e.g., build status, downloads -->

**Transform requirements into actionable tasks, generate implementation plans, track progress, and accelerate development – all powered by AI, directly within your workflow.**

Conductor Tasks is an intelligent assistant designed for developers. It integrates seamlessly into your editor (via MCP) or works as a standalone CLI tool, leveraging multiple LLMs to streamline your development process from planning to execution.

## Key Features

*    **AI-Powered Task Generation**: Instantly parse Product Requirements Documents (PRDs), markdown files, or even unstructured notes into structured, actionable tasks.
*    **Intelligent Task Expansion & Planning**: Automatically break down complex tasks into detailed subtasks and generate step-by-step implementation plans using context-aware AI.
*    **Powerful CLI for Automation**: Leverage a comprehensive command-line interface for scripting, automation, and use outside of an editor.
*    **Versatile Task Templating**: Create new tasks from predefined or custom templates, standardizing common workflows and saving setup time.
*    **Visual Task Management**: Get a clear overview of your project with Kanban boards, dependency trees, and summary dashboards
*    **Multi-Provider LLM Flexibility**: Works out-of-the-box with OpenAI, Anthropic, Groq, Mistral, Google Gemini, Perplexity, xAI, Azure OpenAI. Easily configure custom/local OpenAI-compatible endpoints (like Ollama or LM Studio). You're not locked into a single provider – choose the best LLM for each specific need.

## Why Conductor Tasks?

While many AI-powered task management tools offer valuable assistance, Conductor Tasks is engineered to provide a more comprehensive, flexible, and deeply integrated AI development assistant. Here's how Conductor Tasks stands out:

*   **True Multi-LLM Architecture for Optimal Results & Cost**:
    Conductor Tasks is built with a foundational multi-LLM strategy, not just as an add-on. It seamlessly integrates with a broad spectrum of providers (OpenAI, Anthropic, Groq, Mistral, Google Gemini, Perplexity, xAI, Azure OpenAI, OpenRouter) and local/custom endpoints (e.g., Ollama, LM Studio). This empowers you to:
    *   **Select the best LLM for *each specific job*** (e.g., use a powerful model for initalizing, a faster model for summarization, perplexity for research).
    *   **Optimize costs** by routing tasks to the most economical LLM that can perform the job effectively.
    *   Avoid vendor lock-in and adapt to the rapidly evolving LLM landscape.

    _Unlike systems that may rely heavily on a single primary LLM or offer limited provider choices, Conductor Tasks offers genuine flexibility and strategic LLM utilization at its core._

*   **Advanced AI-Driven Development & Task Lifecycle Management**:
    Beyond basic PRD parsing, Conductor Tasks offers a richer suite of AI tools that assist throughout the development lifecycle:
    *   **Sophisticated Task Expansion & Step Generation**: `generate-implementation-steps` and `expand-task` provide detailed, actionable plans.
    *   **AI-Suggested Task Improvements**: Use `suggest-task-improvements` to iteratively refine task definitions and scope.
    *   **Integrated Research Capabilities**: The `research-topic` command allows AI to gather information directly related to a task, embedding knowledge gathering into your workflow.
    *   **AI-Assisted Code Modification**: Features like `generate-diff` help in visualizing and creating code changes.

    _This provides a more in-depth AI partnership from planning through to aspects of implementation, exceeding the scope of simpler task generation tools._

*   **Built-in Visual Project Oversight**:
    Gain clearer insights into your project's status and structure with:
    *   **Kanban Boards**: `visualize-tasks-kanban` for a familiar agile overview.
    *   **Dependency Trees**: `visualize-tasks-dependency-tree` to understand task relationships.
    *   **Summary Dashboards**: `visualize-tasks-dashboard` for a high-level statistical view.

    _Many task systems require external tools for such visualizations; Conductor Tasks integrates them._

*   **Versatile Task Templating Engine**:
    Standardize common project setups and repetitive task structures with:
    *   `list-task-templates`, `get-task-template`, and `create-task-from-template`.
    *   Accelerate project initialization and ensure consistency across similar work items.

    _This feature promotes reusability and efficiency, often not found in less comprehensive task systems._

In essence, Conductor Tasks aims to be a more powerful, adaptable, and economically sensible AI co-pilot for the entire development process.

## Quick Start

### Option 1: Editor Integration (MCP - Recommended)

1.  **Add the MCP Server Configuration**: Add the following to your editor's MCP settings (e.g., `mcp.json`, `settings.json`):
    ```json
    {
      "mcpServers": {
        "conductor-tasks": {
          "command": "npx",
          // Ensure conductor-tasks is installed or use the correct path
          "args": ["conductor-tasks", "--serve-mcp"],
          // Set API keys and preferences via environment variables
          "env": {
            "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
            "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_KEY_HERE",
            "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
            // Add other keys (MISTRAL, GROQ, PERPLEXITY, OPENROUTER, XAI, AZURE) as needed
            "DEFAULT_LLM_PROVIDER": "openai" // Or your preferred default
          }
        }
      }
    }
    ```
2.  **Enable the MCP Server** in your editor.
3.  **Interact via AI Chat**:
    *   `"Initialize conductor-tasks for my project."`
    *   `"Parse the PRD at 'docs/requirements.md' into tasks."`
    *   `"What's the next task I should work on?"`
    *   `"Help me implement task <ID>."`
    *   `"Generate implementation steps for task <ID>."`
    *   `"Show me the tasks as a kanban board."`

### Option 2: Standalone Command Line (CLI)

1.  **Installation**:
    ```bash
    # Install globally (recommended for CLI use)
    npm install -g conductor-tasks

    # Or use npx without installing globally
    # npx conductor-tasks <command>
    ```
2.  **Set Environment Variables**: Create a `.env` file in your project or export variables (e.g., `export OPENAI_API_KEY="sk-..."`). See Configuration below.
3.  **Common Commands**:
    ```bash
    # Initialize Conductor Tasks in a new or existing project
    conductor-tasks init --projectName "My Awesome App" --projectDescription "Building the future"

    # Parse a PRD file and create/update TASKS.md
    conductor-tasks parse-prd ./path/to/your/prd.md --createTasksFile

    # List all tasks
    conductor-tasks list

    # Get the next suggested task
    conductor-tasks next

    # Get details for a specific task
    conductor-tasks get --id <TASK_ID>

    # Update a task (e.g., set status to 'in_progress')
    conductor-tasks update --id <TASK_ID> --status in_progress

    # Generate detailed implementation steps for a task
    conductor-tasks generate-steps --id <TASK_ID>

    # Visualize tasks
    conductor-tasks visualize --kanban
    conductor-tasks visualize --dependency-tree
    ```

## Documentation

For more detailed information, check out the documentation in the `docs` directory or explore the CLI help (`conductor-tasks --help` or `conductor-tasks <command> --help`).

*   [MCP Configuration Guide (`docs/mcp-setup.md`)](docs/mcp-setup.md) (Detailed guide for MCP-specific environment variables and editor integration)

## Configuration

Conductor Tasks uses environment variables for configuration, typically loaded from a `.env` file in your project root or set via MCP. For a detailed guide on environment variable settings, please see the [MCP Configuration Guide](docs/mcp-setup.md).

**Required:**

*   At least one API key for your desired LLM provider(s) (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `PERPLEXITY_API_KEY`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `AZURE_OPENAI_API_KEY`).

**Optional:**

*   `DEFAULT_LLM_PROVIDER`: (e.g., `openai`, `anthropic`, `google`) Sets the default provider if multiple keys are present.
*   `OPENAI_MODEL`, `ANTHROPIC_MODEL`, etc.: Specify default models for each provider.
*   `OPENAI_BASE_URL`: Use a custom OpenAI-compatible endpoint (e.g., for Ollama, LM Studio).
*   `LOG_LEVEL`: (e.g., `info`, `debug`) Control logging verbosity.

Example `.env` file:

```dotenv
# Required Keys (add all you intend to use)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
GOOGLE_API_KEY=AIza...

# Optional Defaults & Customization
DEFAULT_LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o
ANTHROPIC_MODEL=claude-3-opus-20240229
# OPENAI_BASE_URL=http://localhost:11434/v1 # Example for local Ollama
LOG_LEVEL=info
```

## Contributing

Contributions, issues, and feature requests are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
