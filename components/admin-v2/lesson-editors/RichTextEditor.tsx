'use client'

// 10B rich-text editor for the Reading (Article) passage.
//
// Teachers format the passage with a standard mini-toolbar — bold, italic,
// underline, HIGHLIGHT (multicolor) and text COLOR — and the value is emitted
// as HTML. The article block stores that HTML in content.text; the student
// lesson view renders it sanitized (DOMPurify) so existing PLAIN-TEXT passages
// keep working (plain text is valid HTML).
//
// TipTap v3 + Next SSR notes (verified against installed node_modules@3.27.1):
//   • This is a "use client" component and useEditor sets immediatelyRender:false
//     — without it Next.js throws a hydration mismatch on first paint.
//   • StarterKit v3 ALREADY bundles the Underline mark (and Link), so Underline
//     is NOT registered separately — double-registering an extension warns/errors.
//   • Text color needs TextStyle + Color (Color is re-exported from
//     extension-text-style; we import it from extension-color, the named dep).
//   • Highlight needs Highlight.configure({ multicolor: true }) so the chosen
//     swatch colour is stored, not a single default highlight.

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
// v3: TextStyle is a NAMED export of extension-text-style (no default). Color is
// re-exported from text-style; we import it from the named extension-color dep.
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import type { Editor } from '@tiptap/react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

// Small, curated swatch sets so the toolbar stays a tidy 10B strip rather than a
// full colour picker. "none"/"default" clear the mark.
const HIGHLIGHT_SWATCHES: { label: string; color: string | null }[] = [
  { label: 'Yellow', color: '#fff3a3' },
  { label: 'Green', color: '#c8f2d4' },
  { label: 'Pink', color: '#ffd1e0' },
  { label: 'Blue', color: '#cfe8ff' },
  { label: 'None', color: null },
]

const TEXT_COLORS: { label: string; color: string | null }[] = [
  { label: 'Blue', color: '#416ebe' },
  { label: 'Red', color: '#c92a2a' },
  { label: 'Green', color: '#15803d' },
  { label: 'Amber', color: '#b45309' },
  { label: 'Default', color: null },
]

// A single 10B toolbar button. Active state is driven by editor.isActive(...).
function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // onMouseDown + preventDefault keeps the editor selection while clicking
      // the toolbar (otherwise the focus jump can drop the selection).
      onMouseDown={(e) => {
        e.preventDefault()
        if (!disabled) onClick()
      }}
      disabled={disabled}
      className={`h-8 min-w-8 px-2 rounded-lg text-[13px] font-semibold leading-none flex items-center justify-center transition-colors border-[1.5px] ${
        active
          ? 'border-sky bg-sky-wash text-sky-text'
          : 'border-transparent text-ink-body hover:bg-sky-wash/60'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

// A small swatch button used by the Highlight + Color groups. A null colour
// renders the "clear" chip (diagonal slash).
function Swatch({
  color,
  active,
  title,
  onClick,
}: {
  color: string | null
  active: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`h-6 w-6 rounded-full border-[1.5px] flex items-center justify-center transition-transform hover:scale-110 ${
        active ? 'border-sky ring-2 ring-sky/30' : 'border-hairline'
      }`}
      style={color ? { backgroundColor: color } : { backgroundColor: '#ffffff' }}
    >
      {!color && <span className="text-[13px] text-ink-muted leading-none">⊘</span>}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-1 flex-wrap px-2 py-1.5 bg-white border-[1.5px] border-b-0 border-[#e3e5e9] rounded-t-tile">
      <ToolbarButton
        title="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-extrabold">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <Divider />

      {/* Highlight swatches */}
      <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted px-1">
        Hi
      </span>
      <div className="flex items-center gap-1">
        {HIGHLIGHT_SWATCHES.map((s) => (
          <Swatch
            key={s.label}
            color={s.color}
            title={s.color ? `Highlight ${s.label}` : 'Remove highlight'}
            active={
              s.color
                ? editor.isActive('highlight', { color: s.color })
                : false
            }
            onClick={() => {
              if (s.color) {
                editor.chain().focus().toggleHighlight({ color: s.color }).run()
              } else {
                editor.chain().focus().unsetHighlight().run()
              }
            }}
          />
        ))}
      </div>

      <Divider />

      {/* Text colour palette */}
      <span className="text-[11px] font-extrabold uppercase tracking-eyebrow text-ink-muted px-1">
        A
      </span>
      <div className="flex items-center gap-1">
        {TEXT_COLORS.map((c) => (
          <Swatch
            key={c.label}
            color={c.color}
            title={c.color ? `Text ${c.label}` : 'Default colour'}
            active={
              c.color ? editor.isActive('textStyle', { color: c.color }) : false
            }
            onClick={() => {
              if (c.color) {
                editor.chain().focus().setColor(c.color).run()
              } else {
                editor.chain().focus().unsetColor().run()
              }
            }}
          />
        ))}
      </div>

      <Divider />

      <ToolbarButton
        title="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <span className="text-ink-muted">⌫</span>
      </ToolbarButton>
    </div>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  className = '',
}: RichTextEditorProps) {
  const editor = useEditor({
    // Required for Next SSR — avoids the hydration mismatch on first render.
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 already includes Underline (and Link), so we do NOT add
      // @tiptap/extension-underline separately — double-registration warns.
      StarterKit,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        // Prose-like, NORMAL weight by default (the old plain passage rendered
        // bold — fixed here). Headings/bold appear only when the teacher applies
        // them. font-rubik + 10B surface tokens.
        class:
          'rte-content min-h-[10rem] max-h-[28rem] overflow-y-auto bg-white rounded-b-tile border-[1.5px] border-[#e3e5e9] px-3.5 py-3 text-[15px] font-normal text-ink-body leading-relaxed font-rubik focus:outline-none',
        'data-placeholder': placeholder ?? '',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Keep editor content in sync if `value` changes EXTERNALLY (e.g. AI fills the
  // passage, or a different block is selected). Only setContent when it actually
  // differs from the current HTML — otherwise every keystroke would reset the
  // doc and jump the cursor.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ''
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) {
    // SSR / first paint before the editor is ready (immediatelyRender:false).
    return (
      <div
        className={`min-h-[12.5rem] bg-white rounded-tile border-[1.5px] border-[#e3e5e9] ${className}`}
        aria-hidden="true"
      />
    )
  }

  return (
    <div className={className}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
