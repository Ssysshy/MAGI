# Magi 决策控制台第一版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可注册登录、可发起一次 AI 裁决、可按用户保存历史、可按权限配置个人 AI API 的 Magi 决策控制台第一版。

**Architecture:** 使用 monorepo 管理前端、后端和共享类型。前端只负责 Taro 页面、状态展示、动效和表单；后端负责认证、权限、AI API 配置、LLM 编排、并发限流、超时降级和 MySQL 持久化。

**Tech Stack:** Taro、Vite、Less、TypeScript、Fastify、Zod、Prisma、MySQL 8、JWT HttpOnly Cookie、p-limit、Bottleneck、Docker。

---

## 文件结构

```txt
magi-console/
├─ apps/
│  ├─ frontend/
│  │  ├─ config/
│  │  ├─ src/
│  │  │  ├─ app.config.ts
│  │  │  ├─ app.less
│  │  │  ├─ app.ts
│  │  │  ├─ api/
│  │  │  ├─ components/
│  │  │  ├─ pages/
│  │  │  │  ├─ login/
│  │  │  │  ├─ register/
│  │  │  │  ├─ console/
│  │  │  │  ├─ history/
│  │  │  │  └─ ai-provider/
│  │  │  └─ store/
│  │  ├─ Dockerfile
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ backend/
│     ├─ prisma/
│     │  └─ schema.prisma
│     ├─ src/
│     │  ├─ app.ts
│     │  ├─ server.ts
│     │  ├─ config/
│     │  ├─ plugins/
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ user/
│     │  │  ├─ ai-provider/
│     │  │  └─ decision/
│     │  └─ utils/
│     ├─ Dockerfile
│     ├─ package.json
│     └─ tsconfig.json
├─ packages/
│  └─ shared/
│     ├─ src/
│     │  ├─ decision.ts
│     │  ├─ user.ts
│     │  └─ index.ts
│     ├─ package.json
│     └─ tsconfig.json
├─ docker-compose.yml
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

## Task 1: Monorepo 与 Docker 基础

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `docker-compose.yml`
- Create: `apps/frontend/package.json`
- Create: `apps/backend/package.json`
- Create: `packages/shared/package.json`

- [ ] **Step 1: 创建 workspace 配置**

根目录 `package.json`：

```json
{
  "name": "magi-console",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

`pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@magi/shared": ["packages/shared/src/index.ts"]
    }
  }
}
```

- [ ] **Step 2: 创建 Docker 编排**

`docker-compose.yml`：

```yaml
services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: magi_root_password
      MYSQL_DATABASE: magi_console
      MYSQL_USER: magi
      MYSQL_PASSWORD: magi_password
    ports:
      - "3306:3306"
    volumes:
      - magi_mysql_data:/var/lib/mysql

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      DATABASE_URL: mysql://magi:magi_password@mysql:3306/magi_console
      JWT_SECRET: replace_with_32_chars_secret
      API_KEY_ENCRYPTION_SECRET: replace_with_32_chars_key
      SYSTEM_AI_PROVIDER: openai
      SYSTEM_AI_BASE_URL: https://api.openai.com/v1
      SYSTEM_AI_MODEL: gpt-4.1-mini
      SYSTEM_AI_API_KEY: replace_with_system_key
    ports:
      - "3001:3001"
    depends_on:
      - mysql

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    environment:
      VITE_API_BASE_URL: http://localhost:3001
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  magi_mysql_data:
```

- [ ] **Step 3: 验证 workspace**

Run:

```bash
pnpm -r typecheck
```

Expected:

```txt
No projects matched the filters
```

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json docker-compose.yml apps packages
git commit -m "chore: scaffold magi console workspace"
```

## Task 2: 共享类型

**Files:**
- Create: `packages/shared/src/decision.ts`
- Create: `packages/shared/src/user.ts`
- Create: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`

- [ ] **Step 1: 定义用户类型**

`packages/shared/src/user.ts`：

```ts
export type UserRole = 'user' | 'admin';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  canConfigureAiProvider: boolean;
}

export type AiProviderMode = 'system' | 'custom';

export interface UserCapabilities {
  canConfigureAiProvider: boolean;
  aiProviderMode: AiProviderMode;
}
```

- [ ] **Step 2: 定义裁决类型**

`packages/shared/src/decision.ts`：

```ts
export type QuestionType = 'boolean' | 'multiple_choice' | 'priority' | 'strategy' | 'diagnosis';

export type FinalStatus = 'approved' | 'rejected' | 'deferred' | 'refused';

export type BrainType = 'melchior' | 'balthasar' | 'casper';

export type BrainStance = 'approve' | 'reject' | 'defer' | 'uncertain';

export interface DecisionVariable {
  name: string;
  value: string;
  isMissing: boolean;
  isCritical: boolean;
}

export interface BrainAnalysis {
  brainType: BrainType;
  stance: BrainStance;
  reason: string;
  focusPoints: string[];
  uncertainties: string[];
  unavailable?: boolean;
}

export interface DecisionSummary {
  rule: string;
  majorityOpinion: string;
  minorityOpinion: string;
  missingInformation: string[];
  finalDecision: string;
}

export interface DecisionSession {
  id: string;
  userId: string;
  question: string;
  questionType: QuestionType;
  finalStatus: FinalStatus;
  summary: string;
  confidence: number;
  variables: DecisionVariable[];
  analyses: BrainAnalysis[];
  decisionSummary: DecisionSummary;
  createdAt: string;
}
```

- [ ] **Step 3: 导出类型**

`packages/shared/src/index.ts`：

```ts
export * from './decision';
export * from './user';
```

- [ ] **Step 4: 验证**

Run:

```bash
pnpm --filter @magi/shared typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 5: 提交**

```bash
git add packages/shared
git commit -m "feat: add shared magi types"
```

## Task 3: 后端基础、Prisma 与 MySQL

**Files:**
- Create: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/src/config/env.ts`
- Create: `apps/backend/src/plugins/prisma.ts`
- Create: `apps/backend/src/plugins/auth.ts`
- Create: `apps/backend/src/app.ts`
- Create: `apps/backend/src/server.ts`
- Create: `apps/backend/Dockerfile`

- [ ] **Step 1: 定义 Prisma schema**

`apps/backend/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id                       String             @id @default(cuid())
  email                    String             @unique
  passwordHash             String
  role                     String             @default("user")
  canConfigureAiProvider   Boolean            @default(false)
  createdAt                DateTime           @default(now())
  updatedAt                DateTime           @updatedAt
  aiProviderConfig         AiProviderConfig?
  decisionSessions         DecisionSession[]
}

model AiProviderConfig {
  id              String   @id @default(cuid())
  userId          String   @unique
  provider        String
  baseUrl         String
  model           String
  apiKeyEncrypted String   @db.Text
  enabled         Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DecisionSession {
  id              String   @id @default(cuid())
  userId          String
  question        String   @db.Text
  questionType    String
  finalStatus     String
  summary         String   @db.Text
  confidence      Float
  variablesJson   Json
  analysesJson    Json
  summaryJson     Json
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

- [ ] **Step 2: 定义环境变量校验**

`apps/backend/src/config/env.ts`：

```ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  API_KEY_ENCRYPTION_SECRET: z.string().min(32),
  SYSTEM_AI_PROVIDER: z.string().min(1),
  SYSTEM_AI_BASE_URL: z.string().url(),
  SYSTEM_AI_MODEL: z.string().min(1),
  SYSTEM_AI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3001),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 3: 注册 Fastify 基础插件**

