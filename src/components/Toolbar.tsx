import { useEffect, useState, useCallback } from "react";
import { EditorState } from "prosemirror-state";
import { toggleMark, setBlockType, wrapIn, wrapInList } from "./ToolbarCommands";
import {
  isInTable,
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
  mergeCells,
} from "prosemirror-tables";
import { getEditorView } from "../lib/editorView";
import { editorSchema } from "../lib/schema";

/* ─── Tiny SVG Icon Components ──────────────────────────── */

const Icon = ({
  d,
  size = 16,
  strokeW = 1.8,
}: {
  d: string;
  size?: number;
  strokeW?: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  bold: "M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z",
  italic: "M19 4h-9 M14 20H5 M15 4L9 20",
  strike: "M17.3 4.9c-1.3-1.1-3.1-1.6-5.3-1.1C10 4.2 8.5 5.6 8.3 7.3 M4 12h16 M4 12c1 3 4 5.5 7 5.5 3.5 0 6-2 7-4.5",
  code: "M16 18l6-6-6-6 M8 6l-6 6 6 6",
  h1: "M4 12h8 M4 18V6 M12 18V6 M20 18v-6 M23 18l-3-6-3 6",
  h2: "M4 12h8 M4 18V6 M12 18V6 M17 12l3-6 3 6 M20 6v12",
  h3: "M4 12h8 M4 18V6 M12 18V6 M20 18l-3-3 3-3 M17 21l3-3",
  quote: "M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  codeBlock: "M8 6L2 12l6 6 M16 6l6 6-6 6 M14 4l-4 16",
  hr: "M3 12h18",
  ul: "M9 6l6 6-6 6 M21 6l-6 6 6 6",
  ol: "M12 6v12 M8 6l4 6-4 6 M16 6l-4 6 4 6",
  task: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  image: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z M8.5 14.5l2.5 3 3.5-4.5 4.5 6",
  table: "M3 3h18v18H3zM3 9h18 M3 15h18 M9 3v18 M15 3v18",
  rowAbove: "M12 5v14 M5 5l7-7 7 7",
  rowBelow: "M12 19V5 M5 19l7 7 7-7",
  colBefore: "M5 12h14 M5 5l-7 7 7 7",
  colAfter: "M19 12H5 M19 5l7 7-7 7",
  rowDel: "M7 12h10 M12 7v10",
  colDel: "M12 7v10 M7 12h10",
  tableDel: "M18 6L6 18 M6 6l12 12",
  merge: "M8 8l8 8 M16 8l-8 8",
  headerRow: "M3 12h18 M3 12V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6 M3 12h18",
};

/* ─── Toolbar Button ────────────────────────────────────── */

function TBtn({
  icon,
  label,
  title,
  onClick,
  active,
}: {
  icon?: string;
  label?: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={`toolbar-btn ${active ? "toolbar-btn-active" : ""}`}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {icon ? <Icon d={icon} size={15} /> : null}
      {label ? <span className="toolbar-label">{label}</span> : null}
    </button>
  );
}

function Divider() {
  return <div className="toolbar-divider" />;
}

/* ─── Main Toolbar ──────────────────────────────────────── */

export default function Toolbar() {
  const [inTable, setInTable] = useState(false);
  const [activeMarks, setActiveMarks] = useState<Set<string>>(new Set());
  const [activeBlock, setActiveBlock] = useState<string | null>(null);

  // Track active marks and block type
  useEffect(() => {
    const interval = setInterval(() => {
      const view = getEditorView();
      if (!view) return;
      
      const { state } = view;
      const { from, $from, to, empty } = state.selection;
      
      // Check if in table
      const nowInTable = isInTable(state);
      if (nowInTable !== inTable) setInTable(nowInTable);
      
      // Get active marks
      const marks = new Set<string>();
      if (empty) {
        // Cursor position - check marks at cursor
        $from.marks().forEach((m) => marks.add(m.type.name));
      } else {
        // Selection range - check marks across selection
        state.doc.nodesBetween(from, to, (node) => {
          if (node.marks) {
            node.marks.forEach((m) => marks.add(m.type.name));
          }
        });
      }
      setActiveMarks(marks);
      
      // Get active block type
      const blockType = $from.parent.type.name;
      if (blockType === "heading") {
        setActiveBlock(`heading${$from.parent.attrs.level}`);
      } else {
        setActiveBlock(blockType);
      }
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unified handler: arrow fns like ({state, dispatch}) => ... have length=1
  // ProseMirror commands like wrapIn(...) have length=2 and expect (state, dispatch?)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = useCallback((cmd: any) => {
    const view = getEditorView();
    if (!view) return false;
    const { state, dispatch } = view;
    const result = typeof cmd === "function" && cmd.length === 1
      ? cmd({ state, dispatch })
      : cmd(state, dispatch);
    if (result) view.focus();
    return result;
  }, []);

  const insertImage = useCallback(() => {
    const view = getEditorView();
    if (!view) return;
    // Create hidden file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const node = editorSchema.nodes.image.create({ src, alt: file.name });
        const tr = view.state.tr.replaceSelectionWith(node);
        view.dispatch(tr);
        view.focus();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const insertImageURL = useCallback(() => {
    const url = prompt("图片 URL:");
    if (!url) return;
    const alt = prompt("图片描述 (可选):") || "";
    run(({ state, dispatch }: { state: EditorState; dispatch: any }) => {
      const node = editorSchema.nodes.image.create({ src: url, alt });
      const tr = state.tr.replaceSelectionWith(node);
      dispatch(tr);
      return true;
    });
  }, [run]);

  const insertTable = useCallback(() => {
    run(({ state, dispatch }: { state: EditorState; dispatch: any }) => {
      const { table_cell: cell, table_header: header, table_row: row, table } = editorSchema.nodes;
      // Use non-breaking space to ensure cells render correctly
      const emptyCell = () => [editorSchema.nodes.paragraph.create(null, [editorSchema.text("\u00A0")])];
      const tableNode = table.create(
        null,
        [
          row.create(null, [
            header.create(null, emptyCell()),
            header.create(null, emptyCell()),
            header.create(null, emptyCell()),
          ]),
          row.create(null, [
            cell.create(null, emptyCell()),
            cell.create(null, emptyCell()),
            cell.create(null, emptyCell()),
          ]),
        ]
      );
      const tr = state.tr.replaceSelectionWith(tableNode);
      dispatch(tr);
      return true;
    });
  }, [run]);

  return (
    <div className="toolbar-container">
      {/* Formatting toolbar */}
      <div className="toolbar-row">
        {/* Headings */}
        <TBtn icon={icons.h1} label="H1" title="一级标题 ⌘1" active={activeBlock === "heading1"} onClick={() => run(setBlockType(editorSchema.nodes.heading, { level: 1 }))} />
        <TBtn icon={icons.h2} label="H2" title="二级标题 ⌘2" active={activeBlock === "heading2"} onClick={() => run(setBlockType(editorSchema.nodes.heading, { level: 2 }))} />
        <TBtn icon={icons.h3} label="H3" title="三级标题 ⌘3" active={activeBlock === "heading3"} onClick={() => run(setBlockType(editorSchema.nodes.heading, { level: 3 }))} />

        <Divider />

        {/* Text formatting */}
        <TBtn icon={icons.bold} title="加粗 ⌘B" active={activeMarks.has("strong")} onClick={() => run((p: any) => toggleMark(editorSchema.marks.strong)(p.state, p.dispatch))} />
        <TBtn icon={icons.italic} title="斜体 ⌘I" active={activeMarks.has("em")} onClick={() => run((p: any) => toggleMark(editorSchema.marks.em)(p.state, p.dispatch))} />
        <TBtn icon={icons.strike} title="删除线 ⌘⇧S" active={activeMarks.has("strikethrough")} onClick={() => run((p: any) => toggleMark(editorSchema.marks.strikethrough)(p.state, p.dispatch))} />
        <TBtn icon={icons.code} title="行内代码 ⌘`" active={activeMarks.has("code")} onClick={() => run((p: any) => toggleMark(editorSchema.marks.code)(p.state, p.dispatch))} />

        <Divider />

        {/* Block elements */}
        <TBtn icon={icons.quote} title="引用块 ⌘⇧Q" active={activeBlock === "blockquote"} onClick={() => run(wrapIn(editorSchema.nodes.blockquote))} />
        <TBtn icon={icons.codeBlock} title="代码块 ⌘⇧K" active={activeBlock === "code_block"} onClick={() => run(setBlockType(editorSchema.nodes.code_block))} />
        <TBtn icon={icons.hr} title="分割线" onClick={() => run((p: any) => { p.dispatch(p.state.tr.replaceSelectionWith(editorSchema.nodes.horizontal_rule.create())); return true; })} />

        <Divider />

        {/* Lists */}
        <TBtn icon={icons.ul} title="无序列表" active={activeBlock === "bullet_list"} onClick={() => run(wrapInList(editorSchema.nodes.bullet_list))} />
        <TBtn icon={icons.ol} title="有序列表" active={activeBlock === "ordered_list"} onClick={() => run(wrapInList(editorSchema.nodes.ordered_list))} />

        <Divider />

        {/* Insert */}
        <TBtn icon={icons.link} title="链接 ⌘K" active={activeMarks.has("link")} onClick={() => run((p: any) => {
          const url = prompt("链接地址:");
          if (!url) return false;
          const { from, to } = p.state.selection;
          const mark = editorSchema.marks.link.create({ href: url });
          p.dispatch(p.state.tr.addMark(from, to, mark));
          return true;
        })} />
        <TBtn icon={icons.image} title="图片" onClick={insertImage} />
        <TBtn icon={icons.table} title="表格" active={inTable} onClick={insertTable} />
      </div>

      {/* Table toolbar (conditional) */}
      {inTable && (
        <div className="toolbar-row toolbar-table-row">
          <TBtn icon={icons.rowAbove} title="在上方插入行" onClick={() => run(addRowBefore)} />
          <TBtn icon={icons.rowBelow} title="在下方插入行" onClick={() => run(addRowAfter)} />
          <TBtn icon={icons.colBefore} title="在左侧插入列" onClick={() => run(addColumnBefore)} />
          <TBtn icon={icons.colAfter} title="在右侧插入列" onClick={() => run(addColumnAfter)} />

          <Divider />

          <TBtn icon={icons.rowDel} title="删除行" onClick={() => run(deleteRow)} />
          <TBtn icon={icons.colDel} title="删除列" onClick={() => run(deleteColumn)} />
          <TBtn icon={icons.tableDel} title="删除表格" onClick={() => run(deleteTable)} />

          <Divider />

          <TBtn icon={icons.merge} title="合并/拆分单元格" onClick={() => run(mergeCells)} />
          <span className="toolbar-info">表格</span>
        </div>
      )}
    </div>
  );
}
