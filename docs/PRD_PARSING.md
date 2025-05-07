# PRD Parsing Guide

This guide explains how to use the PRD (Product Requirements Document) parsing functionality in the Conductor Tasks system.

## What is PRD Parsing?

PRD parsing is a feature that allows you to automatically extract tasks from a Product Requirements Document. The system uses AI to analyze the document and create structured tasks with appropriate properties like title, description, priority, complexity, and dependencies.

## Command Usage

You can parse a PRD using the following commands:

```sh
# Parse a PRD file
conductor-tasks parse-prd-file <path-to-prd-file> [options]

# Or parse PRD content directly
conductor-tasks parse-prd --prdContent "Your PRD content here" [options]
```

### Options

- `--createTasksFile`: Generate/update a TASKS.md file with the extracted tasks (default: true)
- `--verbose`: Show detailed output of the extracted tasks (default: false)

## Example

```sh
conductor-tasks parse-prd-file ./docs/product_requirements.md --createTasksFile
```

This command will:
1. Read the PRD file at `./docs/product_requirements.md`
2. Use AI to extract tasks from the document
3. Create tasks in the task manager
4. Generate a TASKS.md file with the extracted tasks

## PRD Format Recommendations

While the parser can handle various PRD formats, the following structure tends to yield the best results:

```
# Product Requirements: [Project Name]

## Overview
[Brief description of the project]

## Goals
- [Goal 1]
- [Goal 2]
...

## Features
### Feature 1: [Feature Name]
[Description of feature 1]

#### Requirements
- [Requirement 1.1]
- [Requirement 1.2]
...

### Feature 2: [Feature Name]
[Description of feature 2]

#### Requirements
- [Requirement 2.1]
- [Requirement 2.2]
...

## Technical Constraints
- [Constraint 1]
- [Constraint 2]
...

## Timeline
- [Milestone 1]: [Date]
- [Milestone 2]: [Date]
...
```

## Handling Dependencies

The PRD parser will attempt to identify dependencies between tasks. For example, if the PRD states that Feature B depends on Feature A, the parser will create appropriate task dependencies.

## Customizing the Output

If you want to customize how tasks are extracted, you can modify the prompt template in `src/task/prdParser.ts`.

## After Parsing

Once you've parsed your PRD and generated tasks, you can:

1. List all tasks: `conductor-tasks list`
2. Visualize tasks: `conductor-tasks kanban`
3. Get the next task to work on: `conductor-tasks next`
4. Edit task details: `conductor-tasks update <task-id> ...`

## Retry Mechanism

The PRD parser includes a built-in retry mechanism that helps handle parsing failures:

- If the parsing fails due to formatting issues, the system will automatically retry
- Each retry uses a more explicit prompt with clearer instructions
- The system uses exponential backoff between retries to avoid rate limiting
- You can see verbose logging of retry attempts with the `--verbose` flag 