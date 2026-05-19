import { buildApp } from './app.js';
import { env } from './config/env.js';

const start = async (): Promise<void> => {
  const app = await buildApp();
  await app.listen({ host: '0.0.0.0', port: env.PORT });
};

// 构建完app 开始启动服务
void start();
