import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './style.css'

const root = createRoot(document.getElementById('root')!)
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>)

// Development only: screen states from fixtures (src/dev/Preview.tsx), never in a build.
const preview = window.location.hash.match(/^#\/preview\/?(\w*)/)
if (import.meta.env.DEV && preview) {
  // A phone-width column (headless Chrome will not open a window that narrow); the transform
  // makes fixed bars size to the column, not the window.
  if (new URLSearchParams(window.location.search).has('phone')) {
    document.getElementById('root')!.style.cssText =
      'width:390px;min-height:100vh;transform:translateZ(0);overflow:hidden'
  }
  void import('./dev/Preview').then(({ Preview }) => render(<Preview state={preview[1]} />))
} else {
  // The service worker caches the app shell (so the app opens with no signal) and receives
  // alert pushes. New versions activate on the next launch.
  registerSW({ immediate: true })
  render(<App />)
}
