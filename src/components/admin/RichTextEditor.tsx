"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

/// Toolbar dibatasi ke FORMAT TEKS saja (bold/italic/underline/heading/list) — TIDAK ada
/// pilihan font-family/ukuran bebas, supaya ringkasan yang tayang tetap konsisten dengan
/// tipografi editorial situs publik (keputusan founder). Staf bebas menyusun struktur di
/// dalam satu blok teks ini sendiri (mis. pakai heading untuk memisah bagian), sistem tidak
/// lagi memaksa 3 kotak terpisah.
function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded px-2 py-1 text-xs font-medium ${active ? "bg-accent text-white" : "text-foreground hover:bg-background"}`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-summary min-h-[160px] rounded-b-md border border-t-0 border-border px-3 py-2 text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sinkronkan kalau `content` diganti dari luar (mis. hasil "Isi dengan bantuan AI"
  // atau saat data paper baru dimuat) — TIDAK dipanggil saat user sendiri yang mengetik
  // (editor.getHTML() akan sama dengan content di render berikutnya).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  if (!editor) return <div className="min-h-[192px] rounded-md border border-border" />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-border bg-surface px-2 py-1.5">
        <ToolbarButton label="Tebal" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolbarButton>
        <ToolbarButton label="Miring" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton label="Garis bawah" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline">U</span>
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Judul bagian besar"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Judul bagian kecil"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton label="Daftar poin" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </ToolbarButton>
        <ToolbarButton
          label="Daftar bernomor"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
