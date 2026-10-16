import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'top.goldierill.crazytypewriter',
  appName: 'CrazyTypewriter',
  webDir: 'mobile-www',
  server: {
    // APK 打开后直接加载线上站点（同源 API/登录/同步全部照旧）
    url: 'https://type-node.goldie-rill.top',
    cleartext: false,
  },
  plugins: {
    // 状态栏/手势条保持深色（白色图标），适配应用深色主题
    SystemBars: {
      style: 'DARK',
    },
  },
};

export default config;
