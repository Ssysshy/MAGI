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
  const controller = new AbortController();
  const timer = setTimeout((): void => controller.abort(), timeoutMs);

  try {
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

    if (!content) {
      throw new Error('LLM_EMPTY_CONTENT');
    }

    return JSON.parse(content) as T;
  } finally {
    clearTimeout(timer);
  }
};
