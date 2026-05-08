import { useEditorStore } from "../store/editorStore";

export default function StatusBar() {
  const { tabs, activeTabId, editorMode, toggleEditorMode, history, saveFile, saveAs } = useEditorStore();
  const tab = tabs.find((t) => t.id === activeTabId);

  if (!tab) return null;

  const readingTime = Math.ceil(tab.wordCount / 400);

  return (
    <div className="h-6 flex items-center px-4 gap-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] flex-shrink-0 select-none">
      <span>{tab.wordCount} 字</span>
      <span className="text-[var(--border)]">|</span>
      <span>{readingTime} 分钟阅读</span>
      <div className="flex-1" />
      {tab.isDirty ? (
        <span className="text-[var(--warning)]">● 未保存</span>
      ) : (
        <span className="text-[var(--success)]">✓ 已保存</span>
      )}
      <span className="text-[var(--border)]">|</span>
      <span>{history.length} 个历史版本</span>
      <span className="text-[var(--border)]">|</span>
      <button
        onClick={toggleEditorMode}
        className="hover:text-[var(--text-primary)] transition-colors"
        title="切换编辑模式 (Ctrl+/)"
      >
        {editorMode === "wysiwyg" ? "WYSIWYG" : "源码"}
      </button>
      <button
        onClick={() => activeTabId && saveFile(activeTabId)}
        className="hover:text-[var(--accent)] transition-colors"
        title="保存 (⌘S)"
      >
        保存
      </button>
      <span className="text-[var(--border)]">|</span>
      <button
        onClick={() => activeTabId && saveAs(activeTabId)}
        className="hover:text-[var(--text-primary)] transition-colors"
        title="另存为 (⌘⇧S)"
      >
        另存为
      </button>
    </div>
  );
}