`apps/backend/src/app.ts`：

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  await app.register(cookie, { secret: env.JWT_SECRET });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({ ok: true }));

  return app;
};
```

- [ ] **Step 4: 创建启动入口**

`apps/backend/src/server.ts`：

```ts
import { buildApp } from './app';
import { env } from './config/env';

const start = async (): Promise<void> => {
  const app = await buildApp();
  await app.listen({ host: '0.0.0.0', port: env.PORT });
};

void start();
```

- [ ] **Step 5: 验证**

Run:

```bash
pnpm --filter @magi/backend prisma validate
pnpm --filter @magi/backend typecheck
```

Expected:

```txt
The schema at prisma/schema.prisma is valid
```

- [ ] **Step 6: 提交**

```bash
git add apps/backend
git commit -m "feat: add backend foundation"
```

## Task 4: 注册登录与当前用户

**Files:**
- Create: `apps/backend/src/modules/auth/auth.schema.ts`
- Create: `apps/backend/src/modules/auth/auth.service.ts`
- Create: `apps/backend/src/modules/auth/auth.routes.ts`
- Create: `apps/backend/src/modules/user/user.routes.ts`
- Modify: `apps/backend/src/app.ts`

- [ ] **Step 1: 定义 auth schema**

`apps/backend/src/modules/auth/auth.schema.ts`：

```ts
import { z } from 'zod';

