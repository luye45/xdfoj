const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFile = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'XDFOJ-DevCpp',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: false,
    show: false
  });

  // 加载主页面
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // 创建应用菜单
  createMenu();

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: '文件(F)',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-action', 'new')
        },
        {
          label: '打开...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile()
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-action', 'save')
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => handleSaveFileAs()
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑(E)',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '运行(R)',
      submenu: [
        {
          label: '编译',
          accelerator: 'F9',
          click: () => mainWindow.webContents.send('menu-action', 'compile')
        },
        {
          label: '运行',
          accelerator: 'F10',
          click: () => mainWindow.webContents.send('menu-action', 'run')
        },
        { type: 'separator' },
        {
          label: '提交',
          accelerator: 'F11',
          click: () => mainWindow.webContents.send('menu-action', 'submit')
        }
      ]
    },
    {
      label: '查看(V)',
      submenu: [
        {
          label: '刷新',
          accelerator: 'F5',
          click: () => mainWindow.reload()
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => mainWindow.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: '帮助(H)',
      submenu: [
        {
          label: '关于',
          click: () => showAboutDialog()
        },
        {
          label: '访问 XDFOJ',
          click: () => shell.openExternal('https://code.xdf.cn/oj')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '代码文件', extensions: ['cpp', 'c', 'cc', 'cxx', 'py', 'java', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      currentFile = filePath;
      mainWindow.webContents.send('file-opened', { path: filePath, content: content });
    } catch (err) {
      dialog.showErrorBox('错误', '无法读取文件: ' + err.message);
    }
  }
}

async function handleSaveFileAs() {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'C++ 文件', extensions: ['cpp'] },
      { name: 'C 文件', extensions: ['c'] },
      { name: 'Python 文件', extensions: ['py'] },
      { name: 'Java 文件', extensions: ['java'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    mainWindow.webContents.send('save-file-path', result.filePath);
  }
}

function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于 XDFOJ-DevCpp',
    message: 'XDFOJ-DevCpp',
    detail: '版本: 1.0.0\n\n仿 Dev-C++ 风格的 XDFOJ 在线评测工具\n支持多种编程语言\n\n© 2024 XDFOJ Team'
  });
}

// IPC 通信处理
ipcMain.on('save-file', async (event, { content, filePath }) => {
  try {
    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
      currentFile = filePath;
    } else {
      const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
          { name: 'C++ 文件', extensions: ['cpp'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        currentFile = result.filePath;
      }
    }
    mainWindow.webContents.send('file-saved', { success: true, path: currentFile });
  } catch (err) {
    mainWindow.webContents.send('file-saved', { success: false, error: err.message });
  }
});

ipcMain.handle('get-file-path', () => currentFile);

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '代码文件', extensions: ['cpp', 'c', 'cc', 'cxx', 'py', 'java', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content: content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-file', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 应用启动
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前检查
app.on('before-quit', () => {
  // 可以添加保存检查逻辑
});
