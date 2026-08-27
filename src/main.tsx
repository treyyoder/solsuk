import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSimLoop, useSimStore, yearFromT } from './store/simStore'
import { START_YEAR, YEAR_SECONDS } from './simulation/epochModel'

startSimLoop()

// deep-link into an era: ?year=2040 — otherwise the simulation starts at the
// REAL current date and time (speed level 1 is genuine 1 s/s real time, so
// the sim clock ticks in lockstep with the wall clock from here)
const yearParam = new URLSearchParams(window.location.search).get('year')
if (yearParam && !Number.isNaN(parseFloat(yearParam))) {
  useSimStore.getState().setYear(parseFloat(yearParam))
} else {
  const now = new Date()
  const y = now.getFullYear()
  // calendar day index via UTC-date arithmetic — immune to DST offsets
  const dayIndex = Math.round((Date.UTC(y, now.getMonth(), now.getDate()) - Date.UTC(y, 0, 1)) / 86400000)
  const secondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  // day/HH:MM in the TopBar clock derive from t mod 86400, so anchoring t on
  // whole sim-days keeps the displayed clock matching the user's wall clock
  const t = (y - START_YEAR) * YEAR_SECONDS + dayIndex * 86400 + secondsToday
  useSimStore.getState().setYear(yearFromT(t))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
