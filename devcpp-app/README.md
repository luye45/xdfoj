# XDFOJ-DevCpp 学生端 Windows 桌面应用

## 📖 项目简介

这是一个基于 Electron 框架开发的 Windows 桌面应用程序，完全模仿 Dev-C++ 的经典界面风格，并与 XDFOJ 在线评测系统集成。

## ✨ 功能特性

- 🎨 **经典Dev-C++界面** - 复古的 Windows 风格界面
- 💻 **代码编辑器** - 支持语法高亮（C++、Python、Java、C）
- 📋 **题单管理** - 支持公共训练、团队训练、团队比赛
- ▶️ **编译运行** - 本地编译运行功能
- 📤 **在线提交** - 连接 XDFOJ 提交评测
- 📁 **文件操作** - 新建、打开、保存、另存为
- ⌨️ **快捷键支持** - Ctrl+S 保存、F9 编译、F10 运行、F11 提交

## 🛠️ 构建步骤

### 前置要求

- Node.js 16+ 
- npm 或 yarn

### 安装依赖

```bash
cd devcpp-app
npm install
```

### 运行开发模式

```bash
npm run dev
```

### 构建 Windows 可执行文件

```bash
npm run build
```

构建完成后，可执行文件将生成在 `dist` 目录下：
- `XDFOJ-DevCpp-Setup.exe` - 安装版
- `XDFOJ-DevCpp.exe` - 便携版（无需安装）

## 📁 项目结构

```
devcpp-app/
├── main.js          # Electron 主进程
├── preload.js       # 预加载脚本（安全桥接）
├── package.json     # 项目配置
├── renderer/
│   └── index.html   # 渲染进程（前端界面）
└── dist/            # 构建输出目录
```

## 🎯 使用说明

1. **启动应用** - 运行 `XDFOJ-DevCpp.exe`
2. **登录 XDFOJ** - 在浏览器中登录 XDFOJ 系统
3. **加载题目** - 在左侧题单区域选择训练/比赛
4. **编写代码** - 在右侧编辑器中编写代码
5. **编译运行** - 使用工具栏按钮或快捷键
6. **提交评测** - 点击提交按钮上传到 XDFOJ

## ⚙️ 系统要求

- Windows 7/8/10/11 (64位)
- 至少 2GB 内存
- 至少 500MB 硬盘空间

## 📝 技术栈

- **框架**: Electron 28+
- **构建工具**: electron-builder
- **前端**: HTML5 + CSS3 + Vanilla JavaScript

## 🔧 自定义配置

### 修改图标

将 `icon.ico` 文件替换为你的图标，然后重新构建。

### 修改窗口配置

在 `main.js` 中修改 BrowserWindow 的配置：

```javascript
mainWindow = new BrowserWindow({
  width: 1400,      // 窗口宽度
  height: 900,      // 窗口高度
  minWidth: 1000,   // 最小宽度
  minHeight: 700,   // 最小高度
  // ...
});
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
