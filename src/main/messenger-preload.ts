import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('messengerAPI', {
  onConsoleMessage: (callback: (message: string) => void) => {
    const handler = (_event: any, message: string) => callback(message)
    ipcRenderer.on('messenger-console', handler)
    return () => ipcRenderer.removeListener('messenger-console', handler)
  },
})