# MarkFlowy

**轻量级 Markdown 编辑器** — 类 Typora 的所见即所得写作体验，纯浏览器运行，无需后端。

[在线体验](#) | [功能特性](#功能特性) | [安装使用](#安装使用) | [客户部署](#客户部署) | [技术栈](#技术栈)

---

## ✨ 功能特性

### 📝 编辑器核心
- **所见即所得 (WYSIWYG)** — 像 Word 一样写作，Markdown 语法自动渲染
- **源码模式** — 按 `⌘/` 随时切换到纯 Markdown 源码编辑
- **实时预览** — 编辑即渲染，无需分屏
- **完整 Markdown 支持** — 标题、列表、引用、代码块、表格、图片、链接等

### 🎨 格式化工具
- 标题 1-3 级快捷键 (`⌘1/2/3`)
- 加粗 (`⌘B`)、斜体 (`⌘I`)、删除线 (`⌘⇧X`)
- 行内代码 (`` ⌘` ``)、链接 (`⌘K`)
- 有序/无序列表、引用块、代码块
- 表格编辑（插入行列、合并单元格）

### 📂 文件管理
- 打开本地文件夹（File System Access API）
- 多标签页编辑
- 自动保存（可配置间隔）
- 版本历史（基于 Git 快照）
- 差异对比与版本恢复

### 🎯 用户体验
- 5 种主题：浅色、深色、跟随系统、GitHub 浅色/深色
- 可调字号（12-32px）和行高（1.4-2.5）
- 专注模式（隐藏侧边栏）
- 键盘快捷键完整支持

### 🔒 浏览器兼容
- **Chrome / Edge** — 完整功能（File System Access API）
- **Firefox / Safari** — 内存模式 + IndexedDB 持久化

---

## 🚀 安装使用

### 方式一：直接使用（推荐）

```bash
# 克隆仓库
git clone https://github.com/your-username/markflowy.git
cd markflowy

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 方式二：静态部署

构建后将 `dist/` 目录部署到任意静态托管服务：

```bash
npm run build
# 将 dist/ 目录上传到 Vercel / Netlify / GitHub Pages 等
```

---

## 📦 客户部署（零环境一键启动）

### 打包分发包

```bash
npm run package
# 产物: markflowy-<version>-portable.zip (仅 ~300KB)
```

### 客户使用

**macOS / Linux:**
```bash
# 解压后运行
./start.sh
```

**Windows:**
```cmd
:: 双击 start.bat 或在 PowerShell 中运行:
powershell -ExecutionPolicy Bypass -File start.ps1
```

### 自动环境检测流程

启动脚本会按以下优先级自动检测并处理：

```
1. 检查 Node.js ≥ 18
   ├── 已安装 → 使用 npx serve 启动 (最佳体验)
   └── 未安装 → 提示安装
       ├── [推荐] fnm 自动安装 Node.js LTS
       ├── [备选] nvm 安装
       ├── [备选] winget 安装 (Windows)
       └── [兜底] 直接下载 Node.js 二进制包

2. Node.js 不可用时降级
   ├── Python 3 → python3 -m http.server
   ├── Python 2 → python -m SimpleHTTPServer
   └── .NET 内置 → 仅 Windows PowerShell (start.ps1)

3. 自动打开浏览器访问 http://localhost:3000
```

### 系统要求

| 环境 | 要求 | 用途 |
|------|------|------|
| **浏览器** | Chrome 86+ / Edge 86+ | File System Access API（完整功能） |
| **浏览器** | Firefox / Safari | 内存模式（功能受限） |
| **Node.js** | ≥ 18 | HTTP 服务器（推荐，脚本可自动安装） |
| **Python** | 3.x / 2.7 | HTTP 服务器（备选） |

---

## 🛠 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 框架 | React 18 | UI 组件化 |
| 状态管理 | Zustand | 轻量全局状态 |
| 编辑器引擎 | ProseMirror | 所见即所得编辑 |
| Markdown 解析 | markdown-it | 解析与渲染 |
| 版本历史 | isomorphic-git + IndexedDB | Git 快照 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 构建工具 | Vite | 快速开发与构建 |

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘S` | 保存文件 |
| `⌘⇧S` | 另存为 |
| `⌘N` | 新建文件 |
| `⌘O` | 打开文件夹 |
| `⌘W` | 关闭标签页 |
| `⌘E` | 导出文件 |
| `⌘/` | 切换源码模式 |
| `⌘B` | 加粗 |
| `⌘I` | 斜体 |
| `⌘⇧X` | 删除线 |
| `` ⌘` `` | 行内代码 |
| `⌘K` | 插入链接 |
| `⌘1/2/3` | 标题 1/2/3 |
| `⌘0` | 正文 |
| `⌘Z` | 撤销 |
| `⌘⇧Z` | 重做 |

---

## 📦 项目结构

```
markflowy/
├── src/
│   ├── components/       # React 组件
│   │   ├── Editor.tsx    # 编辑器主组件
│   │   ├── Toolbar.tsx   # 工具栏
│   │   ├── Sidebar.tsx   # 文件树侧边栏
│   │   ├── TabBar.tsx    # 标签栏
│   │   ├── HistoryPanel.tsx  # 历史记录面板
│   │   └── SettingsPanel.tsx # 设置面板
│   ├── lib/
│   │   ├── filesystem.ts # 文件系统抽象层
│   │   ├── git.ts        # Git 版本历史
│   │   ├── markdown.ts   # Markdown 解析/序列化
│   │   ├── schema.ts     # ProseMirror schema
│   │   └── editorView.ts # 编辑器实例管理
│   ├── store/
│   │   └── editorStore.ts # Zustand 全局状态
│   ├── App.tsx           # 根组件
│   └── main.tsx          # 入口文件
├── start.sh              # macOS/Linux 一键启动 (自动检测环境)
├── start.bat             # Windows 批处理启动
├── start.ps1             # Windows PowerShell 启动 (功能更强)
├── package.sh            # 构建并打包为分发包
├── public/
├── package.json
└── README.md
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 许可证

[MIT License](LICENSE) © 2026 MarkFlowy

---

## 🙏 致谢

- [ProseMirror](https://prosemirror.net/) — 强大的富文本编辑框架
- [Typora](https://typora.io/) — 设计灵感来源
- [isomorphic-git](https://isomorphic-git.org/) — 纯 JavaScript Git 实现
