import { readFileSync, writeFileSync } from 'node:fs'

// Idempotent, cross-platform setup after `cap add ios`. Signing stays outside source control.
const plist = new URL('../apps/capture/ios/App/App/Info.plist', import.meta.url)
let text = readFileSync(plist, 'utf8')
const descriptions = {
  NSCameraUsageDescription: 'Photograph a damaged crop to request a crop health assessment.',
  NSPhotoLibraryUsageDescription: 'Choose a crop photo to include in your crop health report.',
  NSPhotoLibraryAddUsageDescription: 'Save a crop photo only when you choose to save it.',
  NSLocationWhenInUseUsageDescription: 'Locate your crop report and suggest your district.',
  NSLocationAlwaysAndWhenInUseUsageDescription:
    'Location is used only while reporting a crop problem. Background tracking is not enabled.',
  ITSAppUsesNonExemptEncryption: false,
}
for (const [key, value] of Object.entries(descriptions)) {
  if (text.includes(`<key>${key}</key>`)) continue
  const entry = typeof value === 'boolean' ? '<false/>' : `<string>${value}</string>`
  text = text.replace('</dict>\n</plist>', `\t<key>${key}</key>\n\t${entry}\n</dict>\n</plist>`)
}
writeFileSync(plist, text)
