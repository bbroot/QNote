#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MarkFlowy — 构建并打包为可分发的 zip 文件
#  用法: ./package.sh
#  产物: markflowy-<version>-portable.zip
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

cd "$(dirname "$0")"

# 读取版本号
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.2.0")
ZIP_NAME="markflowy-${VERSION}-portable.zip"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MarkFlowy v${VERSION} — 构建与打包"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 安装依赖
if [ ! -d "node_modules" ]; then
    echo "[1/4] 安装依赖..."
    npm install
else
    echo "[1/4] 依赖已存在，跳过安装"
fi

# 2. 构建
echo "[2/4] 构建生产版本..."
npm run build

# 3. 检查构建产物
if [ ! -f "dist/index.html" ]; then
    echo "[ERROR] 构建失败：找不到 dist/index.html"
    exit 1
fi
echo "      构建产物大小: $(du -sh dist/ | cut -f1)"

# 4. 打包
echo "[3/4] 打包为 ${ZIP_NAME}..."

# 创建临时目录
TMPDIR=$(mktemp -d)
PKG_DIR="${TMPDIR}/markflowy"
mkdir -p "${PKG_DIR}"

# 复制文件
cp -r dist/ "${PKG_DIR}/dist/"
cp start.sh "${PKG_DIR}/start.sh"
cp start.bat "${PKG_DIR}/start.bat"
cp start.ps1 "${PKG_DIR}/start.ps1"
cp LICENSE "${PKG_DIR}/LICENSE"
cp README.md "${PKG_DIR}/README.md"

# 创建精简版 README（面向最终用户）
cat > "${PKG_DIR}/快速开始.md" << 'QUICKSTART'
# MarkFlowy 快速开始

## macOS / Linux

1. 双击 `start.sh` 或在终端中运行：
   ```bash
   ./start.sh
   ```

2. 首次运行会自动检测环境，如缺少 Node.js 会提示安装

3. 浏览器会自动打开 http://localhost:3000

## Windows

**方式一：双击 `start.bat`**

**方式二：PowerShell**
```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

## 系统要求

- **推荐**: Node.js >= 18（脚本可自动安装）
- **备选**: Python 3（用于启动简易 HTTP 服务器）
- **浏览器**: Chrome / Edge（完整功能）| Firefox / Safari（部分功能）

## 功能说明

- WYSIWYG 所见即所得编辑模式
- 源码模式（按 Ctrl+/ 切换）
- 文件版本历史（Git 快照）
- 多主题支持
- 表格编辑
- 导出 HTML

## 无需安装 Node.js？

如果不想安装任何环境，可以用以下方式手动启动：

**macOS / Linux**（需要 Python）:
```bash
cd dist && python3 -m http.server 3000
```

**Windows**（需要 Python）:
```cmd
cd dist && python -m http.server 3000
```

然后手动在浏览器打开 http://localhost:3000
QUICKSTART

# 打包为 zip
cd "${TMPDIR}"
zip -r -q "${OLDPWD}/${ZIP_NAME}" markflowy/
cd "${OLDPWD}"

# 清理
rm -rf "${TMPDIR}"

# 完成
echo "[4/4] 完成！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  产物: ${ZIP_NAME}"
echo "  大小: $(du -sh "${ZIP_NAME}" | cut -f1)"
echo ""
echo "  发给客户后，解压并运行:"
echo "    macOS/Linux:  ./start.sh"
echo "    Windows:      start.bat"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
