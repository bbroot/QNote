import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",  // 支持 file:// 协议直接打开
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core editor
          prosemirror: [
            "prosemirror-state",
            "prosemirror-view",
            "prosemirror-model",
            "prosemirror-keymap",
            "prosemirror-commands",
            "prosemirror-history",
            "prosemirror-dropcursor",
            "prosemirror-gapcursor",
            "prosemirror-tables",
            "prosemirror-inputrules",
            "prosemirror-schema-list",
            "prosemirror-schema-basic",
          ],
          // Markdown parsing
          markdown: [
            "prosemirror-markdown",
            "markdown-it",
            "diff",
          ],
          // Git / version control
          git: [
            "isomorphic-git",
          ],
          // UI
          ui: [
            "react",
            "react-dom",
            "zustand",
            "clsx",
            "lucide-react",
          ],
          // Syntax highlighting
          shiki: [
            "shiki",
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "prosemirror-state",
      "prosemirror-view",
      "prosemirror-model",
      "markdown-it",
      "diff",
      "isomorphic-git",
    ],
  },
  // Browser target — no Node.js shims
  define: {
    global: "globalThis",
  },
});
