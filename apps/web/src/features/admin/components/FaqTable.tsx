import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, X } from 'lucide-react';
import { extractApiError } from '@/lib/api-error';
import {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  getFaqCategories,
  addFaqCategory,
  renameFaqCategory,
  deleteFaqCategory,
  type Faq,
  type FaqCategory,
} from '@/lib/api/content';

interface FaqFormData {
  category: string;
  question: string;
  answer: string;
  sort_order: number;
}

const emptyForm: FaqFormData = { category: 'general', question: '', answer: '', sort_order: 0 };

// --- Category Management Panel ---
function CategoryPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [newCatName, setNewCatName] = useState('');
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingCat, setDeletingCat] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin', 'faq-categories'],
    queryFn: () => getFaqCategories().then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => addFaqCategory(name),
    onSuccess: () => {
      setNewCatName('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'faq-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) => renameFaqCategory(name, newName),
    onSuccess: () => {
      setRenamingCat(null);
      setRenameValue('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'faq-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteFaqCategory(name),
    onSuccess: () => {
      setDeletingCat(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'faq-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[500px] max-h-[80vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold dark:text-white">FAQ 카테고리 관리</h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Add new category */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="새 카테고리 이름"
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCatName.trim()) addMutation.mutate(newCatName.trim());
              }}
            />
            <button
              onClick={() => newCatName.trim() && addMutation.mutate(newCatName.trim())}
              disabled={!newCatName.trim() || addMutation.isPending}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              추가
            </button>
          </div>

          {addMutation.isError && (
            <p className="mb-3 text-sm text-red-500">
              {extractApiError(addMutation.error)}
            </p>
          )}

          {/* Category list */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-12" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {categories?.map((cat: FaqCategory) => (
                <div key={cat.name} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5 dark:border-gray-800">
                  {renamingCat === cat.name ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renameValue.trim()) {
                            renameMutation.mutate({ name: cat.name, newName: renameValue.trim() });
                          }
                          if (e.key === 'Escape') setRenamingCat(null);
                        }}
                      />
                      <button
                        onClick={() => renameValue.trim() && renameMutation.mutate({ name: cat.name, newName: renameValue.trim() })}
                        disabled={!renameValue.trim() || renameMutation.isPending}
                        className="rounded-full bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setRenamingCat(null)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        취소
                      </button>
                    </div>
                  ) : deletingCat === cat.name ? (
                    <div className="flex flex-1 items-center justify-between">
                      <span className="text-sm text-red-600 dark:text-red-400">
                        "{cat.name}" 삭제하시겠습니까?
                        {cat.faq_count > 0 && ` (FAQ ${cat.faq_count}개 존재)`}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(cat.name)}
                          disabled={deleteMutation.isPending}
                          className="rounded-full bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          삭제
                        </button>
                        <button
                          onClick={() => setDeletingCat(null)}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium dark:text-white">{cat.name}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">FAQ {cat.faq_count}개</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setRenamingCat(cat.name); setRenameValue(cat.name); }}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                        >
                          이름 변경
                        </button>
                        <button
                          onClick={() => setDeletingCat(cat.name)}
                          className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {(!categories || categories.length === 0) && (
                <div className="py-8 text-center">
                  <HelpCircle className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                  <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">카테고리가 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {(renameMutation.isError || deleteMutation.isError) && (
            <p className="mt-3 text-sm text-red-500">
              {extractApiError(renameMutation.error) || extractApiError(deleteMutation.error)}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <button onClick={onClose} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">닫기</button>
        </div>
      </div>
    </div>
  );
}

// --- Main FaqTable ---
export function FaqTable() {
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [form, setForm] = useState<FaqFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch categories dynamically
  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'faq-categories'],
    queryFn: () => getFaqCategories().then((r) => r.data),
  });

  const categories = categoriesData?.map((c: FaqCategory) => c.name) || [];

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'faqs', filterCategory],
    queryFn: () => getFaqs(filterCategory || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: FaqFormData) => createFaq(data),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'faq-categories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateFaq>[1] }) => updateFaq(id, data),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'faq-categories'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFaq(id),
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'faq-categories'] });
    },
  });

  const openCreate = () => {
    setEditingFaq(null);
    setForm({ ...emptyForm, category: categories[0] || 'general' });
    setShowModal(true);
  };

  const openEdit = (faq: Faq) => {
    setEditingFaq(faq);
    setForm({ category: faq.category, question: faq.question, answer: faq.answer, sort_order: faq.sort_order });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFaq(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (editingFaq) {
      updateMutation.mutate({ id: editingFaq.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">FAQ 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryPanel(true)}
            className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
          >
            카테고리 관리
          </button>
          <button
            onClick={openCreate}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            새 FAQ 등록
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setFilterCategory('')}
          className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
            !filterCategory ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          전체
        </button>
        {categories.map((cat: string) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
              filterCategory === cat ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">카테고리</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">질문</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">순서</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((faq) => (
                <tr key={faq.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{faq.category}</span>
                  </td>
                  <td className="px-5 py-3 font-medium dark:text-gray-200">{faq.question}</td>
                  <td className="px-5 py-3 text-center dark:text-gray-300">{faq.sort_order}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${faq.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {faq.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(faq)} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">수정</button>
                      <button
                        onClick={() => updateMutation.mutate({ id: faq.id, data: { is_active: !faq.is_active } })}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        {faq.is_active ? '비활성' : '활성'}
                      </button>
                      <button onClick={() => setDeleteId(faq.id)} className="rounded-full bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center">
                  <HelpCircle className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                  <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">등록된 FAQ가 없습니다.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[600px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-bold dark:text-white">{editingFaq ? 'FAQ 수정' : '새 FAQ 등록'}</h3>
              <button onClick={closeModal} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">카테고리</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {categories.map((cat: string) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">순서</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">질문</label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="자주 묻는 질문"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">답변</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  rows={5}
                  placeholder="답변 내용"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button onClick={closeModal} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
              <button
                onClick={handleSubmit}
                disabled={!form.question.trim() || !form.answer.trim() || createMutation.isPending || updateMutation.isPending}
                className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                {editingFaq ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-96 rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h3 className="text-sm font-bold dark:text-white">FAQ 삭제</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">이 FAQ를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button onClick={() => setDeleteId(null)} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
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

      {/* Category Management Panel */}
      {showCategoryPanel && <CategoryPanel onClose={() => setShowCategoryPanel(false)} />}
    </div>
  );
}
