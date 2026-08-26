import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSimLoop, useSimStore } from './store/simStore'

startSimLoop()

// deep-link into an era: ?year=2040
const yearParam = new URLSearchParams(window.location.search).get('year')
if (yearParam) {
  const y = parseFloat(yearParam)
  if (!Number.isNaN(y)) useSimStore.getState().setYear(y)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
