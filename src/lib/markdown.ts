import MarkdownIt from "markdown-it";
import { DOMParser } from "prosemirror-model";
import { editorSchema } from "./schema";

// markdown-it instance (commonmark + tables + strikethrough)
const md = new MarkdownIt("commonmark", {
  html: false,
  linkify: true,
  breaks: false,
}).enable(["table", "strikethrough"]);

// Override table renderer: markdown-it defaults to <thead>/<tbody> wrappers
// which ProseMirror DOMParser can't handle. Output flat <table><tr>... instead.
// @ts-ignore - renderer override
md.renderer.rules.table_open = () => "<table>";
// @ts-ignore
md.renderer.rules.table_close = () => "</table>";
// @ts-ignore
md.renderer.rules.thead_open = () => "";
// @ts-ignore
md.renderer.rules.thead_close = () => "";
// @ts-ignore
md.renderer.rules.tbody_open = () => "";
// @ts-ignore
md.renderer.rules.tbody_close = () => "";
// @ts-ignore
md.renderer.rules.tfoot_open = () => "";
// @ts-ignore
md.renderer.rules.tfoot_close = () => "";

// ── Markdown → ProseMirror doc ──────────────────────────────
export function parseMarkdown(text: string) {
  const html = md.render(text);
  return parseHTMLToDoc(html);
}

// Lightweight HTML string → ProseMirror doc (handles what markdown-it produces)
function parseHTMLToDoc(html: string): import("prosemirror-model").Node {
  const div = document.createElement("div");
  div.innerHTML = html;
  return DOMParser.fromSchema(editorSchema).parse(div);
}

// ── ProseMirror doc → Markdown ──────────────────────────────
export function serializeToMarkdown(doc: import("prosemirror-model").Node): string {
  const lines: string[] = [];

  function out(text: string, indent = "") {
    if (text) lines.push(indent + text);
  }

  function blockChildren(parent: import("prosemirror-model").Node, indent = "") {
    parent.forEach((child) => serializeNode(child, indent));
  }

  function inlineContent(node: import("prosemirror-model").Node): string {
    let text = "";
    node.forEach((child) => {
      if (child.isText) {
        let t = child.text || "";
        for (const mark of [...child.marks].reverse()) {
          switch (mark.type.name) {
            case "strong": t = `**${t}**`; break;
            case "em": t = `*${t}*`; break;
            case "code": t = `\`${t}\``; break;
            case "strikethrough": t = `~~${t}~~`; break;
            case "link":
              t = `[${t}](${mark.attrs.href || ""})`;
              break;
          }
        }
        text += t;
      } else if (child.type.name === "image") {
        text += `![${child.attrs.alt || ""}](${child.attrs.src || ""})`;
      } else if (child.type.name === "hard_break") {
        text += "\n";
      }
    });
    return text;
  }

  /** Serialize a single list_item with marker and optional nested lists */
  function serializeListItem(
    item: import("prosemirror-model").Node,
    marker: string,
    indent: string,
    markerLen: number,
  ) {
    const children: Array<import("prosemirror-model").Node> = [];
    item.forEach((c) => children.push(c));

    let first = true;
    let pendingNested: Array<import("prosemirror-model").Node> = [];

    for (const child of children) {
      if (child.type.name === "bullet_list" || child.type.name === "ordered_list") {
        pendingNested.push(child);
      } else {
        // Flush any preceding text
        if (first) {
          const content = inlineContent(child);
          const lines = content.split("\n");
          for (let li = 0; li < lines.length; li++) {
            if (li === 0) {
              out(marker + " " + lines[li], indent);
            } else {
              out(" ".repeat(markerLen + 1) + lines[li], indent);
            }
          }
          first = false;
        } else {
          out(inlineContent(child), indent + " ".repeat(markerLen + 1));
        }
      }
    }

    // Serialize nested lists with increased indent
    const nestedIndent = indent + " ".repeat(markerLen + 1);
    for (const nested of pendingNested) {
      serializeNode(nested, nestedIndent);
    }
  }

  function serializeNode(node: import("prosemirror-model").Node, indent = "") {
    if (node.isInline) {
      if (node.type.name === "image") {
        out(`![${node.attrs.alt || ""}](${node.attrs.src || ""})`, indent);
      }
      return;
    }

    switch (node.type.name) {
      case "doc":
        blockChildren(node);
        break;

      case "paragraph": {
        const text = inlineContent(node);
        if (!text.trim()) { out(""); return; }
        out(text, indent);
        break;
      }

      case "heading": {
        const level = node.attrs.level || 1;
        out("#".repeat(level) + " " + inlineContent(node), indent);
        break;
      }

      case "code_block": {
        const lang = node.attrs.language || "";
        out("```" + lang + "\n" + node.textContent + "\n```", indent);
        break;
      }

      case "blockquote": {
        // Use blockChildren directly to avoid infinite recursion
        node.forEach((child) => {
          const childText = serializeToMarkdown(child);
          childText.split("\n").forEach((line) => out("> " + line, indent));
        });
        break;
      }

      case "horizontal_rule":
        out("---", indent);
        break;

      case "bullet_list":
        node.forEach((item) => serializeListItem(item, "-", indent, 2));
        break;

      case "ordered_list":
        node.forEach((item, i) => {
          serializeListItem(item, `${(node.attrs.start || 1) + i}.`, indent, 3);
        });
        break;

      case "list_item":
        blockChildren(node, indent);
        break;

      case "table": {
        node.forEach((row, rowIdx) => {
          const cells: string[] = [];
          row.forEach((cell) => {
            const isHeader = cell.type.name === "table_header";
            let text = "";
            cell.forEach((n) => {
              if (n.isTextblock) {
                n.forEach((inline) => {
                  if (inline.isText) {
                    let t = inline.text || "";
                    for (const mark of [...inline.marks].reverse()) {
                      switch (mark.type.name) {
                        case "strong": t = `**${t}**`; break;
                        case "em": t = `*${t}*`; break;
                        case "code": t = `\`${t}\``; break;
                        case "link": t = `[${t}](${mark.attrs.href})`; break;
                        case "strikethrough": t = `~~${t}~~`; break;
                      }
                    }
                    text += t;
                  }
                });
              }
            });
            cells.push(text || " ");
          });
          out("| " + cells.join(" | ") + " |", indent);
          if (rowIdx === 0) {
            out("| " + cells.map(() => "---").join(" | ") + " |", indent);
          }
        });
        out("");
        break;
      }

      case "table_row":
      case "table_cell":
      case "table_header":
        // Handled by table serializer
        break;

      default: {
        // Fallback: try inline content
        const text = inlineContent(node);
        if (text.trim()) out(text, indent);
      }
    }
  }

  serializeNode(doc);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
