import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import "./RichTextEditor.css";

function ToolbarBtn({ onClick, active, title, children, className = "" }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`min-w-[28px] rounded px-1.5 py-1 text-[12px] font-semibold transition
        ${active
          ? "bg-[#2a3570] text-white"
          : "text-[#8080a8] hover:bg-[#1e2450] hover:text-white"}
        ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 self-stretch w-px bg-[#1e2450]" aria-hidden />;
}

function LinkButton({ editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };
  return (
    <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Link">
      ⚭
    </ToolbarBtn>
  );
}

function Toolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[#1e2450] px-2 py-1.5">
      {/* Text style */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")} title="Bold (⌘B)" className="font-bold">B</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")} title="Italic (⌘I)" className="italic">I</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")} title="Underline (⌘U)" className="underline">U</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")} title="Strikethrough" className="line-through">S</ToolbarBtn>

      <Divider />

      {/* Headings */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })} title="Heading 1">H1</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })} title="Heading 2">H2</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })} title="Heading 3">H3</ToolbarBtn>

      <Divider />

      {/* Lists */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")} title="Bullet list (⌘⇧8)">•—</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")} title="Numbered list (⌘⇧7)">1—</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")} title="Blockquote">❝</ToolbarBtn>

      <Divider />

      {/* Code */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")} title="Inline code" className="font-mono">`</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")} title="Code block" className="font-mono text-[11px]">&lt;/&gt;</ToolbarBtn>

      <Divider />

      {/* Link + HR */}
      <LinkButton editor={editor} />
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}
        active={false} title="Horizontal rule">—</ToolbarBtn>

      <Divider />

      {/* History */}
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()}
        active={false} title="Undo (⌘Z)">↩</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()}
        active={false} title="Redo (⌘⇧Z)">↪</ToolbarBtn>
    </div>
  );
}

function RichTextEditor({ value, onChange, placeholder = "Write something…", fill = false }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  return (
    <div
      className={`rich-editor flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#2a3570] bg-[#12163a] focus-within:border-[#6868b8] ${fill ? "rich-editor--fill" : ""}`}
    >
      <Toolbar editor={editor} />
      <div className="rich-editor__scroll min-h-0 overflow-y-auto overscroll-contain">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default RichTextEditor;
