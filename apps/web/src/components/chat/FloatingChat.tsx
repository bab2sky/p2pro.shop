import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, Trash2, Loader2, Paperclip } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from 'react-router-dom';
import { supportApi, type ChatHistoryEntry } from '@/lib/api/support';
import { formatTime as formatDateTimeUtil } from '@/lib/datetime';

// --- Types ---
interface SupportMessage {
  id: string;
  content: string;
  isMine: boolean;
  timestamp: string;
  imageUrl?: string;
}

interface ChatSession {
  messages: SupportMessage[];
  endedAt: string | null;
  createdAt: string;
}

// --- Storage helpers (per-user, 24h expiry) ---
const STORAGE_KEY_PREFIX = 'p2pro_support_chat_';

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function loadSession(userId: string): ChatSession | null {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const session: ChatSession = JSON.parse(raw);

    // Auto-delete if ended more than 24h ago
    if (session.endedAt) {
      const endedTime = new Date(session.endedAt).getTime();
      const now = Date.now();
      if (now - endedTime > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(getStorageKey(userId));
        return null;
      }
    }
    return session;
  } catch {
    return null;
  }
}

function saveSession(userId: string, session: ChatSession) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(session));
}

function clearSession(userId: string) {
  localStorage.removeItem(getStorageKey(userId));
}

// --- Fallback message when LLM API is unavailable ---
const API_ERROR_FALLBACK =
  '죄송합니다, 일시적으로 응답할 수 없습니다. 잠시 후 다시 시도해주세요.';

