// Electron main process for the desktop widget.
// A frameless, transparent, always-on-top window holds the button. Drag it anywhere
// (it snaps to screen edges), right-click for the menu, tray icon to show/hide.
//
// Positioning model: we track where the *button* is (its top-left in screen DIPs) and
// always keep it fully inside the work area of the display it's on, so it can never end
// up under the taskbar or off-screen. The window around it adds a shadow margin (PAD)
// plus a strip for the hover toolbar (BAR), which goes above the button, or below it
// when the button is near the top of the screen.
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DIST = path.join(__dirname, '..', 'dist-desktop')
const ASSETS = path.join(__dirname, 'assets')
const ASPECT = 104 / 676
const BAR = 38 // strip for the hover toolbar (above the button, or below near the top of the screen)
const PAD = 10 // small transparent margin around the button
const SNAP = 24
const EDGE = 8

const ANIMS = [
  ['guitar', 'Guitar Jam'],
  ['hello', 'Hello Wave'],
  ['jump', 'Jump Party'],
  ['code', 'Code Mode'],
  ['dance', 'Dance Party'],
  ['sleep', 'Sleepy'],
  ['random', 'Random'],
]
const SIZES = [
  ['S', 240],
  ['M', 340],
  ['L', 466],
  ['XL', 676],
]

// CLAWD_USER_DATA=<dir> runs an isolated instance (own settings + single-instance lock), for testing
if (process.env.CLAWD_USER_DATA) app.setPath('userData', process.env.CLAWD_USER_DATA)

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// ───────────────────────── persisted state ─────────────────────────
const statePath = () => path.join(app.getPath('userData'), 'clawd-widget.json')
let state = { settings: {}, btn: null, onTop: true }

function loadState() {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(statePath(), 'utf8')) }
  } catch {
    /* first run */
  }
  // older versions stored the window position; convert it to the button position
  if (!state.btn && state.pos) state.btn = { x: state.pos.x + PAD, y: state.pos.y + BAR + PAD }
  delete state.pos
}
let saveTimer = null
function saveState() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(statePath()), { recursive: true })
      fs.writeFileSync(statePath(), JSON.stringify(state, null, 2))
    } catch (e) {
      console.error('could not save settings', e)
    }
  }, 200)
}

const size = () => Number(state.settings.size) || 340
const btnSize = () => ({ w: size(), h: Math.round(size() * ASPECT) })
function windowSize() {
  const { w, h } = btnSize()
  return { width: w + PAD * 2, height: h + BAR + PAD * 2 }
}

// ───────────────────────── positioning ─────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
/** CLAWD_TRACE=1 logs drag / menu / layout events */
const trace = (...a) => process.env.CLAWD_TRACE && console.log('[main]', ...a)

/** Work area (screen minus taskbar/dock) of the display under a point. */
const workAreaAt = (x, y) => screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) }).workArea

/** Work area of the display the button's centre is on. */
function workAreaOf(p) {
  const { w, h } = btnSize()
  return workAreaAt(p.x + w / 2, p.y + h / 2)
}

/** Keep the whole button inside a work area (default: the display its centre is on). */
function clampBtn(p, wa = workAreaOf(p)) {
  const { w, h } = btnSize()
  return {
    x: Math.round(clamp(p.x, wa.x, wa.x + wa.width - w)),
    y: Math.round(clamp(p.y, wa.y, wa.y + wa.height - h)),
  }
}

/** Toolbar goes above the button unless that would leave the screen. */
function barSide(p, wa = workAreaOf(p)) {
  return p.y - wa.y >= BAR + PAD ? 'top' : 'bottom'
}

function defaultBtn() {
  const wa = screen.getPrimaryDisplay().workArea
  const { w, h } = btnSize()
  return { x: wa.x + wa.width - w - 16, y: wa.y + wa.height - h - 16 }
}

let layout = { bar: 'top' }

/**
 * Move the button to p, clamped inside a work area, and lay the window out around it.
 * While dragging, the work area is the one under the cursor, so the widget stays on the
 * monitor the pointer is on (important with several monitors / mixed scaling).
 */
function placeBtn(p, save = false, wa) {
  const btn = clampBtn(p, wa)
  state.btn = btn
  if (save) saveState()
  if (!widget) return
  const bar = barSide(btn, wa)
  if (bar !== layout.bar) {
    layout = { bar }
    widget.webContents.send('layout', layout)
  }
  const ws = windowSize()
  widget.setBounds({ x: btn.x - PAD, y: bar === 'top' ? btn.y - BAR - PAD : btn.y - PAD, ...ws })
}

