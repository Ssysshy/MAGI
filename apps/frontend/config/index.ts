import { defineConfig, type UserConfigExport } from '@tarojs/cli';

export default defineConfig<'vite'>(async (): Promise<UserConfigExport<'vite'>> => ({
  projectName: 'magi-console',
  date: '2026-04-30',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'vite',
  plugins: ['@tarojs/plugin-platform-h5'],
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: {
      mode: 'hash',
    },
  },
}));