export const authInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type AuthInput = z.infer<typeof authInputSchema>;
```

- [ ] **Step 2: 实现注册登录**

`apps/backend/src/modules/auth/auth.service.ts`：

```ts
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AuthInput } from './auth.schema';
import type { PrismaClient } from '@prisma/client';

export interface AuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    canConfigureAiProvider: boolean;
  };
}

export const createAuthService = (prisma: PrismaClient) => {
  const createToken = (userId: string): string => jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    async register(input: AuthInput): Promise<AuthSession> {
      const passwordHash = await argon2.hash(input.password);
      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
        },
      });

      return {
        token: createToken(user.id),
        user,
      };
    },

    async login(input: AuthInput): Promise<AuthSession> {
      const user = await prisma.user.findUnique({ where: { email: input.email } });

      if (!user) {
        throw new Error('INVALID_CREDENTIALS');
      }

      const isValid = await argon2.verify(user.passwordHash, input.password);

      if (!isValid) {
        throw new Error('INVALID_CREDENTIALS');
      }

      return {
        token: createToken(user.id),
        user,
      };
    },
  };
};
```

- [ ] **Step 3: 实现路由**

`apps/backend/src/modules/auth/auth.routes.ts`：

```ts
import type { FastifyInstance } from 'fastify';
import { authInputSchema } from './auth.schema';
import { createAuthService } from './auth.service';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  const service = createAuthService(app.prisma);

  app.post('/api/auth/register', async (request, reply) => {
    const input = authInputSchema.parse(request.body);
    const session = await service.register(input);
    reply.setCookie('magi_session', session.token, cookieOptions);
    return session.user;
  });

  app.post('/api/auth/login', async (request, reply) => {
    const input = authInputSchema.parse(request.body);
    const session = await service.login(input);
    reply.setCookie('magi_session', session.token, cookieOptions);
    return session.user;
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('magi_session', { path: '/' });
    return { ok: true };
  });
};
```

- [ ] **Step 4: 验证**

Run:

```bash
pnpm --filter @magi/backend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 5: 提交**

```bash
git add apps/backend/src/modules/auth apps/backend/src/modules/user apps/backend/src/app.ts
git commit -m "feat: add auth routes"
```

## Task 5: AI API 配置权限

**Files:**
- Create: `apps/backend/src/utils/crypto.ts`
- Create: `apps/backend/src/modules/ai-provider/ai-provider.schema.ts`
- Create: `apps/backend/src/modules/ai-provider/ai-provider.service.ts`
- Create: `apps/backend/src/modules/ai-provider/ai-provider.routes.ts`
- Modify: `apps/backend/src/app.ts`

- [ ] **Step 1: 实现加密工具**

`apps/backend/src/utils/crypto.ts`：

```ts
import crypto from 'node:crypto';
import { env } from '../config/env';

const algorithm = 'aes-256-gcm';
const key = crypto.createHash('sha256').update(env.API_KEY_ENCRYPTION_SECRET).digest();

export const encryptText = (value: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptText = (value: string): string => {
  const [ivHex, authTagHex, encryptedHex] = value.split(':');
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};
```

- [ ] **Step 2: 实现配置服务**

`apps/backend/src/modules/ai-provider/ai-provider.service.ts`：

