import { initializeTheme } from './v2/domain/theme'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './v2/auth/AuthProvider'
import { router } from './v2/app/router'
import './v2/styles/global.css'
import './v2/styles/analysis-setup.css'
import './v2/styles/analysis-workspace.css'
import './v2/styles/video-sync.css'
import './v2/styles/tagging.css'

initializeTheme()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
