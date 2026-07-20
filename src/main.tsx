import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Tooltip from '@radix-ui/react-tooltip'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ProfileGate } from './components/ProfileGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ProfileGate>
        <Tooltip.Provider delayDuration={350}>
          <App />
        </Tooltip.Provider>
      </ProfileGate>
    </ErrorBoundary>
  </StrictMode>,
)
