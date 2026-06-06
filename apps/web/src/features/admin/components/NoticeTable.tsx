import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import RichEditorForm, { type RichEditorField } from '@/components/common/RichEditorForm';
import {
  getNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  type Notice,
} from '@/lib/api/content';

interface NoticeFormData {
  title: string;
  content: string;
  is_pinned: boolean;
  is_active: boolean;
}

const emptyForm: NoticeFormData = { title: '', content: '', is_pinned: false, is_active: true };

const NOTICE_FIELDS: RichEditorField[] = [
  { name: 'title', label: '제목', type: 'text', placeholder: '공지 제목을 입력하세요', required: true },
  { name: 'content', label: '내용', type: 'editor', placeholder: '공지 내용을 입력하세요...', required: true },
  { name: 'is_pinned', label: '상단 고정', type: 'checkbox' },
  { name: 'is_active', label: '활성 상태', type: 'checkbox' },
];

export function NoticeTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NoticeFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notices', page],
    queryFn: () => getNotices(page),
  });

  const createMutation = useMutation({
    mutationFn: (data: NoticeFormData) => createNotice(data),
    onSuccess: () => {
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NoticeFormData> & { is_active?: boolean } }) =>
      updateNotice(id, data),
    onSuccess: () => {
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotice(id),
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'notices'] });
    },
  });

  const openCreate = () => {
    setEditingNotice(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      is_pinned: notice.is_pinned,
      is_active: notice.is_active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingNotice(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (editingNotice) {
      updateMutation.mutate({ id: editingNotice.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleFieldChange = (name: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">공지사항 관리</h1>
        <button
          onClick={showForm ? closeForm : openCreate}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
            showForm
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
          }`}
        >
          {showForm ? <><X className="h-4 w-4" /> 취소</> : <><Plus className="h-4 w-4" /> 새 공지 작성</>}
        </button>
      </div>

      {/* Inline Create/Edit Form */}
      {showForm && (
        <RichEditorForm
          title={editingNotice ? '공지 수정' : '새 공지 작성'}
          fields={NOTICE_FIELDS}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RichEditorForm 의 generic values 가 호출 측 form 형태와 일치하지만 타입 추론 한계
          values={form as any}
          onChange={handleFieldChange}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          submitLabel={editingNotice ? '수정' : '등록'}
          submitting={createMutation.isPending || updateMutation.isPending}
          submitDisabled={!form.title.trim() || !form.content || form.content === '<p></p>'}
        />
      )}

      {/* Notice Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">제목</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">고정</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">작성일</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((notice) => (
                <tr key={notice.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium dark:text-gray-200">{notice.title}</td>
                  <td className="px-5 py-3 text-center">
                    {notice.is_pinned ? (
                      <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-bold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">고정</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        notice.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {notice.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400">
                    {notice.created_at ? new Date(notice.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => openEdit(notice)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        수정
                      </button>
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: notice.id,
                            data: { is_active: !notice.is_active },
                          })
                        }
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        {notice.is_active ? '비활성' : '활성'}
                      </button>
                      <button
                        onClick={() => setDeleteId(notice.id)}
                        className="rounded-full bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <FileText className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                    <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">등록된 공지사항이 없습니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">
            {page} / {data.pagination.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-96 rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-bold dark:text-white">공지 삭제</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                이 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
