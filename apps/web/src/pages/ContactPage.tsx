import { MessageCircle, Mail, Phone, Clock, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SimplePageHeader } from '@/components/layout/SimplePageHeader';
import { FloatingChat } from '@/components/chat/FloatingChat';

export default function ContactPage() {
  const handleOpenChat = () => {
    window.dispatchEvent(new CustomEvent('open-support-chat'));
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <SimplePageHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <MessageCircle className="h-5 w-5" />
          1:1 문의
        </h1>

        {/* Contact Info Card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">고객센터 안내</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <Phone className="h-4 w-4 shrink-0 text-pink-500" />
              <span><strong>전화문의:</strong> 1577-0000</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <Mail className="h-4 w-4 shrink-0 text-pink-500" />
              <span><strong>이메일:</strong> support@p2pro.store</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <Clock className="h-4 w-4 shrink-0 text-pink-500" />
              <span><strong>운영시간:</strong> 평일 09:30 - 17:30 (점심 12:00 - 13:00 / 주말·공휴일 휴무)</span>
            </div>
          </div>
        </div>

        {/* Inquiry Options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={handleOpenChat}
            className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-pink-300 hover:bg-pink-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-pink-500/30 dark:hover:bg-pink-500/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-500/10">
              <MessageCircle className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white">채팅 문의</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">실시간 1:1 채팅으로 문의하세요</p>
            </div>
          </button>

          <Link
            to="/faq"
            className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-pink-300 hover:bg-pink-50/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-pink-500/30 dark:hover:bg-pink-500/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10">
              <HelpCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white">자주 묻는 질문</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">FAQ에서 답변을 찾아보세요</p>
            </div>
          </Link>
        </div>
      </div>
      <FloatingChat />
    </div>
  );
}
