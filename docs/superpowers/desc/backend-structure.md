# Magi 后端项目结构

## 项目概述

Magi 是一个 AI 裁决系统，用户提交自然语言问题后，系统交由三个决策单元分析，最终输出裁决（通过/否决/延后/拒绝裁决）。

## 目录结构

```
apps/backend/src/
├── server.ts          # 入口文件
├── app.ts             # Fastify 应用构建
├── config/
│   └── env.ts         # 环境变量定义与校验
├── plugins/
│   ├── prisma.ts      # 数据库连接插件
│   └── auth.ts        # JWT 认证插件
├── modules/
│   ├── auth/          # 认证模块
│   │   ├── auth.routes.ts
│   │   ├── auth.schema.ts
│   │   └── auth.service.ts
│   ├── user/          # 用户模块
│   │   └── user.routes.ts
│   ├── ai-provider/   # AI 配置模块
│   │   ├── ai-provider.routes.ts
│   │   ├── ai-provider.schema.ts
│   │   └── ai-provider.service.ts
│   └── decision/      # 裁决核心模块
│       ├── decision.routes.ts
│       ├── decision.schema.ts
│       ├── decision.service.ts      # 裁决服务，编排整个流程
│       ├── decision-orchestrator.ts # 三脑分析编排逻辑
│       └── llm-client.ts             # LLM API 调用封装
└── utils/
```

## 入口与启动

**入口文件：`server.ts`**
- 调用 `buildApp()` 创建 Fastify 实例
- 监听 `0.0.0.0:3001`

**应用构建：`app.ts`**
- 注册中间件：CORS、Cookie、限流
- 注册插件：Prisma、Auth
- 注册路由：Auth → User → AI Provider → Decision
- `/health` 健康检查

## 核心模块

### 1. Auth 模块 (`modules/auth/`)
- **功能**：注册 / 登录 / 登出
- **路由**：`POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout`
- **鉴权方式**：JWT 写入 HttpOnly Cookie

### 2. User 模块 (`modules/user/`)
- **功能**：获取当前用户信息、能力
- **路由**：`GET /api/me`、`GET /api/me/capabilities`
- **用途**：前端渲染身份、控制 AI 配置入口可见性

### 3. AI Provider 模块 (`modules/ai-provider/`)
- **功能**：用户配置自己的 AI API（加密存储）
- **路由**：`GET /api/ai-provider-config`、`PUT /api/ai-provider-config`
- **权限**：仅 `canConfigureAiProvider=true` 的用户可用

### 4. Decision 模块 (`modules/decision/`) — 核心
- **路由**：
  - `POST /api/decision-sessions` — 创建裁决会话
  - `GET /api/decision-sessions` — 列出历史
  - `GET /api/decision-sessions/:id` — 详情

**关键文件：**
- `decision.service.ts`：创建会话、调用编排器、保存结果
- `decision-orchestrator.ts`：三脑分析流程编排
- `llm-client.ts`：统一 LLM 调用（含重试、JSON 解析、超时）

**裁决流程：**
1. **Context 阶段**：识别问题类型、抽取关键变量
2. **Brains 阶段**：Melchior（逻辑）、Balthasar（情绪）、Casper（经验）并行分析
3. **Core 阶段**：汇总三脑结果，输出最终裁决

## 数据库

使用 Prisma + MySQL，主要表：
- `User` — 用户信息、角色、AI 配置权限
- `DecisionSession` — 裁决会话（问题、变量、分析结果、裁决结论）

## 环境变量 (`config/env.ts`)

```typescript
DATABASE_URL          // MySQL 连接
JWT_SECRET            // JWT 签名密钥
API_KEY_ENCRYPTION_SECRET // AI API Key 加密
SYSTEM_AI_PROVIDER    // 系统默认 AI Provider
SYSTEM_AI_BASE_URL    // 系统默认 AI Base URL
SYSTEM_AI_MODEL       // 系统默认模型
SYSTEM_AI_API_KEY     // 系统默认 API Key
DECISION_LLM_TIMEOUT_MS    // 裁决 LLM 超时（默认 35s）
MELCHIOR_TIMEOUT_MS   // Melchior 超时（默认同 DECISION_LLM_TIMEOUT_MS）
FRONTEND_ORIGIN       // 前端地址（用于 CORS）
PORT                  // 服务端口（默认 3001）
```

## 插件

### Prisma 插件 (`plugins/prisma.ts`)
- 通过 `app.decorate('prisma', prisma)` 共享 PrismaClient
- 服务关闭时断开连接

### Auth 插件 (`plugins/auth.ts`)
- 验证 Cookie 中的 `magi_session` JWT
- 将 `userId` 挂到 `request.userId`
- 受保护路由使用 `preHandler: app.authenticate`

## 从哪里开始阅读

1. **`server.ts`** — 了解入口
2. **`app.ts`** — 了解中间件注册顺序和路由挂载
3. **`modules/decision/decision.service.ts`** — 裁决核心逻辑起点
4. **`decision-orchestrator.ts`** — 三脑如何协作
5. **`llm-client.ts`** — LLM 调用细节