import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import Image from '@tiptap/extension-image';
import EmojiPicker from './EmojiPicker';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
  Quote,
  Smile,
  Youtube as YoutubeIcon,
  ImagePlus,
  X,
  GripVertical,
  Loader2,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;
}

/* ── YouTube Modal ── */
function YoutubeModal({
  onInsert,
  onClose,
}: {
  onInsert: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed) {
      onInsert(trimmed);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[480px] max-w-[90vw] rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <YoutubeIcon className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">YouTube 동영상 삽입</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
            YouTube URL
          </label>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            YouTube 링크를 붙여넣으세요. (예: https://youtu.be/... 또는 https://www.youtube.com/watch?v=...)
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            삽입
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Editor ── */
export default function RichTextEditor({ value, onChange, placeholder, onImageUpload }: RichTextEditorProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [editorHeight, setEditorHeight] = useState(220);
  const [imageUploading, setImageUploading] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  /* Resize drag handlers */
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: editorHeight };

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = ev.clientY - resizeRef.current.startY;
      const newH = Math.max(120, Math.min(800, resizeRef.current.startH + diff));
      setEditorHeight(newH);
    };

    const handleUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [editorHeight]);

  const editor = useEditor({
    extensions: [
      // StarterKit 최신 버전이 link/underline 을 기본 포함하므로 둘 다 끄고
      // 아래에서 명시적으로(커스텀 className 포함) 다시 등록한다.
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-pink-500 underline' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '내용을 입력하세요...',
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl my-3 max-w-full h-auto',
        },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: 'rounded-xl overflow-hidden my-3',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none px-4 py-3 outline-none dark:prose-invert prose-headings:font-bold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:border-l-gray-300 prose-blockquote:text-gray-500',
      },
    },
  });

  // 외부 value 동기화 (예: 수정 페이지에서 product 가 비동기로 늦게 로드되는 경우).
  // tiptap useEditor 는 마운트 시 1회만 content 를 적용하므로, 이후 prop 변경을 감지해
  // 에디터 내용과 다를 때만 setContent 호출 (emitUpdate:false → onUpdate 미트리거, 입력 중 루프 방지).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('URL을 입력하세요');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const handleYoutubeInsert = (url: string) => {
    editor.commands.setYoutubeVideo({ src: url });
  };

  const handleImageUploadClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    setImageUploading(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // error handled by caller
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
  };

  const iconSize = 'h-3.5 w-3.5';

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors focus-within:border-gray-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:focus-within:border-gray-600">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="굵게"
          >
            <Bold className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="기울임"
          >
            <Italic className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="밑줄"
          >
            <UnderlineIcon className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="취소선"
          >
            <Strikethrough className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="제목 1"
          >
            <Heading1 className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="제목 2"
          >
            <Heading2 className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="제목 3"
          >
            <Heading3 className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="목록"
          >
            <List className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="번호 목록"
          >
            <ListOrdered className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="인용"
          >
            <Quote className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="구분선"
          >
            <Minus className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            title="왼쪽 정렬"
          >
            <AlignLeft className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            title="가운데 정렬"
          >
            <AlignCenter className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            title="오른쪽 정렬"
          >
            <AlignRight className={iconSize} />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={addLink}
            active={editor.isActive('link')}
            title="링크"
          >
            <LinkIcon className={iconSize} />
          </ToolbarButton>

          {/* Emoji Picker */}
          <div className="relative" ref={emojiRef}>
            <ToolbarButton
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              active={showEmojiPicker}
              title="이모티콘"
            >
              <Smile className={iconSize} />
            </ToolbarButton>
            {showEmojiPicker && (
              <div className="absolute left-0 top-full z-50 mt-1">
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>

          {/* YouTube */}
          <ToolbarButton
            onClick={() => setShowYoutubeModal(true)}
            title="YouTube 동영상"
          >
            <YoutubeIcon className={iconSize} />
          </ToolbarButton>

          {/* Image Upload */}
          {onImageUpload && (
            <>
              <ToolbarButton
                onClick={handleImageUploadClick}
                title="이미지 삽입"
              >
                {imageUploading ? (
                  <Loader2 className={`${iconSize} animate-spin`} />
                ) : (
                  <ImagePlus className={iconSize} />
                )}
              </ToolbarButton>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </>
          )}

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="실행 취소"
          >
            <Undo className={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="다시 실행"
          >
            <Redo className={iconSize} />
          </ToolbarButton>
        </div>

        {/* Editor - resizable */}
        <div className="overflow-y-auto" style={{ height: editorHeight }}>
          <EditorContent editor={editor} />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="flex cursor-row-resize items-center justify-center border-t border-gray-200 bg-white py-0.5 select-none dark:border-gray-700 dark:bg-gray-900"
        >
          <GripVertical className="h-3 w-3 rotate-90 text-gray-300 dark:text-gray-600" />
        </div>
      </div>

      {/* YouTube Modal */}
      {showYoutubeModal && (
        <YoutubeModal
          onInsert={handleYoutubeInsert}
          onClose={() => setShowYoutubeModal(false)}
        />
      )}
    </>
  );
}
