const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (event, listener) => ipcRenderer.on(event, listener)
});
