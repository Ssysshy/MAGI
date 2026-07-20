import { defineConfig, type UserConfigExport } from '@tarojs/cli';

interface TaroProcessLike {
  env?: {
    TARO_ENV?: string;
  };
}

const processLike = (globalThis as typeof globalThis & { process?: TaroProcessLike }).process;

const getBuildTarget = (): 'h5' | 'weapp' => (processLike?.env?.TARO_ENV === 'weapp' ? 'weapp' : 'h5');

export default defineConfig<'vite'>(async (): Promise<UserConfigExport<'vite'>> => {
  const target = getBuildTarget();

  return {
    projectName: 'magi-console',
    date: '2026-04-30',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: target === 'weapp' ? 'dist/weapp' : 'dist/h5',
    framework: 'react',
    compiler: 'vite',
    plugins: ['@tarojs/plugin-platform-h5', '@tarojs/plugin-platform-weapp'],
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      router: {
        mode: 'hash',
      },
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
        },
      },
    },
  };
});