// --- Component ---
export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for external open event (e.g. from MobileBottomNav)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-floating-chat', handler);
    return () => window.removeEventListener('open-floating-chat', handler);
  }, []);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [isEnded, setIsEnded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  // Load session on mount / user change
  useEffect(() => {
    if (!userId) return;
    const session = loadSession(userId);
    if (session) {
      setMessages(session.messages);
      setIsEnded(!!session.endedAt);
    } else {
      setMessages([]);
      setIsEnded(false);
    }
  }, [userId]);

  // Save session whenever messages change (최대 50건 유지)
  useEffect(() => {
    if (!userId || messages.length === 0) return;
    const existing = loadSession(userId);
    const capped = messages.slice(-50);
    saveSession(userId, {
      messages: capped,
      endedAt: isEnded ? (existing?.endedAt ?? new Date().toISOString()) : null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }, [messages, isEnded, userId]);

  // 언마운트 시 objectURL 정리 (메모리 누수 방지)
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => { previewUrlRef.current = previewUrl; }, [previewUrl]);
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isEnded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isEnded]);

  const addWelcome = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        content:
          '안녕하세요! P2PRO 고객센터입니다. 😊\n궁금하신 점이나 도움이 필요하시면 메시지를 보내주세요.',
        isMine: false,
        timestamp: new Date().toISOString(),
      },
    ]);
    setIsEnded(false);
  }, []);

  const handleOpen = useCallback(() => {
    if (!userId) {
      navigate('/login');
      return;
    }
    setIsOpen(true);
    // If no messages, show welcome
    if (messages.length === 0) {
      addWelcome();
    }
  }, [userId, navigate, messages.length, addWelcome]);

  // Listen for custom event to open chat (from ContactPage etc.)
  useEffect(() => {
    const handler = () => handleOpen();
    window.addEventListener('open-support-chat', handler);
    return () => window.removeEventListener('open-support-chat', handler);
  }, [handleOpen]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, [previewUrl]);

  const clearPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  const handleSend = useCallback(async () => {
    // Handle image send
    if (previewFile && previewUrl) {
      // Convert blob to data URL so it persists after revoke
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const imgMsg: SupportMessage = {
          id: `user-img-${Date.now()}`,
          content: '[이미지]',
          isMine: true,
          timestamp: new Date().toISOString(),
          imageUrl: dataUrl,
        };
        setMessages((prev) => [...prev, imgMsg]);
      };
      reader.readAsDataURL(previewFile);
      clearPreview();

      // Also send text if present
      const trimmed = text.trim();
      if (trimmed) {
        const userMsg: SupportMessage = {
          id: `user-${Date.now()}`,
          content: trimmed,
          isMine: true,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setText('');
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed || isEnded || isTyping) return;

    const userMsg: SupportMessage = {
      id: `user-${Date.now()}`,
      content: trimmed,
      isMine: true,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setText('');
    setIsTyping(true);

    try {
      // 최근 20건만 전송 (payload 무한 증가 방지)
      const history: ChatHistoryEntry[] = messages
        .filter((m) => m.id !== 'welcome' && !m.id.startsWith('system-'))
        .slice(-20)
        .map((m) => ({
          role: m.isMine ? 'user' as const : 'assistant' as const,
          content: m.content,
        }));

      const resp = await supportApi.sendMessage(trimmed, history);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          content: resp.data.reply,
          isMine: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      // FR-21: Show fallback error message when LLM API is unavailable
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          content: API_ERROR_FALLBACK,
          isMine: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [text, isEnded, isTyping, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEndChat = () => {
    setIsEnded(true);
    setShowEndConfirm(false);
    const endMsg: SupportMessage = {
      id: `system-${Date.now()}`,
      content: '대화가 종료되었습니다.\n대화 내용은 24시간 후 자동 삭제됩니다.',
      isMine: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, endMsg]);
    if (userId) {
      saveSession(userId, {
        messages: [...messages, endMsg],
        endedAt: new Date().toISOString(),
        createdAt: loadSession(userId)?.createdAt ?? new Date().toISOString(),
      });
    }
  };

  const handleNewChat = () => {
    if (userId) clearSession(userId);
    setMessages([]);
    setIsEnded(false);
    addWelcome();
  };

  // 글로벌 진출 (2026-05-07): hardcoded ko-KR → i18n locale 동적.
  const formatTime = (ts: string) => formatDateTimeUtil(ts);

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <div className="fixed bottom-20 right-4 z-50 hidden md:block md:bottom-10 md:right-10">
          <button
            onClick={handleOpen}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-xl transition-transform hover:scale-110 hover:bg-pink-600"
            aria-label="1:1 문의"
          >
            <MessageCircle className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* Chat messenger popup */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 md:inset-auto md:bottom-10 md:right-10 md:h-[min(580px,calc(100vh-32px))] md:w-[min(380px,calc(100vw-32px))] md:rounded-2xl md:border md:border-gray-200 md:shadow-2xl md:dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between bg-pink-500 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">P2PRO 고객센터</h3>
                <p className="text-[11px] text-pink-100">
                  {user?.nickname ? `${user.nickname}님의 1:1 문의` : '1:1 문의'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isEnded && messages.length > 1 && (
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  title="대화 종료"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* End confirmation */}
          {showEndConfirm && (
            <div className="border-b border-gray-100 bg-amber-50 px-4 py-3 dark:border-gray-800 dark:bg-amber-500/10">
              <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                대화를 종료하시겠습니까?<br />
                <span className="text-xs text-gray-500">내용은 24시간 후 자동 삭제됩니다.</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleEndChat}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600"
                >
                  종료
                </button>
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-gray-950">
            {messages.map((msg) => (
              <div key={msg.id} className={`mb-3 flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                {!msg.isMine && (
                  <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-500/10">
                    <Bot className="h-3.5 w-3.5 text-pink-500" />
                  </div>
                )}
                <div className={`flex flex-col ${msg.isMine ? 'items-end' : 'items-start'}`}>
                  {msg.imageUrl ? (
                    <button
                      onClick={() => setImageModalUrl(msg.imageUrl!)}
                      className="overflow-hidden rounded-2xl"
                    >
                      <img
                        src={msg.imageUrl}
                        alt="첨부 이미지"
                        className="max-w-[200px] rounded-2xl object-cover transition-opacity hover:opacity-90"
                      />
                    </button>
                  ) : (
                    <div
                      className={`max-w-[240px] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        msg.isMine
                          ? 'rounded-br-md bg-pink-500 text-white'
                          : 'rounded-bl-md bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                  <span className="mt-1 text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="mb-3 flex justify-start">
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-500/10">
                  <Bot className="h-3.5 w-3.5 text-pink-500" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm dark:bg-gray-800">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input or ended state */}
          {isEnded ? (
            <div className="border-t border-gray-100 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="mb-3 text-xs text-gray-400">대화가 종료되었습니다</p>
              <button
                onClick={handleNewChat}
                className="rounded-xl bg-pink-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-pink-600"
              >
                새 대화 시작
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              {/* Image preview */}
              {previewUrl && (
                <div className="relative mb-2 inline-block">
                  <img src={previewUrl} alt="미리보기" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                  <button
                    onClick={clearPreview}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white shadow-sm hover:bg-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-pink-500 disabled:opacity-40 dark:hover:bg-gray-800"
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
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isTyping ? 'AI가 답변 중...' : '메시지를 입력하세요...'}
                  rows={1}
                  disabled={isTyping}
                  className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm focus:border-pink-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-400 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                  style={{ maxHeight: '80px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!text.trim() && !previewFile) || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white transition-colors hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Image modal */}
      {imageModalUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setImageModalUrl(null)}
        >
          <button
            onClick={() => setImageModalUrl(null)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={imageModalUrl}
            alt="확대 이미지"
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
