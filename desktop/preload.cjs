// Bridge between the sandboxed widget / settings pages and the main process.
const { contextBridge, ipcRenderer } = require('electron')

const on = (channel, cb) => {
  const fn = (_e, ...args) => cb(...args)
  ipcRenderer.on(channel, fn)
  return () => ipcRenderer.removeListener(channel, fn)
}

contextBridge.exposeInMainWorld('clawdDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  onSettings: (cb) => on('settings', cb),
  onCommand: (cb) => on('command', cb),
  getLayout: () => ipcRenderer.invoke('layout:get'),
  onLayout: (cb) => on('layout', cb),
  // the main process follows the real cursor between these two calls
  dragStart: () => ipcRenderer.send('drag:start'),
  dragEnd: () => ipcRenderer.send('drag:end'),
  setClickThrough: (on) => ipcRenderer.send('click-through', on),
  openSettings: () => ipcRenderer.send('open-settings'),
  showMenu: (x, y) => ipcRenderer.send('menu', x, y),
  hide: () => ipcRenderer.send('hide'),
})
