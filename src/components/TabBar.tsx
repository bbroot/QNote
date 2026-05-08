import { useEditorStore } from "../store/editorStore";

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  const handleClose = (tabId: string, isDirty: boolean) => {
    if (isDirty) {
      const confirmed = confirm("当前文件有未保存的更改，确定关闭吗？");
      if (!confirmed) return;
    }
    closeTab(tabId);
  };

  return (
    <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg-secondary)] overflow-x-auto flex-shrink-0 select-none"
      style={{ height: "36px" }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center gap-1.5 px-3 h-full border-r border-[var(--border)] cursor-pointer text-sm transition-colors min-w-[100px] max-w-[180px] group ${
            activeTabId === tab.id
              ? "bg-[var(--bg-primary)] border-b-2 border-b-[var(--accent)]"
              : "hover:bg-[var(--bg-primary)]"
          }`}
          onClick={() => setActiveTab(tab.id)}
          onMouseDown={(e) => {
            // Middle click to close
            if (e.button === 1) {
              e.preventDefault();
              handleClose(tab.id, tab.isDirty);
            }
          }}
        >
          {tab.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] flex-shrink-0" title="未保存" />
          )}
          <span className="truncate flex-1">{tab.name}</span>
          <button
            className="opacity-0 group-hover:opacity-100 hover:bg-[var(--border)] rounded p-0.5 transition-opacity"
            onClick={(e) => { e.stopPropagation(); handleClose(tab.id, tab.isDirty); }}
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
