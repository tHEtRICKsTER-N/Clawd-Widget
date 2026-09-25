/// <reference types="chrome" />
// Service worker: opens the options page for content scripts and relays keyboard shortcuts.

chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg?.type === 'open-options') void chrome.runtime.openOptionsPage()
})

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  const msg = command === 'play-random' ? { type: 'play', id: 'random' } : { type: 'toggle' }
  // pages where content scripts can't run (chrome://, the web store) just don't answer
  chrome.tabs.sendMessage(tab.id, msg).catch(() => {})
})
