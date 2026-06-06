import { useState } from 'react';

interface ChatBubbleProps {
  content: string;
  isMine: boolean;
  timestamp: string;
  isRead?: boolean;
  messageType?: 'text' | 'image';
  imageUrl?: string | null;
}

export function ChatBubble({ content, isMine, timestamp, isRead, messageType, imageUrl }: ChatBubbleProps) {
  const [showFullImage, setShowFullImage] = useState(false);

  return (
    <>
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
        <div
          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
            isMine
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          }`}
        >
          {/* Image attachment */}
          {messageType === 'image' && imageUrl && (
            <button
              onClick={() => setShowFullImage(true)}
              className="mb-1 block cursor-pointer overflow-hidden rounded-lg"
            >
              <img
                src={imageUrl}
                alt="Shared image"
                className="max-w-48 rounded-lg object-cover transition-opacity hover:opacity-90"
                loading="lazy"
              />
            </button>
          )}

          {/* Text content (skip if it's just the "[이미지]" placeholder for image-only messages) */}
          {!(messageType === 'image' && content === '[이미지]') && (
            <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
          )}

          <div
            className={`mt-1 flex items-center gap-1 text-xs ${
              isMine ? 'text-indigo-200 justify-end' : 'text-gray-400'
            }`}
          >
            <span>
              {new Date(timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isMine && (
              <span>{isRead ? 'Read' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* Full-size image modal */}
      {showFullImage && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={imageUrl}
              alt="Full size"
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg transition-colors hover:bg-gray-100"
            >
              <span className="text-lg font-bold">&times;</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
