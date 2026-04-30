export interface LlmConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

export const requestLlmJson = async <T>(
  config: LlmConfig,
  messages: LlmMessage[],
  timeoutMs: number,
): Promise<T> => {
  // 每次 LLM 请求都有独立 AbortController，避免慢请求长期占用裁决链路。
  const controller = new AbortController();
  const timer = setTimeout((): void => controller.abort(), timeoutMs);

  try {
    // 第一版按 OpenAI chat completions 兼容格式调用，其他 provider 需兼容该协议。
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM_HTTP_${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;

    // 后续编排层会兜底格式错误，这里只负责拿到 JSON 字符串并解析。
    if (!content) {
      throw new Error('LLM_EMPTY_CONTENT');
    }

    return JSON.parse(content) as T;
  } finally {
    clearTimeout(timer);
  }
};
