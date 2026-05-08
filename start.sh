#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MarkFlowy — 跨平台自动检测 + 一键启动脚本 (macOS / Linux)
#  无需预装 Node.js，脚本会自动检测并安装
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ---------- 配置 ----------
PORT=3000
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
MIN_NODE_MAJOR=18
MARKFLOWY_VERSION="0.2.0"

# ---------- 工具函数 ----------
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------- 检测 Node.js ----------
check_node() {
    if command -v node &>/dev/null; then
        local ver
        ver=$(node -v | sed 's/^v//')
        local major
        major=$(echo "$ver" | cut -d. -f1)
        if [ "$major" -ge "$MIN_NODE_MAJOR" ]; then
            ok "Node.js v${ver} 已安装 (需要 ≥ ${MIN_NODE_MAJOR})"
            return 0
        else
            warn "Node.js v${ver} 版本过低 (需要 ≥ ${MIN_NODE_MAJOR})，将重新安装"
            return 1
        fi
    fi
    return 1
}

# ---------- 安装 Node.js ----------
install_node() {
    echo ""
    info "正在安装 Node.js (通过 fnm)..."
    echo -e "${BOLD}────────────────────────────────────────${NC}"

    # 安装 fnm (Fast Node Manager)
    if ! command -v fnm &>/dev/null; then
        info "安装 fnm..."
        curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$HOME/.local/bin" --skip-shell

        # 临时加载 fnm
        export PATH="$HOME/.local/bin:$PATH"
        eval "$(fnm env)"

        if ! command -v fnm &>/dev/null; then
            err "fnm 安装失败，尝试备选方案..."
            install_node_nvm
            return $?
        fi
        ok "fnm 安装成功"
    fi

    # 用 fnm 安装 Node.js LTS
    info "安装 Node.js LTS 版本..."
    fnm install --lts
    fnm use lts-latest
    eval "$(fnm env)"

    if check_node; then
        ok "Node.js 安装成功！"
        return 0
    else
        err "fnm 安装 Node.js 失败，尝试备选方案..."
        install_node_nvm
        return $?
    fi
}

install_node_nvm() {
    if ! command -v nvm &>/dev/null; then
        info "安装 nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

        if ! command -v nvm &>/dev/null; then
            err "nvm 安装失败"
            install_node_direct
            return $?
        fi
        ok "nvm 安装成功"
    fi

    info "安装 Node.js LTS 版本..."
    nvm install --lts
    nvm use --lts

    if check_node; then
        ok "Node.js 安装成功！"
        return 0
    else
        err "nvm 安装 Node.js 失败，尝试直接下载..."
        install_node_direct
        return $?
    fi
}

install_node_direct() {
    local arch kernel
    kernel=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)

    local node_arch
    case "$arch" in
        x86_64)  node_arch="x64" ;;
        aarch64|arm64) node_arch="arm64" ;;
        *)       err "不支持的架构: $arch"; exit 1 ;;
    esac

    # 获取最新 LTS 版本号
    info "获取 Node.js LTS 版本号..."
    local lts_ver
    lts_ver=$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data:
    if r.get('lts'):
        print(r['version'].lstrip('v'))
        break
" 2>/dev/null || echo "")

    if [ -z "$lts_ver" ]; then
        lts_ver="22.14.0"  # fallback
    fi

    local filename="node-v${lts_ver}-${kernel}-${node_arch}.tar.xz"
    local url="https://nodejs.org/dist/v${lts_ver}/${filename}"
    local tmpdir
    tmpdir=$(mktemp -d)

    info "下载 Node.js v${lts_ver}..."
    curl -fsSL "$url" | tar -xJ -C "$tmpdir"

    local node_dir="$HOME/.local/node"
    rm -rf "$node_dir"
    mv "${tmpdir}/node-v${lts_ver}-${kernel}-${node_arch}" "$node_dir"
    rm -rf "$tmpdir"

    # 加入 PATH
    export PATH="$node_dir/bin:$PATH"
    grep -q 'node_dir/bin' "$HOME/.bashrc" 2>/dev/null || \
        echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "$HOME/.bashrc"
    grep -q 'node_dir/bin' "$HOME/.zshrc" 2>/dev/null || \
        echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "$HOME/.zshrc"

    if check_node; then
        ok "Node.js 安装成功！"
        return 0
    else
        err "所有安装方式均失败，请手动安装 Node.js ≥ ${MIN_NODE_MAJOR}"
        echo "  下载地址: https://nodejs.org/"
        exit 1
    fi
}

