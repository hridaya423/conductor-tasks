import process from 'process';
import { AnthropicClient } from './providers/anthropic.js';
import { OpenAIClient } from './providers/openai.js';
const clientCache = new Map();
export function getLLMClient(providerOverride) {
    const provider = providerOverride ||
        process.env.DEFAULT_LLM_PROVIDER ||
        getAvailableProvider();
    if (clientCache.has(provider)) {
        return clientCache.get(provider);
    }
    let client;
    switch (provider.toLowerCase()) {
        case 'anthropic':
            client = new AnthropicClient();
            break;
        case 'openai':
            client = new OpenAIClient();
            break;
        default:
            client = new AnthropicClient();
            break;
    }
    clientCache.set(provider, client);
    return client;
}
function getAvailableProvider() {
    if (process.env.ANTHROPIC_API_KEY)
        return 'anthropic';
    if (process.env.OPENAI_API_KEY)
        return 'openai';
    console.warn('No LLM provider API key found. Defaulting to Anthropic, but this will fail without an API key.');
    return 'anthropic';
}
//# sourceMappingURL=clientFactory.js.map