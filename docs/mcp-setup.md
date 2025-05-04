# MCP Configuration Guide

This document explains how to configure the Conductor application using Model Control Protocol (MCP) environment variables. This approach allows you to configure the application directly from your editor's MCP settings without needing a separate `.env` file.

**Note:** While MCP is recommended for integrated environments like Cursor, Conductor can also be configured using a standard `.env` file in your project root or by setting OS environment variables directly when running via the CLI. See the main `README.md` for more details on these alternative methods.

## MCP Configuration Example

Add the following configuration to your editor's MCP settings:

```json
{
  "mcpServers": {
    "conductor": {
      "command": "node",
      "args": ["./build/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY_HERE",
        "MIXTRAL_API_KEY": "YOUR_MIXTRAL_API_KEY_HERE",
        "GROQ_API_KEY": "YOUR_GROQ_API_KEY_HERE",
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_API_KEY_HERE",
        
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

You need to provide at least one API key to use Conductor:

| Environment Variable | Description |
|----------------------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | OpenAI API key for GPT models |
| `MIXTRAL_API_KEY` | Mistral AI API key for Mixtral models |
| `GROQ_API_KEY` | Groq API key for serving various models |
| `GEMINI_API_KEY` | Google API key for Gemini models |
| `XAI_API_KEY` | xAI API key for Grok models |

### Model Selection

You can specify which model to use for each provider:

| Environment Variable | Description | Default Value |
|----------------------|-------------|--------------|
| `MODEL` | Global default model to use if no provider-specific model is set | Provider-dependent |
| `ANTHROPIC_MODEL` | Model to use with Anthropic | `claude-3-opus-20240229` |
| `OPENAI_MODEL` | Model to use with OpenAI | `gpt-4o` |
| `MIXTRAL_MODEL` | Model to use with Mistral AI | `mixtral-8x7b` |
| `GROQ_MODEL` | Model to use with Groq | `llama3-8b-8192` |
| `GEMINI_MODEL` | Model to use with Google | `gemini-1.5-pro` |
| `XAI_MODEL` | Model to use with xAI | `xai-1` |

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

## Provider Preference Order

When multiple API keys are provided, the system uses the following preference order:

1. Anthropic (Claude)
2. OpenAI
3. Groq
4. Google Gemini
5. Mistral AI
6. xAI

You can override this by setting `DEFAULT_LLM_PROVIDER` to your preferred provider. 