```ts
import type { PrismaClient } from '@prisma/client';
import { decryptText, encryptText } from '../../utils/crypto';

export interface SaveAiProviderConfigInput {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
}

export const createAiProviderService = (prisma: PrismaClient) => ({
  async save(userId: string, input: SaveAiProviderConfigInput) {
    return prisma.aiProviderConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        apiKeyEncrypted: encryptText(input.apiKey),
        enabled: input.enabled,
      },
      update: {
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        apiKeyEncrypted: encryptText(input.apiKey),
        enabled: input.enabled,
      },
    });
  },

  async getMasked(userId: string) {
    const config = await prisma.aiProviderConfig.findUnique({ where: { userId } });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: config.enabled,
      apiKeyMasked: '********',
    };
  },

  async getUsableConfig(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { aiProviderConfig: true },
    });

    if (user?.canConfigureAiProvider && user.aiProviderConfig?.enabled) {
      return {
        provider: user.aiProviderConfig.provider,
        baseUrl: user.aiProviderConfig.baseUrl,
        model: user.aiProviderConfig.model,
        apiKey: decryptText(user.aiProviderConfig.apiKeyEncrypted),
      };
    }

    return null;
  },
});
```

- [ ] **Step 3: 验证**

Run:

```bash
pnpm --filter @magi/backend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 4: 提交**

```bash
git add apps/backend/src/modules/ai-provider apps/backend/src/utils/crypto.ts
git commit -m "feat: add ai provider permissions"
```

## Task 6: LLM 裁决编排

**Files:**
- Create: `apps/backend/src/modules/decision/decision.schema.ts`
- Create: `apps/backend/src/modules/decision/llm-client.ts`
- Create: `apps/backend/src/modules/decision/decision-orchestrator.ts`
- Create: `apps/backend/src/modules/decision/decision.service.ts`
- Create: `apps/backend/src/modules/decision/decision.routes.ts`
- Modify: `apps/backend/src/app.ts`

- [ ] **Step 1: 定义裁决输入**

`apps/backend/src/modules/decision/decision.schema.ts`：

```ts
import { z } from 'zod';

export const createDecisionSessionSchema = z.object({
  question: z.string().trim().min(2).max(2000),
});

export type CreateDecisionSessionInput = z.infer<typeof createDecisionSessionSchema>;
```

- [ ] **Step 2: 实现 LLM 客户端**

`apps/backend/src/modules/decision/llm-client.ts`：

```ts
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
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
```

- [ ] **Step 3: 实现降级输出**

`apps/backend/src/modules/decision/decision-orchestrator.ts`：

```ts
import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import type { BrainAnalysis, DecisionSession } from '@magi/shared';
import { requestLlmJson, type LlmConfig } from './llm-client';

const decisionLimit = pLimit(5);
const llmLimiter = new Bottleneck({
  minTime: 500,
  maxConcurrent: 3,
});

export interface OrchestrateDecisionInput {
  userId: string;
  question: string;
  config: LlmConfig;
}

export const createRefusedDecision = (
  userId: string,
  question: string,
  reason: string,
): Omit<DecisionSession, 'id' | 'createdAt'> => ({
  userId,
  question,
  questionType: 'strategy',
  finalStatus: 'refused',
  summary: reason,
  confidence: 0,
  variables: [],
  analyses: [
    {
      brainType: 'melchior',
      stance: 'uncertain',
      reason,
      focusPoints: [],
      uncertainties: [reason],
      unavailable: true,
    },
    {
      brainType: 'balthasar',
      stance: 'uncertain',
      reason,
      focusPoints: [],
      uncertainties: [reason],
      unavailable: true,
    },
    {
      brainType: 'casper',
      stance: 'uncertain',
      reason,
      focusPoints: [],
      uncertainties: [reason],
      unavailable: true,
    },
  ],
  decisionSummary: {
    rule: '关键变量缺失或系统不可用',
    majorityOpinion: '无法形成多数意见',
    minorityOpinion: '无',
    missingInformation: [reason],
    finalDecision: reason,
  },
});

export const orchestrateDecision = async (
  input: OrchestrateDecisionInput,
): Promise<Omit<DecisionSession, 'id' | 'createdAt'>> => decisionLimit(async () => {
  try {
    return await llmLimiter.schedule(() => requestLlmJson<Omit<DecisionSession, 'id' | 'createdAt'>>(
      input.config,
      [
        {
          role: 'system',
          content: '你是 Magi Core。必须返回严格 JSON，包含 questionType、finalStatus、summary、confidence、variables、analyses、decisionSummary。',
        },
        {
          role: 'user',
          content: input.question,
        },
      ],
      25000,
    ));
  } catch {
    return createRefusedDecision(input.userId, input.question, 'LLM 调用失败，系统拒绝裁决。');
  }
});
```

- [ ] **Step 4: 验证**

Run:

```bash
pnpm --filter @magi/backend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 5: 提交**

