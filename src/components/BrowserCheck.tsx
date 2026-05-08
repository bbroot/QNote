import { useState, useEffect } from "react";
import { hasFileSystemAccess } from "../lib/filesystem";

interface Props {
  children: React.ReactNode;
}

export default function BrowserCheck({ children }: Props) {
  const [browserOk, setBrowserOk] = useState<boolean | null>(null);

  useEffect(() => {
    // Check essential browser features for ProseMirror + modern JS
    const hasES2020 = typeof Object.entries === "function";
    const hasIndexedDB = typeof indexedDB !== "undefined";
    const hasAdvancedBlocks = typeof ResizeObserver === "function";
    setBrowserOk(hasES2020 && hasIndexedDB && hasAdvancedBlocks);
  }, []);

  if (browserOk === null) return null; // Still checking

  if (!browserOk) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)] p-8">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">
            浏览器版本过低
          </h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
            MarkFlowy 需要现代浏览器才能运行。请升级到以下任一浏览器：
          </p>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            <li>✅ Chrome 86+ / Edge 86+</li>
            <li>✅ Firefox 111+</li>
            <li>✅ Safari 15.4+ / Opera 72+</li>
          </ul>
        </div>
      </div>
    );
  }

  // Show feature notice for browsers without File System Access API
  const noFSA = !hasFileSystemAccess();

  return (
    <>
      {noFSA && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700 px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-amber-600 dark:text-amber-400">⚠️</span>
          <span className="text-amber-700 dark:text-amber-300">
            当前浏览器不完全支持本地文件夹功能。将使用内存模式，关闭浏览器后文件不会被保存。
            建议使用 Chrome 或 Edge 获得完整支持。
          </span>
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-amber-600 dark:text-amber-400 underline whitespace-nowrap"
          >
            下载 Chrome
          </a>
        </div>
      )}
      <div className={noFSA ? "pb-10" : ""}>{children}</div>
    </>
  );
}
