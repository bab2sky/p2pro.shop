import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  onSendImage?: (file: File) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export function ChatInput({ onSend, onSendImage, onTyping, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      if (onTyping) {
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
          onTyping();
        }, 300);
      }
    },
    [onTyping],
  );

  const clearPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError('JPEG, PNG, WebP 이미지만 지원합니다.');
        return;
      }

      if (file.size > MAX_SIZE) {
        setUploadError('파일 크기는 5MB 이하여야 합니다.');
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewFile(file);
      setPreviewUrl(url);
    },
    [previewUrl],
  );

  const handleSend = useCallback(async () => {
    // If there is an image attachment, upload it first
    if (previewFile && onSendImage) {
      setUploading(true);
      setUploadError(null);
      try {
        await onSendImage(previewFile);
        clearPreview();
      } catch {
        setUploadError('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setUploading(false);
      }
      // Also send text if present
      const trimmed = text.trim();
      if (trimmed) {
        onSend(trimmed);
        setText('');
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [text, onSend, previewFile, onSendImage, clearPreview]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = text.trim() || previewFile;

  return (
    <div className="border-t bg-white p-3">
      {/* Image preview */}
      {previewUrl && (
        <div className="relative mb-2 inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
          />
          <button
            onClick={clearPreview}
            disabled={uploading}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white shadow-sm transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="mb-2 text-[12px] text-red-500">{uploadError}</p>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title="이미지 첨부"
          aria-label="이미지 첨부"
        >
          <Paperclip className="h-4.5 w-4.5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="메시지 입력"
          placeholder="Write a message..."
          disabled={disabled || uploading}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || uploading || !canSend}
          aria-label="메시지 보내기"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
