import { useState } from "react";
import { useEditorStore } from "../store/editorStore";

/* ─── Theme definitions ──────────────────────────────────── */
interface ThemeDef {
  id: string;
  label: string;
  icon: string;
}

const themes: ThemeDef[] = [
  { id: "light",       label: "浅色",       icon: "☀️" },
  { id: "github-light", label: "GitHub 浅色", icon: "🐙" },
  { id: "dark",         label: "深色",        icon: "🌙" },
  { id: "github-dark",  label: "GitHub 深色", icon: "🌜" },
  { id: "system",       label: "跟随系统",    icon: "💻" },
];

const fontSizes = [12, 14, 16, 18, 20, 22, 24, 28, 32];
const lineHeights = [1.4, 1.6, 1.8, 2.0, 2.2, 2.5];

export default function SettingsPanel() {
  const {
    theme, fontSize, lineHeight,
    setTheme, setFontSize, setLineHeight,
    autoSaveInterval, toggleSettings,
    tabs, activeTabId, exportFile,
    setAutoSaveInterval,
  } = useEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="w-80 flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-sidebar)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-semibold">设置</span>
        <button
          onClick={toggleSettings}
          className="p-1 rounded hover:bg-[var(--bg-primary)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Theme */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">主题</h3>
          <div className="grid grid-cols-1 gap-1">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  theme === t.id
                    ? "bg-[var(--accent)] text-white"
                    : "hover:bg-[var(--bg-secondary)]"
                }`}
              >
                <span className="text-base">{t.icon}</span>
                <span>{t.label}</span>
                {theme === t.id && (
                  <span className="ml-auto text-xs opacity-60">✓</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Font Size */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">字号</h3>
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-[var(--text-secondary)] w-4" style={{ fontSize: 11 }}>A</span>
            <input
              type="range"
              min="12"
              max="32"
              step="1"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-xs text-[var(--text-secondary)] w-4" style={{ fontSize: 18 }}>A</span>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-xs text-[var(--text-secondary)]">{fontSize}px</span>
            <span
              className="text-xs text-[var(--accent)] font-mono"
              style={{
                fontSize,
                lineHeight: 1.2,
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              MarkFlowy 编辑器
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {fontSizes.map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  fontSize === s
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-secondary)] hover:opacity-80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Line Height */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">行高</h3>
          <div className="flex flex-wrap gap-1.5">
            {lineHeights.map((h) => (
              <button
                key={h}
                onClick={() => setLineHeight(h)}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  lineHeight === h
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-secondary)] hover:opacity-80"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[var(--text-secondary)] px-1 text-sm" style={{ lineHeight }}>
            Markdown 编辑器，专注你的文字表达。
          </p>
        </section>

        {/* Auto Save */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">自动保存</h3>
          <div className="flex items-center gap-3 px-1">
            <input
              type="range"
              min="0"
              max="120"
              step="10"
              value={autoSaveInterval / 1000}
              onChange={(e) => setAutoSaveInterval(parseInt(e.target.value) * 1000)}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-sm w-12 text-right tabular-nums">
              {autoSaveInterval === 0 ? "关闭" : `${autoSaveInterval / 1000}s`}
            </span>
          </div>
        </section>

        {/* Export */}
        {activeTab && (
          <section>
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">导出</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => exportFile(activeTab.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] transition-colors text-left"
              >
                <span>📄</span>
                <span>导出为 Markdown (.md)</span>
              </button>
              <button
                onClick={() => exportFile(activeTab.id, "html")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] transition-colors text-left"
              >
                <span>🌐</span>
                <span>导出为 HTML 网页</span>
              </button>
            </div>
          </section>
        )}

        {/* Keyboard shortcuts reference */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">快捷键</h3>
          <div className="bg-[var(--bg-secondary)] rounded-lg px-3 py-3 text-xs space-y-1.5">
            {[
              ["⌘S", "保存"],
              ["⌘N", "新建文件"],
              ["⌘O", "打开文件夹"],
              ["⌘W", "关闭标签"],
              ["⌘E", "导出文件"],
              ["⌘⇧S", "另存为"],
              ["⌘B", "加粗"],
              ["⌘I", "斜体"],
              ["⌘`", "行内代码"],
              ["⌘K", "插入链接"],
              ["⌘⇧X", "删除线"],
              ["⌘1/2/3", "标题 1/2/3"],
              ["⌘0", "正文"],
              ["⌘/", "切换源码"],
              ["⌘Z", "撤销"],
              ["⌘⇧Z", "重做"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">{desc}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[10px]">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">关于</h3>
          <div className="bg-[var(--bg-secondary)] rounded-lg px-3 py-3 text-xs space-y-1">
            <div className="font-semibold text-base">MarkFlowy</div>
            <div className="text-[var(--text-secondary)]">轻量 Markdown 编辑器</div>
            <div className="text-[var(--text-secondary)]">版本 0.2.0</div>
            <div className="text-[var(--text-secondary)] mt-2">技术栈：React + ProseMirror + Zustand</div>
            <div className="text-[var(--text-secondary)]">支持：macOS / Windows / Linux</div>
            <div className="text-[var(--text-secondary)]">浏览器：Chrome / Edge / Firefox / Safari</div>
          </div>
        </section>
      </div>
    </div>
  );
}
