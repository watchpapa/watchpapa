import { useRef } from "react";

// Inserts or wraps markdown syntax around the current selection in a textarea.
function applyFormat(textarea, type) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);

  const WRAPPERS = {
    bold:          { before: "**", after: "**",  placeholder: "bold text" },
    italic:        { before: "_",  after: "_",   placeholder: "italic text" },
    strike:        { before: "~~", after: "~~",  placeholder: "strikethrough" },
    inlineCode:    { before: "`",  after: "`",   placeholder: "code" },
    link:          { before: "[",  after: "](url)", placeholder: "link text" },
  };

  const LINE_PREFIXES = {
    h1: "# ", h2: "## ", h3: "### ",
    bulletList: "- ", numberedList: "1. ", blockquote: "> ",
  };

  if (WRAPPERS[type]) {
    const { before, after, placeholder } = WRAPPERS[type];
    const text = selected || placeholder;
    const replacement = `${before}${text}${after}`;
    const nextStart = start + before.length;
    const nextEnd = nextStart + text.length;
    insertAt(textarea, start, end, replacement, nextStart, nextEnd);
    return;
  }

  if (type === "codeBlock") {
    const text = selected || "code here";
    const replacement = `\`\`\`\n${text}\n\`\`\``;
    insertAt(textarea, start, end, replacement, start + 4, start + 4 + text.length);
    return;
  }

  if (type === "hr") {
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const insertion = `${prefix}\n---\n\n`;
    insertAt(textarea, start, start, insertion, start + insertion.length, start + insertion.length);
    return;
  }

  if (LINE_PREFIXES[type]) {
    const prefix = LINE_PREFIXES[type];
    // Find start of the current line.
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = end;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const newLines = lines.map((l) => prefix + l);
    const replacement = newLines.join("\n");
    const nextPos = lineStart + replacement.length;
    insertAt(textarea, lineStart, lineEnd, replacement, nextPos, nextPos);
  }
}

function insertAt(textarea, start, end, text, selStart, selEnd) {
  const { value } = textarea;
  const next = value.slice(0, start) + text + value.slice(end);
  // Use execCommand for undo history support, fall back to direct value mutation.
  textarea.focus();
  textarea.setSelectionRange(start, end);
  const ok = document.execCommand("insertText", false, text);
  if (!ok) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, next);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  textarea.setSelectionRange(selStart, selEnd);
}

const TOOLBAR = [
  [
    { type: "bold",         label: "B",   title: "Bold",         className: "font-bold" },
    { type: "italic",       label: "I",   title: "Italic",       className: "italic" },
    { type: "strike",       label: "S",   title: "Strikethrough",className: "line-through" },
  ],
  [
    { type: "h1",  label: "H1", title: "Heading 1" },
    { type: "h2",  label: "H2", title: "Heading 2" },
    { type: "h3",  label: "H3", title: "Heading 3" },
  ],
  [
    { type: "bulletList",   label: "•—", title: "Bullet list" },
    { type: "numberedList", label: "1—", title: "Numbered list" },
    { type: "blockquote",   label: "❝",  title: "Blockquote" },
  ],
  [
    { type: "inlineCode",   label: "`",   title: "Inline code",  className: "font-mono" },
    { type: "codeBlock",    label: "</>", title: "Code block",   className: "font-mono text-[11px]" },
    { type: "link",         label: "⚭",   title: "Link" },
    { type: "hr",           label: "—",   title: "Horizontal rule" },
  ],
];

function MarkdownEditor({ value, onChange, placeholder = "Write something…", rows = 8 }) {
  const ref = useRef(null);

  const handleFormat = (type) => {
    if (!ref.current) return;
    applyFormat(ref.current, type);
    // Sync React state after DOM mutation.
    onChange(ref.current.value);
  };

  return (
    <div className="rounded-lg border border-[#2a3570] bg-[#12163a] focus-within:border-[#6868b8]">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 border-b border-[#1e2450] px-2 py-1.5">
        {TOOLBAR.map((group, gi) => (
          <span key={gi} className="contents">
            {gi > 0 && (
              <span className="mx-1 self-stretch w-px bg-[#1e2450]" aria-hidden />
            )}
            {group.map(({ type, label, title, className = "" }) => (
              <button
                key={type}
                type="button"
                title={title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleFormat(type);
                }}
                className={`min-w-[28px] rounded px-1.5 py-1 text-[12px] font-semibold text-[#8080a8] transition hover:bg-[#1e2450] hover:text-white ${className}`}
              >
                {label}
              </button>
            ))}
          </span>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y bg-transparent px-3 py-2.5 text-sm text-white placeholder-[#4a4a8a] outline-none font-mono"
      />
    </div>
  );
}

export default MarkdownEditor;