# ---------- 自动构建 ----------
auto_build() {
    if [ ! -f "$DIST_DIR/index.html" ]; then
        echo ""
        warn "未找到构建产物 dist/index.html"
        
        if ! command -v node &>/dev/null; then
            err "需要 Node.js 来构建项目，请先安装 Node.js"
            return 1
        fi

        if [ ! -d "${SCRIPT_DIR}/node_modules" ]; then
            info "安装项目依赖..."
            cd "$SCRIPT_DIR"
            npm install
        fi

        info "构建生产版本..."
        cd "$SCRIPT_DIR"
        npm run build

        if [ -f "$DIST_DIR/index.html" ]; then
            ok "构建成功！"
        else
            err "构建失败"
            return 1
        fi
    fi
}

# ---------- 启动 HTTP 服务器 ----------
start_server() {
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  MarkFlowy v${MARKFLOWY_VERSION}${NC}"
    echo -e "${BOLD}  轻量级 Markdown 编辑器${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # 尝试打开浏览器
    open_browser() {
        sleep 1.5
        if command -v open &>/dev/null; then
            open "http://localhost:${PORT}"
        elif command -v xdg-open &>/dev/null; then
            xdg-open "http://localhost:${PORT}"
        elif command -v sensible-browser &>/dev/null; then
            sensible-browser "http://localhost:${PORT}"
        fi
    }

    # 优先级: npx serve > python3 > python2
    if command -v npx &>/dev/null; then
        info "使用 serve 启动 HTTP 服务器 (端口 ${PORT})..."
        info "访问 http://localhost:${PORT}"
        info "按 Ctrl+C 停止服务器"
        echo ""
        open_browser &
        exec npx -y serve "$DIST_DIR" -l "$PORT" -s
    elif command -v python3 &>/dev/null; then
        info "使用 Python 3 启动 HTTP 服务器 (端口 ${PORT})..."
        info "访问 http://localhost:${PORT}"
        info "按 Ctrl+C 停止服务器"
        echo ""
        open_browser &
        cd "$DIST_DIR"
        exec python3 -m http.server "$PORT"
    elif command -v python &>/dev/null; then
        info "使用 Python 2 启动 HTTP 服务器 (端口 ${PORT})..."
        info "访问 http://localhost:${PORT}"
        info "按 Ctrl+C 停止服务器"
        echo ""
        open_browser &
        cd "$DIST_DIR"
        exec python -m SimpleHTTPServer "$PORT"
    else
        err "找不到任何可用的 HTTP 服务器"
        err "请安装 Node.js 或 Python"
        exit 1
    fi
}

# ---------- 主流程 ----------
main() {
    echo -e "${BOLD}"
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║     MarkFlowy 环境检测与启动          ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo -e "${NC}"

    # 1. 检测 Node.js
    if check_node; then
        : # Node.js 已就绪
    else
        warn "未检测到 Node.js (需要 ≥ ${MIN_NODE_MAJOR})"
        echo ""
        echo -e "${BOLD}是否自动安装 Node.js？${NC}"
        echo "  [1] 是，自动安装 (推荐)"
        echo "  [2] 跳过，使用 Python 服务器"
        echo "  [3] 退出"
        echo ""
        read -rp "请选择 [1/2/3]: " choice

        case "$choice" in
            1)
                install_node
                ;;
            2)
                warn "跳过 Node.js 安装，将使用 Python 服务器"
                ;;
            *)
                info "已退出"
                exit 0
                ;;
        esac
    fi

    # 2. 自动构建（如果 dist/ 不存在）
    auto_build

    # 3. 启动服务器
    start_server
}

main "$@"
