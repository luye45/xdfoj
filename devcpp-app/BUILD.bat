@echo off
chcp 65001 >nul
echo ========================================
echo   XDFOJ-DevCpp Windows 构建工具
echo ========================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 显示 Node.js 版本
echo [信息] 检测到 Node.js
node --version
echo.

:: 设置 npm 镜像（如果需要）
echo [信息] 设置 npm 镜像...
npm config set registry https://registry.npmmirror.com

:: 进入目录
cd /d "%~dp0"

:: 检查是否已安装依赖
if exist "node_modules" (
    echo [信息] 检测到已安装依赖
    set /p reinstall="是否重新安装依赖? (y/n): "
    if /i "%reinstall%"=="y" (
        echo [信息] 正在删除旧依赖...
        rmdir /s /q node_modules 2>nul
        del /f /q package-lock.json 2>nul
    )
)

:: 安装依赖
if not exist "node_modules" (
    echo.
    echo [步骤 1/3] 正在安装依赖...
    echo 提示: 首次安装需要下载 Electron (约100MB)，请耐心等待
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

:: 构建应用
echo.
echo [步骤 2/3] 正在构建 Windows 应用...
echo 提示: 构建过程可能需要几分钟
echo.
npm run build

if %errorlevel% neq 0 (
    echo.
    echo [错误] 构建失败
    pause
    exit /b 1
)

:: 检查构建结果
echo.
echo [步骤 3/3] 正在检查构建结果...
echo.

if exist "dist\win-unpacked\XDFOJ-DevCpp.exe" (
    echo ========================================
    echo   构建成功！
    echo ========================================
    echo.
    echo 生成的文件位置:
    echo   便携版: dist\win-unpacked\XDFOJ-DevCpp.exe
    echo.
    
    if exist "dist\win-unpacked\XDFOJ-DevCpp-Setup.exe" (
        echo   安装版: dist\win-unpacked\XDFOJ-DevCpp-Setup.exe
        echo.
    )
    
    set /p open_folder="是否打开输出目录? (y/n): "
    if /i "%open_folder%"=="y" (
        explorer dist\win-unpacked
    )
    
    set /p run_app="是否立即运行程序? (y/n): "
    if /i "%run_app%"=="y" (
        start "" "dist\win-unpacked\XDFOJ-DevCpp.exe"
    )
) else (
    echo.
    echo [警告] 未找到生成的可执行文件
    echo 请检查构建日志
)

echo.
pause
