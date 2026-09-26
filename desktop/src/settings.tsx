import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { desktopStatsStore, desktopStore } from '../../src/core/store'
import { SettingsPanel } from '../../src/settings-ui/SettingsPanel'
import './settings-page.css'

function Settings() {
  const store = useMemo(() => desktopStore(), [])
  const stats = useMemo(() => desktopStatsStore(), [])
  return (
    <div className="dk-page">
      <h1>Clawd Widget</h1>
      <p className="dk-note">Changes apply to the desktop widget straight away. Right-click the widget or the tray icon for quick options.</p>
      <SettingsPanel store={store} host="desktop" stats={stats} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Settings />
  </StrictMode>,
)
