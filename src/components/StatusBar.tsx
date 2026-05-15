import { useEditorStore } from "../store/editorStore";

export default function StatusBar() {
  const {
    tabs,
    activeTabId,
    editorMode,
    toggleEditorMode,
    focusMode,
    toggleFocusMode,
    historyOpen,
    toggleHistory,
    toggleSettings,
    history,
    saveFile,
    saveAs,
    theme,
  } = useEditorStore();

  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return null;

  const readingTime = Math.ceil(tab.wordCount / 400);

  return (
    <div className="h-8 flex items-center px-3 gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] flex-shrink-0 select-none">
      {/* Left: document name */}
      <span className="truncate max-w-[160px] font-medium">{tab.name}</span>
      {tab.isDirty && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]" title="未保存" />
      )}

      <div className="flex-1" />

      {/* Center: word count + save status */}
      <span>{tab.wordCount} 字</span>
      <span className="text-[var(--border)]">|</span>
      {tab.isDirty ? (
        <span className="text-[var(--warning)]">未保存</span>
      ) : (
        <span className="text-[var(--success)]">已保存</span>
      )}
      <span className="text-[var(--border)]">|</span>
      <span>{history.length} 版本</span>

      <div className="flex-1" />

      {/* Right: action toggles */}
      <button
        onClick={toggleEditorMode}
        className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
          editorMode === "source"
            ? "bg-[var(--accent)] text-white"
            : "hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
        }`}
        title="切换编辑模式 ⌘/"
      >
        {editorMode === "wysiwyg" ? "<>" : "源码"}
      </button>

      <button
        onClick={toggleFocusMode}
        className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
          focusMode
            ? "bg-[var(--accent)] text-white"
            : "hover:bg-[var(--bg-primary)]"
        }`}
        title="专注模式"
      >
        {focusMode ? "退出" : "专注"}
      </button>

      <button
        onClick={toggleSettings}
        className="p-1 rounded hover:bg-[var(--bg-primary)] transition-colors"
        title={`主题 / 设置 (当前: ${theme})`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      <button
        onClick={toggleHistory}
        className={`p-1 rounded transition-colors ${
          historyOpen ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-primary)]"
        }`}
        title="历史记录"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
      </button>

      <span className="text-[var(--border)]">|</span>

      <button
        onClick={() => activeTabId && saveFile(activeTabId)}
        className="hover:text-[var(--accent)] transition-colors px-1.5 py-0.5 rounded text-xs"
        title="保存 ⌘S"
      >
        保存
      </button>
    </div>
  );
}