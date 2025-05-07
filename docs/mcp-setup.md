# MCP Configuration Guide

This document explains how to configure the Conductor Tasks application using Model Control Protocol (MCP) environment variables. This approach allows you to configure the application directly from your editor's MCP settings without needing a separate `.env` file.

**Note:** While MCP is recommended for integrated environments like Cursor, Conductor Tasks can also be configured using a standard `.env` file in your project root or by setting OS environment variables directly when running via the CLI. See the main `README.md` for more details on these alternative methods.

## MCP Configuration Example

Add the following configuration to your editor's MCP settings:

```json
{
  "mcpServers": {
    "conductor-tasks": {
      "command": "npx",
      "args": [
        "-y",
        "conductor-tasks",
        "--serve-mcp"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_API_KEY_HERE",
        "GROQ_API_KEY": "YOUR_GROQ_API_KEY_HERE",
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OLLAMA_ENABLED": "true",
        
        "DEFAULT_LLM_PROVIDER": "anthropic",
        
        "MODEL": "claude-3-opus-20240229",
        "TEMPERATURE": "0.7",
        "MAX_TOKENS": "4000",
        "TOP_P": "0.9",
        "FREQUENCY_PENALTY": "0.0",
        "PRESENCE_PENALTY": "0.0",
        
        "DEFAULT_SUBTASKS": "3",
        "DEFAULT_PRIORITY": "medium"
      }
    }
  }
}
```

## Available Configuration Options

### LLM API Keys

You need to provide at least one API key to use Conductor Tasks. The system supports the following LLM providers:

| Environment Variable | Description | Default Model |
|----------------------|-------------|--------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | `claude-3-opus-20240229` |
| `OPENAI_API_KEY` | OpenAI API key for GPT models | `gpt-4o` |
| `MISTRAL_API_KEY` | Mistral AI API key for Mistral models | `mistral-large-latest` |
| `GROQ_API_KEY` | Groq API key for serving various models | `llama3-8b-8192` |
| `GEMINI_API_KEY` | Google API key for Gemini models | `gemini-1.5-pro` |
| `XAI_API_KEY` | xAI API key for Grok models | `grok-1` |
| `PERPLEXITY_API_KEY` | Perplexity API key | `llama-3-sonar-medium-32k-online` |
| `OLLAMA_ENABLED` | Set to "true" to enable Ollama local models | `llama3` |

### Provider-Specific Configuration

Each provider has additional configuration options:

#### Anthropic (Claude)
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-opus-20240229 # or claude-3-sonnet-20240229, claude-3-haiku-20240307
ANTHROPIC_API_BASE_URL=https://api.anthropic.com # only needed if using a custom API base URL
```

#### OpenAI (GPT)
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o # or gpt-4-turbo, gpt-3.5-turbo
OPENAI_API_BASE_URL=https://api.openai.com/v1 # only needed if using a custom API base URL
```

#### Mistral AI
```
MISTRAL_API_KEY=...
MISTRAL_MODEL=mistral-large-latest # or mistral-medium, mistral-small, mixtral-8x7b
MISTRAL_API_BASE_URL=https://api.mistral.ai # only needed if using a custom API base URL
```

#### Groq
```
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama3-8b-8192 # or llama3-70b-8192, gemma-7b-it
```

#### Google (Gemini)
```
GEMINI_API_KEY=... # Google AI Studio API key
GEMINI_MODEL=gemini-1.5-pro # or gemini-1.5-flash, gemini-1.0-pro
```

#### xAI (Grok)
```
XAI_API_KEY=...
XAI_MODEL=grok-1
```

#### Perplexity
```
PERPLEXITY_API_KEY=...
PERPLEXITY_MODEL=llama-3-sonar-medium-32k-online 
PERPLEXITY_API_BASE_URL=https://api.perplexity.ai
```

#### Ollama (Local Models)
```
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3 # or any model you have installed in Ollama
OLLAMA_BASE_URL=http://localhost:11434
```

### Model Selection

You can specify which model to use globally or for each provider:

| Environment Variable | Description | Default Value |
|----------------------|-------------|--------------|
| `MODEL` | Global default model to use if no provider-specific model is set | Provider-dependent |
| `ANTHROPIC_MODEL` | Model to use with Anthropic | `claude-3-opus-20240229` |
| `OPENAI_MODEL` | Model to use with OpenAI | `gpt-4o` |
| `MISTRAL_MODEL` | Model to use with Mistral AI | `mistral-large-latest` |
| `GROQ_MODEL` | Model to use with Groq | `llama3-8b-8192` |
| `GEMINI_MODEL` | Model to use with Google | `gemini-1.5-pro` |
| `XAI_MODEL` | Model to use with xAI | `grok-1` |
| `PERPLEXITY_MODEL` | Model to use with Perplexity | `llama-3-sonar-medium-32k-online` |
| `OLLAMA_MODEL` | Model to use with Ollama | `llama3` |

### Generation Parameters

You can customize the following parameters for text generation:

| Environment Variable | Description | Default Value |
|----------------------|-------------|--------------|
| `TEMPERATURE` | Controls randomness (0-1) | `0.7` |
| `MAX_TOKENS` | Maximum tokens to generate | `4000` |
| `TOP_P` | Nucleus sampling parameter | *Provider default* |
| `FREQUENCY_PENALTY` | Penalty for token frequency | *Provider default* |
| `PRESENCE_PENALTY` | Penalty for token presence | *Provider default* |

### Task Management Configuration

You can customize task management behavior with these options:

| Environment Variable | Description | Default Value |
|----------------------|-------------|--------------|
| `DEFAULT_SUBTASKS` | Number of subtasks to generate for each task | `3` |
| `DEFAULT_PRIORITY` | Default priority for new tasks | `medium` |
| `CONDUCTOR_TASKS_FILE` | Custom path for the TASKS.md file | `TASKS.md` in workspace root |
| `WORKSPACE_DIR` | Custom workspace directory path | Auto-detected |

## Provider Preference Order

When multiple API keys are provided and no specific provider is selected, the system uses the following preference order:

1. Anthropic (Claude)
2. OpenAI (GPT)
3. Groq
4. Google Gemini
5. Mistral AI
6. xAI (Grok)
7. Perplexity
8. Ollama (Local)

You can override this by setting `DEFAULT_LLM_PROVIDER` to your preferred provider name:
```
DEFAULT_LLM_PROVIDER=openai
```

Valid provider names: `anthropic`, `openai`, `groq`, `gemini`, `mistral`, `xai`, `perplexity`, or `ollama`.

## Advanced Features

### Retry Mechanisms

All LLM providers include built-in retry logic for handling transient errors:
- Automatically retries on network errors and rate limits
- Uses exponential backoff to avoid overwhelming APIs
- Provides detailed error reporting in logs

### Provider Fallback

If a primary provider fails, the system can fall back to other configured providers:
- Attempts the request with each available provider in the preference order
- Only happens on non-recoverable errors (not rate limits)
- Can be disabled by setting `DISABLE_PROVIDER_FALLBACK=true` 