/** After a drag: snap to edges that are close. */
function snapBtn(p, wa = workAreaOf(p)) {
  const { w, h } = btnSize()
  let { x, y } = p
  if (x - wa.x < SNAP) x = wa.x + EDGE
  if (wa.x + wa.width - (x + w) < SNAP) x = wa.x + wa.width - w - EDGE
  if (y - wa.y < SNAP) y = wa.y + EDGE
  if (wa.y + wa.height - (y + h) < SNAP) y = wa.y + wa.height - h - EDGE
  return { x, y }
}

// ───────────────────────── windows ─────────────────────────
/** surface renderer errors in the terminal that launched the app */
function logRenderer(win, name) {
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning' || process.env.CLAWD_DEBUG) console.log(`[${name}] ${e.message}`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => console.error(`[${name}] failed to load ${url}: ${desc} (${code})`))
  win.webContents.on('render-process-gone', (_e, d) => console.error(`[${name}] renderer gone: ${d.reason}`))
}

let widget = null
let settingsWin = null
let tray = null

function createWidget() {
  const btn = clampBtn(state.btn ?? defaultBtn())
  const bar = barSide(btn)
  layout = { bar }
  widget = new BrowserWindow({
    ...windowSize(),
    x: btn.x - PAD,
    y: bar === 'top' ? btn.y - BAR - PAD : btn.y - PAD,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: state.onTop,
    backgroundColor: '#00000000',
    title: 'Clawd Widget',
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  if (state.onTop) widget.setAlwaysOnTop(true, 'floating')
  widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })
  logRenderer(widget, 'widget')
  void widget.loadFile(path.join(DIST, 'widget.html'))
  widget.webContents.on('did-finish-load', () => widget?.webContents.send('layout', layout))
  widget.on('blur', endDrag)
  widget.on('show', watchCursor)
  widget.on('hide', watchCursor)
  widget.on('closed', () => {
    endDrag()
    widget = null
    watchCursor()
  })
  state.btn = btn
  watchCursor()
}

// ───────────────────────── cursor ─────────────────────────
// The widget page only sees the mouse while it's over the window. While "Eyes follow
// cursor" is on, send it the global position (in window coordinates) so Clawd can watch
// the mouse anywhere on screen. Only changes are sent.
let cursorTimer = null
let lastCursor = null

function watchCursor() {
  const want = !!widget && widget.isVisible() && state.settings.eyesFollow !== false
  if (want && !cursorTimer) cursorTimer = setInterval(sendCursor, 50)
  if (!want && cursorTimer) {
    clearInterval(cursorTimer)
    cursorTimer = null
    lastCursor = null
  }
}

function sendCursor() {
  if (!widget) return
  const p = screen.getCursorScreenPoint()
  if (lastCursor && p.x === lastCursor.x && p.y === lastCursor.y) return
  lastCursor = p
  const b = widget.getContentBounds()
  widget.webContents.send('cursor', p.x - b.x, p.y - b.y)
}

function openSettings() {
  if (settingsWin) {
    settingsWin.show()
    settingsWin.focus()
    return
  }
  settingsWin = new BrowserWindow({
    width: 620,
    height: 860,
    minWidth: 420,
    title: 'Clawd Widget settings',
    backgroundColor: '#121116',
    autoHideMenuBar: true,
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  logRenderer(settingsWin, 'settings')
  void settingsWin.loadFile(path.join(DIST, 'settings.html'))
  settingsWin.on('closed', () => (settingsWin = null))
}

function toggleWidget(show) {
  if (!widget) return createWidget()
  const vis = show ?? !widget.isVisible()
  if (vis) {
    placeBtn(state.btn ?? defaultBtn()) // make sure it comes back somewhere visible
    widget.showInactive()
  }
  else widget.hide()
  rebuildTray()
}

// ───────────────────────── settings ─────────────────────────
function broadcast() {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('settings', state.settings)
}

function setSettings(next) {
  const prevSize = size()
  state.settings = next
  saveState()
  if (size() !== prevSize && state.btn) {
    // keep the button's bottom-right corner where it was when the size changes
    const dw = size() - prevSize
    const dh = Math.round(size() * ASPECT) - Math.round(prevSize * ASPECT)
    placeBtn({ x: state.btn.x - dw, y: state.btn.y - dh }, true)
  }
  broadcast()
  rebuildTray()
  watchCursor()
}

const patchSettings = (patch) => setSettings({ ...state.settings, ...patch })
const command = (cmd, arg) => widget?.webContents.send('command', cmd, arg)

// ───────────────────────── menus ─────────────────────────
function menuTemplate() {
  const s = state.settings
  const current = s.animation || 'guitar'
  return [
    { label: 'Play', click: () => command('play') },
    { label: 'Play random', click: () => command('play', 'random') },
    { type: 'separator' },
    {
      label: 'Animation',
      submenu: ANIMS.map(([id, name]) => ({ label: name, type: 'radio', checked: current === id, click: () => patchSettings({ animation: id }) })),
    },
    { label: 'Loop after click', type: 'checkbox', checked: s.playMode === 'loop', click: (i) => patchSettings({ playMode: i.checked ? 'loop' : 'once' }) },
    {
      label: 'Size',
      submenu: SIZES.map(([name, v]) => ({ label: name, type: 'radio', checked: size() === v, click: () => patchSettings({ size: v }) })),
    },
    { type: 'separator' },
    { label: 'Customize…', click: openSettings },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: state.onTop,
      click: (i) => {
        state.onTop = i.checked
        widget?.setAlwaysOnTop(i.checked, 'floating')
        saveState()
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      visible: process.platform !== 'linux',
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
    },
    { label: widget?.isVisible() === false ? 'Show widget' : 'Hide widget', click: () => toggleWidget() },
    {
      label: 'Reset position',
      click: () => {
        toggleWidget(true)
        placeBtn(defaultBtn(), true)
      },
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]
}

function rebuildTray() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()))
}

