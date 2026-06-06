import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDispute, addDisputeMessage, type DisputeMessage } from '@/lib/api/disputes';
import { useAuthStore } from '@/stores/auth';

interface DisputeChatProps {
  disputeId: string;
  status: string;
}

export function DisputeChat({ disputeId, status }: DisputeChatProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const { data } = useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: () => getDispute(disputeId).then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: () => addDisputeMessage(disputeId, { content, attachments: [] }),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
    },
  });

  const messages: DisputeMessage[] = data?.messages || [];
  const isClosed = status === 'resolved' || status === 'closed';

  const roleLabels: Record<string, string> = {
    buyer: '구매자',
    seller: '판매자',
    admin: '관리자',
  };

  const roleBg: Record<string, string> = {
    buyer: 'bg-gray-50 dark:bg-gray-800',
    seller: 'bg-green-50',
    admin: 'bg-purple-50',
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">메시지가 없습니다.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3 ${roleBg[msg.sender_role] || 'bg-gray-50'} ${
              msg.sender_id === user?.id ? 'ml-8' : 'mr-8'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">
                {roleLabels[msg.sender_role] || msg.sender_role}
              </span>
              <span className="text-[10px] text-gray-400">
                {new Date(msg.created_at).toLocaleString('ko')}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
      </div>

      {!isClosed && (
        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900/10 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && content.trim()) mutation.mutate();
            }}
          />
          <button
            onClick={() => mutation.mutate()}
            disabled={!content.trim() || mutation.isPending}
            className="rounded-full bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
          >
            전송
          </button>
        </div>
      )}
    </div>
  );
}
