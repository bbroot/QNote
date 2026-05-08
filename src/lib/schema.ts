import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { tableNodes } from "prosemirror-tables";

export const editorSchema = new Schema({
  nodes: addListNodes(
    basicSchema.spec.nodes.append(
      tableNodes({
        tableGroup: "block",
        cellContent: "block+",
        cellAttributes: {
          background: { default: null },
          colspan: { default: 1 },
          rowspan: { default: 1 },
        },
      })
    ),
    "paragraph block*",
    "block"
  ),
  marks: basicSchema.spec.marks.append({
    strikethrough: {
      parseDOM: [
        { tag: "s" },
        { tag: "del" },
        { tag: "strike" },
        { style: "text-decoration=line-through" },
      ],
      toDOM() {
        return ["s", 0];
      },
    },
  }),
});
