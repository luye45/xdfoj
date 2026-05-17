const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  saveFile: (content, filePath) => ipcRenderer.send('save-file', { content, filePath }),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
  onFileSaved: (callback) => ipcRenderer.on('file-saved', (event, data) => callback(data)),
  onSaveFilePath: (callback) => ipcRenderer.on('save-file-path', (event, path) => callback(path)),
  getFilePath: () => ipcRenderer.invoke('get-file-path'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', { filePath, content }),
  
  // 菜单动作
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action)),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
