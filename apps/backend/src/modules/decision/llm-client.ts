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

interface LlmRequestLogContext {
  brainType: 'context' | 'melchior' | 'balthasar' | 'casper' | 'core' | 'unknown';
  attempt: number;
  durationMs: number;
  timeoutMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  model: string;
  baseUrlHost: string;
  responseFormatType: string | null;
  contentPreview: string | null;
  contentLength: number | null;
}

interface RequestLlmJsonOptions {
  attempts?: number;
  retryDelayBaseMs?: number;
  onAttemptDone?: (context: LlmRequestLogContext) => void;
  brainType?: LlmRequestLogContext['brainType'];
}

const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;
const JSON_FENCE_RE = /```json\s*([\s\S]*?)\s*```/i;
const CONTENT_PREVIEW_LIMIT = 200;

const toContentPreview = (content: string): string => {
  const previewSource = content.replace(THINK_BLOCK_RE, '').trim() || content;
  const normalized = previewSource.replace(/\s+/g, ' ').trim();

  if (normalized.length <= CONTENT_PREVIEW_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, CONTENT_PREVIEW_LIMIT)}...`;
};

const parseJsonCandidate = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const repairJsonCandidate = (raw: string): string => raw
  // 常见模型错误：尾逗号导致 JSON.parse 失败。
  .replace(/,\s*([}\]])/g, '$1')
  // 常见模型错误：中文标点混入 JSON。
  .replace(/，/g, ',')
  .replace(/：/g, ':');

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
  const fenced = withoutThink.match(JSON_FENCE_RE)?.[1]?.trim() ?? '';
  const inlineJson = extractFirstJsonObject(withoutThink) ?? '';
  const candidates = [withoutThink, fenced, inlineJson].filter(Boolean);

  for (const candidate of candidates) {
    const directParsed = parseJsonCandidate<T>(candidate);

    if (directParsed !== null) {
      return directParsed;
    }

    const repairedParsed = parseJsonCandidate<T>(repairJsonCandidate(candidate));

    if (repairedParsed !== null) {
      return repairedParsed;
    }
  }

  throw new Error('LLM_JSON_PARSE_FAILED');
};

export const requestLlmJson = async <T>(
  config: LlmConfig,
  messages: LlmMessage[],
  timeoutMs: number,
  options?: RequestLlmJsonOptions,
): Promise<T> => {
  const maxAttempts = Math.max(1, options?.attempts ?? 2);
  const retryDelayBaseMs = Math.max(0, options?.retryDelayBaseMs ?? 300);
  const responseFormatType = 'json_object';
  const baseUrlHost = (() => {
    try {
      return new URL(config.baseUrl).host;
    } catch {
      return 'invalid-url';
    }
  })();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout((): void => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let errorCode: string | null = null;

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
          temperature: attempt === 0 ? 0.2 : 0,
          response_format: { type: responseFormatType },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        httpStatus = response.status;
        throw new Error(`LLM_HTTP_${response.status}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        errorCode = 'LLM_EMPTY_CONTENT';
        throw new Error('LLM_EMPTY_CONTENT');
      }

      try {
        const parsed = parseModelJson<T>(content);

        options?.onAttemptDone?.({
          brainType: options?.brainType ?? 'unknown',
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          timeoutMs,
          httpStatus,
          errorCode: null,
          model: config.model,
          baseUrlHost,
          responseFormatType,
          contentPreview: toContentPreview(content),
          contentLength: content.length,
        });

        return parsed;
      } catch (error) {
        if (error instanceof Error) {
          errorCode = error.message;
        }

        if (!(error instanceof Error) || error.message !== 'LLM_JSON_PARSE_FAILED' || attempt === maxAttempts - 1) {
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof Error && errorCode === null) {
        errorCode = error.name === 'AbortError' ? 'ABORT_TIMEOUT' : error.message;
      }

      options?.onAttemptDone?.({
        brainType: options?.brainType ?? 'unknown',
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        timeoutMs,
        httpStatus,
        errorCode,
        model: config.model,
        baseUrlHost,
        responseFormatType,
        contentPreview: null,
        contentLength: null,
      });

      if (attempt === maxAttempts - 1) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 120);
      const delayMs = retryDelayBaseMs + jitterMs;
      await new Promise<void>((resolve): void => {
        setTimeout((): void => resolve(), delayMs);
      });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('LLM_JSON_PARSE_FAILED');
};