// ───────────────────────── IPC ─────────────────────────
// Dragging is driven from here, not by renderer pointer events: once the renderer reports
// that a drag started, we follow the real cursor until it reports the release. Moving the
// window under the cursor can't make us lose events this way.
let drag = null

function endDrag() {
  if (!drag) return
  clearInterval(drag.timer)
  const wa = drag.wa
  drag = null
  if (widget && state.btn) placeBtn(snapBtn(state.btn, wa), true, wa)
  trace('drag end', state.btn, layout)
}

ipcMain.handle('settings:get', () => state.settings)
ipcMain.handle('settings:set', (_e, s) => setSettings(s))
ipcMain.handle('layout:get', () => layout)
ipcMain.on('drag:start', () => {
  if (!widget || drag) return
  const c = screen.getCursorScreenPoint()
  const btn = state.btn ?? clampBtn(defaultBtn())
  widget.setIgnoreMouseEvents(false)
  const d = { dx: c.x - btn.x, dy: c.y - btn.y, timer: null, wa: workAreaAt(c.x, c.y) }
  d.timer = setInterval(() => {
    const p = screen.getCursorScreenPoint()
    d.wa = workAreaAt(p.x, p.y)
    placeBtn({ x: p.x - d.dx, y: p.y - d.dy }, false, d.wa)
  }, 8)
  drag = d
  trace('drag start', c, btn)
})
ipcMain.on('drag:end', endDrag)
ipcMain.on('click-through', (_e, on) => {
  if (!drag) widget?.setIgnoreMouseEvents(!!on, { forward: true })
})
ipcMain.on('open-settings', openSettings)
ipcMain.on('hide', () => toggleWidget(false))
// Open the native menu exactly at the cursor. The OS then fits it on screen:
// downwards near the top, flipped left near the right edge.
ipcMain.on('menu', (_e, x, y) => {
  if (!widget) return
  trace('menu at', x, y, widget.getBounds())
  const opts = { window: widget }
  if (Number.isFinite(x) && Number.isFinite(y)) Object.assign(opts, { x: Math.round(x), y: Math.round(y) })
  Menu.buildFromTemplate(menuTemplate()).popup(opts)
})

// ───────────────────────── lifecycle ─────────────────────────
app.on('second-instance', () => toggleWidget(true))

// monitors plugged/unplugged, resolution or taskbar changes: pull the button back into view
const refit = () => widget && state.btn && placeBtn(state.btn, true)
app.on('window-all-closed', () => {
  /* keep running in the tray */
})

app.whenReady().then(() => {
  loadState()
  if (process.platform === 'win32') app.setAppUserModelId('com.clawd.buttonwidget')
  trace('displays', JSON.stringify(screen.getAllDisplays().map((d) => ({ bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor }))))
  createWidget()
  screen.on('display-removed', refit)
  screen.on('display-added', refit)
  screen.on('display-metrics-changed', refit)
  tray = new Tray(nativeImage.createFromPath(path.join(ASSETS, 'tray.png')))
  tray.setToolTip('Clawd Widget')
  tray.on('click', () => toggleWidget())
  rebuildTray()
  if (process.env.CLAWD_DEBUG) {
    openSettings()
    setTimeout(async () => {
      const probe = `(() => { const h = document.querySelector('div'); const sr = h && h.shadowRoot; const b = sr && sr.querySelector('.cw-btn'); return JSON.stringify({ hasShadow: !!sr, btn: b ? [b.offsetWidth, b.offsetHeight] : null, label: sr && sr.querySelector('.cw-label').textContent }) })()`
      console.log('[debug] widget', await widget.webContents.executeJavaScript(probe), widget.getBounds())
      console.log('[debug] settings title', await settingsWin.webContents.executeJavaScript('document.querySelector(".sp-card h3") && document.querySelector(".sp-card h3").textContent'))
    }, 2500)
  }
})
