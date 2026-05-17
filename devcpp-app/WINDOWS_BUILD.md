# Windows 构建说明

## ⚠️ 为什么需要手动构建？

由于 Electron 框架的特殊性（需要下载约 100MB 的 Electron 二进制文件），
在当前的服务器环境中无法完成构建。

## 🔧 在 Windows 系统上构建

### 步骤 1：复制项目文件夹

将 `devcpp-app` 文件夹完整复制到你的 Windows 电脑上

### 步骤 2：安装 Node.js

下载地址：https://nodejs.org/ (选择 LTS 版本)

安装完成后，打开"命令提示符"或"PowerShell"，验证安装：
```bash
node --version
npm --version
```

### 步骤 3：一键构建

双击运行 `BUILD.bat` 文件

等待构建完成（首次约 5-10 分钟）

### 步骤 4：运行应用

构建成功后，在 `dist\win-unpacked\` 文件夹中找到：
- `XDFOJ-DevCpp.exe` - 便携版（无需安装）
- `XDFOJ-DevCpp-Setup.exe` - 安装版（需要安装）

---

## 📦 构建产物

### 便携版 (推荐)
**文件**: `dist\win-unpacked\XDFOJ-DevCpp.exe`

特点：
- 无需安装，复制即可使用
- 可以放在 U 盘随身携带
- 不修改系统注册表

使用方法：
双击 `XDFOJ-DevCpp.exe` 即可运行

### 安装版
**文件**: `dist\win-unpacked\XDFOJ-DevCpp-Setup.exe`

特点：
- 标准 Windows 安装程序
- 创建开始菜单快捷方式
- 创建桌面快捷方式
- 可在控制面板中卸载

使用方法：
双击安装程序，按提示完成安装

---

## 🎯 使用说明

1. **运行应用**
   - 方式一：双击 `XDFOJ-DevCpp.exe`
   - 方式二：从开始菜单选择 "XDFOJ-DevCpp"

2. **登录 XDFOJ**
   - 打开浏览器访问 https://code.xdf.cn/oj
   - 使用你的账号登录

3. **使用题单功能**
   - 在左侧题单区域选择题目类型
   - 选择训练或比赛
   - 点击加载按钮

4. **编写代码**
   - 在右侧代码编辑器中编写
   - 支持语法高亮
   - 支持多文件标签

5. **编译运行**
   - 点击工具栏的"编译"按钮 (或按 F9)
   - 点击工具栏的"运行"按钮 (或按 F10)

6. **提交代码**
   - 点击工具栏的"提交"按钮 (或按 F11)
   - 等待 XDFOJ 评测结果

---

## ❓ 常见问题

### Q: 双击 BUILD.bat 没反应？
A: 
1. 右键点击 BUILD.bat
2. 选择"以管理员身份运行"

### Q: 构建报错 "electron" not found？
A: 重新安装依赖：
```bash
rmdir /s /q node_modules
npm install
npm run build
```

### Q: 应用程序无法启动？
A: 
1. 确保是 64 位 Windows 系统
2. 安装 Visual C++ Redistributable：
   https://aka.ms/vs/17/release/vc_redist.x64.exe

### Q: 界面显示异常？
A: 
1. 尝试调整窗口大小
2. 确保使用 100% 缩放
3. 更新显卡驱动

---

## 🔧 自定义配置

### 修改应用图标
1. 准备 256x256 的 PNG 图片
2. 转换为 ICO 格式：http://www.icoconverter.com/
3. 命名为 `icon.ico`
4. 放入项目根目录
5. 重新运行 `BUILD.bat`

### 修改窗口大小
编辑 `main.js` 文件，找到：
```javascript
mainWindow = new BrowserWindow({
  width: 1400,      // 窗口宽度
  height: 900,      // 窗口高度
  minWidth: 1000,   // 最小宽度
  minHeight: 700,   // 最小高度
});
```

### 添加更多语言
编辑 `renderer/index.html`，在语言选择器中添加即可。

---

## 📞 获取帮助

如果遇到问题：
1. 查看 BUILD_GUIDE.md 详细文档
2. 检查错误信息
3. 搜索相似问题

---

**祝你使用愉快！** 🚀
