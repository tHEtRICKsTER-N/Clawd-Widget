import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { chromeStatsStore, chromeStore } from '../../src/core/store'
import { SettingsPanel } from '../../src/settings-ui/SettingsPanel'
import './pages.css'

const isOptions = document.body.dataset.page === 'options'

function Popup() {
  const store = useMemo(() => chromeStore(), [])
  const stats = useMemo(() => chromeStatsStore(), [])
  const [site, setSite] = useState<string>()

  useEffect(() => {
    if (isOptions) return
    // activeTab lets the popup read the current tab's URL while it's open
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      try {
        const u = new URL(tab?.url ?? '')
        if (u.protocol === 'http:' || u.protocol === 'https:') setSite(u.hostname)
        else if (u.protocol === 'file:') setSite('local files')
      } catch {
        /* chrome:// or no url */
      }
    })
  }, [])

  return (
    <div className={isOptions ? 'page-options' : 'page-popup'}>
      <header className="pg-head">
        <img src="icons/icon32.png" width={20} height={20} alt="" />
        <span>Clawd Widget</span>
        {!isOptions && (
          <button className="pg-link" onClick={() => void chrome.runtime.openOptionsPage()}>
            Open full settings ↗
          </button>
        )}
      </header>
      <SettingsPanel
        store={store}
        host="extension"
        compact={!isOptions}
        currentSite={site}
        stats={stats}
        extra={
          <p className="pg-note">
            Shortcuts: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> show/hide on the page, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> play random. Change them at
            chrome://extensions/shortcuts.
          </p>
        }
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