```bash
git add apps/backend/src/modules/decision
git commit -m "feat: add decision orchestration"
```

## Task 7: 前端基础与接口层

**Files:**
- Create: `apps/frontend/src/app.ts`
- Create: `apps/frontend/src/app.config.ts`
- Create: `apps/frontend/src/app.less`
- Create: `apps/frontend/src/api/http.ts`
- Create: `apps/frontend/src/api/auth.ts`
- Create: `apps/frontend/src/api/decision.ts`
- Create: `apps/frontend/src/api/ai-provider.ts`
- Create: `apps/frontend/src/store/session.ts`

- [ ] **Step 1: 创建 HTTP 客户端**

`apps/frontend/src/api/http.ts`：

```ts
import Taro from '@tarojs/taro';

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const requestJson = async <T>(url: string, options: Taro.request.Option = {}): Promise<T> => {
  const response = await Taro.request<T>({
    ...options,
    url: `${apiBaseUrl}${url}`,
    credentials: 'include',
    header: {
      'Content-Type': 'application/json',
      ...options.header,
    },
  });

  if (response.statusCode >= 400) {
    throw new Error(`HTTP_${response.statusCode}`);
  }

  return response.data;
};
```

- [ ] **Step 2: 创建 API 模块**

`apps/frontend/src/api/decision.ts`：

```ts
import type { DecisionSession } from '@magi/shared';
import { requestJson } from './http';

export const createDecisionSession = (question: string): Promise<DecisionSession> => requestJson('/api/decision-sessions', {
  method: 'POST',
  data: { question },
});

export const listDecisionSessions = (): Promise<DecisionSession[]> => requestJson('/api/decision-sessions');
```

- [ ] **Step 3: 验证**

Run:

```bash
pnpm --filter @magi/frontend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 4: 提交**

```bash
git add apps/frontend/src/api apps/frontend/src/store apps/frontend/src/app.ts apps/frontend/src/app.config.ts apps/frontend/src/app.less
git commit -m "feat: add frontend foundation"
```

## Task 8: 登录、注册与权限入口

**Files:**
- Create: `apps/frontend/src/pages/login/index.tsx`
- Create: `apps/frontend/src/pages/login/index.less`
- Create: `apps/frontend/src/pages/register/index.tsx`
- Create: `apps/frontend/src/pages/register/index.less`
- Create: `apps/frontend/src/components/AiConfigFloatButton.tsx`
- Create: `apps/frontend/src/components/AiConfigFloatButton.less`

- [ ] **Step 1: 实现登录页**

登录页只包含邮箱、密码、登录按钮和注册入口。登录成功后跳转 `/pages/console/index`。

- [ ] **Step 2: 实现注册页**

注册页只包含邮箱、密码、注册按钮和登录入口。注册成功后跳转 `/pages/console/index`。

- [ ] **Step 3: 实现 AI 配置浮球**

浮球固定在右下角，仅当 `canConfigureAiProvider === true` 时渲染。点击跳转 `/pages/ai-provider/index`。

- [ ] **Step 4: 验证**

Run:

```bash
pnpm --filter @magi/frontend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 5: 提交**

```bash
git add apps/frontend/src/pages/login apps/frontend/src/pages/register apps/frontend/src/components
git commit -m "feat: add auth pages"
```

## Task 9: Magi 主控台视觉界面

**Files:**
- Create: `apps/frontend/src/pages/console/index.tsx`
- Create: `apps/frontend/src/pages/console/index.less`
- Create: `apps/frontend/src/components/MagiBrainGraph.tsx`
- Create: `apps/frontend/src/components/MagiBrainGraph.less`
- Create: `apps/frontend/src/components/DecisionInputPanel.tsx`
- Create: `apps/frontend/src/components/DecisionSummaryPanel.tsx`
- Create: `apps/frontend/src/components/BrainAnalysisPanel.tsx`

- [ ] **Step 1: 实现主控台页面结构**

页面顺序固定：

```txt
顶部主控栏
三脑区
问题输入区
RESOLUTION ANALYSIS
裁决总览区
三脑详细分析区
```

