# XDFOJ-DevCpp Windows 构建指南

## 📦 快速构建步骤（Windows系统）

### 方式一：使用构建脚本（一键构建）

1. 将整个 `devcpp-app` 文件夹复制到 Windows 系统

2. 双击运行 `BUILD.bat` 文件

3. 等待构建完成（首次构建需要下载 Electron，约 100MB）

4. 在 `dist` 文件夹中找到生成的 `.exe` 文件

### 方式二：手动命令行构建

1. 安装 Node.js (https://nodejs.org/) 建议使用 LTS 版本

2. 打开 "命令提示符" 或 "PowerShell"

3. 进入项目目录：
```bash
cd devcpp-app
```

4. 安装依赖：
```bash
npm install
```

5. 构建应用：
```bash
npm run build
```

6. 找到生成的文件：
- 安装版：`dist/win-unpacked/XDFOJ-DevCpp-Setup.exe`
- 便携版：`dist/win-unpacked/XDFOJ-DevCpp.exe`

---

## 🎯 构建脚本说明

### BUILD.bat
一键构建脚本，自动完成所有步骤。

### 如果构建失败

#### 错误1：npm install 失败
```
原因：网络问题导致下载失败
解决：使用淘宝镜像
```

在命令提示符中依次执行：
```bash
npm config set registry https://registry.npmmirror.com
npm install
npm run build
```

#### 错误2：electron-builder 报错
```
原因：electron 或 electron-builder 版本问题
解决：更新 package.json 中的版本号
```

修改 `package.json`：
```json
"devDependencies": {
  "electron": "^27.0.0",
  "electron-builder": "^24.6.0"
}
```

然后重新安装和构建：
```bash
rmdir /s /q node_modules
npm install
npm run build
```

#### 错误3：缺少 Microsoft Visual C++ Redistributable
```
原因：Windows 缺少运行库
解决：安装 Visual Studio Redistributable
```

下载链接：https://aka.ms/vs/17/release/vc_redist.x64.exe

---

## 📁 生成的文件

### 安装版
- `dist/win-unpacked/XDFOJ-DevCpp-Setup.exe`
- 双击运行即可安装到系统
- 支持卸载

### 便携版
- `dist/win-unpacked/XDFOJ-DevCpp.exe`
- 无需安装，复制到任意位置即可运行

---

## 🛠️ 开发调试

如果想修改代码后调试：

1. 安装依赖：
```bash
npm install
```

2. 运行开发模式：
```bash
npm run dev
```

3. 修改 `renderer/index.html` 中的代码

4. 保存后应用会自动刷新

---

## 📝 常见问题

### Q: 构建很慢怎么办？
A: 首次构建需要下载 Electron（约 100MB），请耐心等待。后续构建会快很多。

### Q: 如何修改应用图标？
A: 
1. 准备一个 256x256 的 ICO 图标文件，命名为 `icon.ico`
2. 放入项目根目录
3. 重新构建

### Q: 如何修改窗口大小？
A: 编辑 `main.js`，找到 `mainWindow` 创建处：
```javascript
mainWindow = new BrowserWindow({
  width: 1400,      // 调整宽度
  height: 900,      // 调整高度
  minWidth: 1000,
  minHeight: 700,
});
```

### Q: 应用打不开怎么办？
A: 
1. 检查是否安装了 Visual C++ Redistributable
2. 检查 Windows 系统版本（需要 64 位系统）
3. 查看 `dist/win-unpacked/resources/logs/` 中的日志

### Q: 如何添加更多编程语言支持？
A: 编辑 `renderer/index.html`，在语言选择器中添加选项：
```html
<select class="toolbar-select" id="lang-select">
  <option value="C++ With O2">C++ With O2</option>
  <option value="C++">C++</option>
  <option value="Python3">Python3</option>
  <option value="Java">Java</option>
  <option value="C">C</option>
  <!-- 添加更多语言 -->
</select>
```

---

## 🔧 高级配置

### 修改构建输出目录

编辑 `package.json`：
```json
"build": {
  "directories": {
    "output": "my-output-folder"
  }
}
```

### 生成不同格式的安装包

编辑 `package.json`，修改 win 配置：
```json
"win": {
  "target": [
    {
      "target": "nsis",      // Windows安装包
      "arch": ["x64"]
    },
    {
      "target": "portable",  // 便携版
      "arch": ["x64"]
    }
  ]
}
```

### 添加应用图标

1. 准备 256x256 PNG 图片
2. 使用在线工具转换为 ICO 格式：https://www.icoconverter.com/
3. 将 ICO 文件命名为 `icon.ico`
4. 放入项目根目录
5. 重新构建

---

## 📞 技术支持

如遇问题，请检查：
1. Node.js 版本（需要 16+）
2. Windows 系统版本（需要 64 位）
3. 网络连接是否正常
4. 磁盘空间是否充足（至少需要 2GB）

---

**祝你构建成功！** 🎉
