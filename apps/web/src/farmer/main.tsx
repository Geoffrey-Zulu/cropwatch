import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FarmerPage } from '../pages/FarmerPage'
import { IconProvider } from '../providers/IconProvider'
import '../style.css'

// The farmer app (farmer.html, its own Hosting site): no sign-in, no API, no live season.
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <IconProvider>
      <FarmerPage />
    </IconProvider>
  </StrictMode>
)
