import type { TranslationProvider } from './base';
import { ProviderError } from './base';
import { buildChatMessages, DEFAULT_PROMPT_PROFILE_ID } from '../shared/prompts';
import type { ModelConfig, ModelTestResult, TranslateTextRequest, TranslateTextResponse } from '../shared/types';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProviderError('TIMEOUT', '模型请求超时，请稍后重试。', true);
    }

    throw new ProviderError('NETWORK_ERROR', '无法连接模型服务，请检查网络或 Base URL。', true);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function normalizeHttpError(status: number, payload: ChatCompletionResponse): ProviderError {
  const message = payload.error?.message;

  if (status === 401 || status === 403) {
    return new ProviderError('API_KEY_INVALID', 'API Key 无效或没有访问权限。');
  }

  if (status === 404) {
    return new ProviderError('MODEL_NOT_FOUND', message || '模型或接口路径不存在。');
  }

  if (status === 429) {
    return new ProviderError('RATE_LIMITED', '请求过于频繁，已触发限流。', true);
  }

  if (status >= 500) {
    return new ProviderError('SERVER_ERROR', message || '模型服务暂时不可用。', true);
  }

  return new ProviderError('MODEL_REQUEST_FAILED', message || `模型请求失败，HTTP ${status}。`);
}

export class OpenAICompatibleProvider implements TranslationProvider {
  async translateText(request: TranslateTextRequest, config: ModelConfig): Promise<TranslateTextResponse> {
    if (!config.apiKey.trim()) {
      throw new ProviderError('API_KEY_MISSING', '请先填写 API Key。');
    }

    const promptProfileId = request.promptProfileId ?? DEFAULT_PROMPT_PROFILE_ID;
    const messages = buildChatMessages(promptProfileId, request, request.promptLibrary);

    const response = await fetchWithTimeout(
      buildChatCompletionsUrl(config.baseUrl),
      {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
        }),
      },
      config.timeoutMs,
    );

    const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse;

    if (!response.ok) {
      throw normalizeHttpError(response.status, payload);
    }

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ProviderError('INVALID_RESPONSE', '模型返回内容为空或格式不正确。', true);
    }

    return { text: content };
  }

  async testConnection(config: ModelConfig): Promise<ModelTestResult> {
    const startedAt = Date.now();
    const result = await this.translateText(
      {
        text: 'Hello',
        targetLanguage: 'zh-CN',
        modelId: config.id,
      },
      config,
    );

    return {
      ok: true,
      message: `连接成功：${result.text}`,
      latencyMs: Date.now() - startedAt,
    };
  }
}
