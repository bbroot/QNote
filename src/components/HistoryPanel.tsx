import { useState } from "react";
import { useEditorStore, HistoryEntry } from "../store/editorStore";

export default function HistoryPanel() {
  const {
    history,
    tabs,
    activeTabId,
    toggleHistory,
    restoreVersion,
    loadHistory,
    cleanupHistory,
    getDiff,
  } = useEditorStore();
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<
    { type: string; text: string; key: number }[]
  >([]);
  const [viewMode, setViewMode] = useState<"inline" | "split">("inline");
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSelect = async (entry: HistoryEntry) => {
    setSelectedHash(entry.hash);
    if (!activeTab) return;
    try {
      const diff = await getDiff(activeTab.path, entry.hash);
      let lineKey = 0;
      const lines = diff.content
        .split("\n")
        .map((line: string) => ({
          type: line.startsWith("+")
            ? "added"
            : line.startsWith("-")
              ? "removed"
              : "context",
          text: line,
          key: ++lineKey,
        }));
      setDiffLines(lines);
    } catch (e) {
      console.error("Failed to get diff:", e);
    }
  };

  const handleRestore = async () => {
    if (!selectedHash) return;
    if (confirm("确定恢复到该版本？当前内容将自动备份为新版本。")) {
      await restoreVersion(selectedHash);
      setSelectedHash(null);
      setDiffLines([]);
    }
  };

  const handleCleanup = async () => {
    if (!activeTab) return;
    const keep = prompt("保留最近几个版本？", "10");
    if (!keep) return;
    const num = parseInt(keep);
    if (isNaN(num) || num < 1) return;
    await cleanupHistory(activeTab.path, num);
  };

  // Group by day
  const grouped: { label: string; entries: HistoryEntry[] }[] = [];
  const now = new Date();
  let lastDate = "";
  for (const entry of history) {
    const d = new Date(entry.timestamp * 1000);
    const dateStr = d.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
    const today = d.toDateString() === now.toDateString();
    const label = today ? "今天" : dateStr;
    if (label !== lastDate) {
      grouped.push({ label, entries: [] });
      lastDate = label;
    }
    grouped[grouped.length - 1].entries.push(entry);
  }

  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-sidebar)] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          历史记录
        </span>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={handleCleanup}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
              title="清理历史"
            >
              清理
            </button>
          )}
          <button
            onClick={toggleHistory}
            className="p-1 rounded hover:bg-[var(--bg-primary)] transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {!activeTab ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm p-6 text-center">
          <div>
            <div className="text-3xl mb-2">📜</div>
            <p>打开文档后查看历史记录</p>
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm p-6 text-center">
          <div>
            <div className="text-3xl mb-2">📜</div>
            <p>暂无历史记录</p>
            <p className="text-xs mt-1">保存文件后自动生成</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden flex-col">
          {/* Timeline */}
          <div className="overflow-y-auto flex-1">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] sticky top-0 z-10">
                  {group.label}
                </div>
                {group.entries.map((entry) => (
                  <div
                    key={entry.hash}
                    className={`history-item mx-1 ${
                      selectedHash === entry.hash ? "active" : ""
                    }`}
                    onClick={() => handleSelect(entry)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs truncate">{entry.summary}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {entry.hash}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Diff preview */}
          {diffLines.length > 0 && (
            <div
              className="border-t border-[var(--border)] flex flex-col"
              style={{ maxHeight: "45%" }}
            >
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)] flex-shrink-0">
                <span className="text-xs font-medium">差异预览</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setViewMode("inline")}
                    className={`text-xs px-2 py-0.5 rounded ${viewMode === "inline" ? "bg-[var(--accent)] text-white" : ""}`}
                  >
                    内联
                  </button>
                  <button
                    onClick={handleRestore}
                    className="text-xs px-2 py-0.5 rounded bg-[var(--success)] text-white hover:opacity-80"
                  >
                    恢复
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto p-2 font-mono text-xs leading-6">
                {diffLines.map((line) => (
                  <div
                    key={line.key}
                    className={
                      line.type === "added"
                        ? "diff-added px-2"
                        : line.type === "removed"
                          ? "diff-removed px-2"
                          : "px-2 text-[var(--text-secondary)]"
                    }
                  >
                    <span className="select-all">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
