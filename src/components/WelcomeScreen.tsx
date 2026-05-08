import { useEditorStore } from "../store/editorStore";

export default function WelcomeScreen() {
  const { setWorkspace, openFileExternal } = useEditorStore();

  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="text-center max-w-md px-8">
        <div className="text-6xl mb-6">📝</div>
        <h1 className="text-2xl font-bold mb-2">欢迎使用 MarkFlowy</h1>
        <p className="text-[var(--text-secondary)] mb-8 text-sm leading-relaxed">
          轻量、快速、有记忆的 Markdown 编辑器。
          <br />
          类 Typora 体验，自动保存历史版本。
        </p>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setWorkspace()}
            className="px-8 py-3 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/20"
          >
            📂 打开文件夹
          </button>
          <button
            onClick={() => openFileExternal()}
            className="px-6 py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl text-sm hover:border-[var(--accent)] transition-colors"
          >
            📄 打开文件
          </button>
        </div>

        <div className="mt-4 mb-8 text-xs text-[var(--text-secondary)]">
          需要 Chrome / Edge 浏览器支持（File System Access API）
        </div>

        <div className="grid grid-cols-3 gap-6 text-left">
          {[
            {
              icon: "⚡",
              title: "所见即所得",
              desc: "输入即渲染，类 Typora 体验",
            },
            {
              icon: "📜",
              title: "版本历史",
              desc: "每次保存自动快照，随时恢复",
            },
            { icon: "🌙", title: "双主题", desc: "浅色 / 深色 / 跟随系统" },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-medium mb-1">{item.title}</div>
              <div className="text-xs text-[var(--text-secondary)]">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
