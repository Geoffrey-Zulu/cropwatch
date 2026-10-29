import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { QueryProvider } from './providers/QueryProvider'
import './style.css'

const root = createRoot(document.getElementById('app')!)
const preview = window.location.hash.match(/^#\/preview\/?(.*)$/)

if (import.meta.env.DEV && preview) {
  // Design review from seed fixtures, without signing in (src/dev/Preview.tsx).
  void import('./dev/Preview').then(({ Preview }) => root.render(<Preview route={preview[1]} />))
} else {
  root.render(
    <StrictMode>
      <QueryProvider>
        <App />
      </QueryProvider>
    </StrictMode>
  )
}
