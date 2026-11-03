import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'zm.cropwatch.app',
  appName: 'Phytos',
  webDir: 'dist',
  appendUserAgent: ' Phytos/1.0 (+https://github.com/Geoffrey-Zulu/cropwatch)',
  ios: { contentInset: 'never' },
}

export default config
