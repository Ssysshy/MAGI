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

const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;
const JSON_FENCE_RE = /```json\s*([\s\S]*?)\s*```/i;

const extractFirstJsonObject = (value: string): string | null => {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) {
        continue;
      }

      depth -= 1;

      if (depth === 0 && start >= 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
};

const parseModelJson = <T>(rawContent: string): T => {
  const withoutThink = rawContent.replace(THINK_BLOCK_RE, '').trim();

  try {
    return JSON.parse(withoutThink) as T;
  } catch {
    const fenced = withoutThink.match(JSON_FENCE_RE)?.[1]?.trim();

    if (fenced) {
      return JSON.parse(fenced) as T;
    }

    const inlineJson = extractFirstJsonObject(withoutThink);

    if (inlineJson) {
      return JSON.parse(inlineJson) as T;
    }

    throw new Error('LLM_JSON_PARSE_FAILED');
  }
};

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

    return parseModelJson<T>(content);
  } finally {
    clearTimeout(timer);
  }
};