- [ ] **Step 2: 实现三脑区**

布局规则：

```txt
Balthasar：中上
Casper：左下
Melchior：右下
Magi Core：中央
```

颜色规则：

```txt
背景：#030303
边框橙：#d87932
通过绿：#3aae53
否决红：#cf2637
文本橙：#e38b45
弱文本：#8d5a42
```

- [ ] **Step 3: 实现裁决提交**

点击提交后：

```txt
1. 状态改为 QUESTION ACCEPTED
2. 三脑区进入 ANALYZING
3. 调用 POST /api/decision-sessions
4. 返回后状态改为 RESOLUTION READY
5. 渲染总览和三脑详情
```

- [ ] **Step 4: 验证**

Run:

```bash
pnpm --filter @magi/frontend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 5: 浏览器检查**

Run:

```bash
pnpm --filter @magi/frontend dev
```

Expected:

```txt
Local:
```

检查：

```txt
页面首屏能看到 MAGI 主控台
三脑区与参考图结构一致
页面不是聊天气泡风格
移动端文字不溢出
右下角浮球只在授权用户显示
```

- [ ] **Step 6: 提交**

```bash
git add apps/frontend/src/pages/console apps/frontend/src/components
git commit -m "feat: add magi console interface"
```

## Task 10: 历史记录与 AI API 配置页

**Files:**
- Create: `apps/frontend/src/pages/history/index.tsx`
- Create: `apps/frontend/src/pages/history/index.less`
- Create: `apps/frontend/src/pages/ai-provider/index.tsx`
- Create: `apps/frontend/src/pages/ai-provider/index.less`

- [ ] **Step 1: 实现历史记录页**

历史记录页展示当前用户自己的裁决记录。点击记录后回到主控台并展示该次裁决。

- [ ] **Step 2: 实现 AI API 配置页**

配置页字段：

```txt
provider
baseUrl
model
apiKey
enabled
```

保存时调用 `PUT /api/ai-provider-config`。未授权用户访问时展示 `403` 状态并返回主控台。

- [ ] **Step 3: 验证**

Run:

```bash
pnpm --filter @magi/frontend typecheck
```

Expected:

```txt
Done
```

- [ ] **Step 4: 提交**

```bash
git add apps/frontend/src/pages/history apps/frontend/src/pages/ai-provider
git commit -m "feat: add history and ai provider pages"
```

## Task 11: 联调与容器验证

**Files:**
- Modify: `apps/backend/Dockerfile`
- Modify: `apps/frontend/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: 后端 Dockerfile**

`apps/backend/Dockerfile`：

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @magi/shared build
RUN pnpm --filter @magi/backend build
EXPOSE 3001
CMD ["pnpm", "--filter", "@magi/backend", "start"]
```

- [ ] **Step 2: 前端 Dockerfile**

`apps/frontend/Dockerfile`：

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@magi/frontend", "dev", "--host", "0.0.0.0"]
```

- [ ] **Step 3: 启动容器**

Run:

```bash
docker compose up --build
```

Expected:

```txt
backend-1   | Server listening
frontend-1  | Local:
mysql-1     | ready for connections
```

- [ ] **Step 4: 接口 smoke 验证**

Run:

```bash
curl http://localhost:3001/health
```

Expected:

```json
{"ok":true}
```

- [ ] **Step 5: 产品链路验证**

检查：

```txt
注册成功
登录成功
普通用户无 AI 配置浮球
授权用户有 AI 配置浮球
普通用户发起裁决使用系统 AI API
授权用户启用个人配置后使用个人 AI API
裁决完成后写入历史记录
历史记录只展示当前用户数据
LLM 超时返回拒绝裁决
```

- [ ] **Step 6: 最终验证**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Expected:

```txt
Done
```

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "chore: verify dockerized magi console"
```

## 自检结果

- 设计稿中的用户注册、登录、权限、个人 AI API、系统 AI API、裁决、历史记录、Docker、MySQL、并发、限流、超时、降级均已覆盖。
- 第一版未引入团队协作、Agent 自定义、权重配置、知识库、联网检索、流程编排、通用聊天。
- 计划未要求新增测试代码；验证采用类型检查、lint、build、接口 smoke、浏览器产品链路检查。
