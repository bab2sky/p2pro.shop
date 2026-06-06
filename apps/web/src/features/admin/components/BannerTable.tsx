import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Image, X } from 'lucide-react';
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  type Banner,
} from '@/lib/api/content';
import { uploadImage } from '@/lib/api/reviews';

interface BannerFormData {
  title: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  starts_at: string;
  ends_at: string;
}

const emptyForm: BannerFormData = {
  title: '',
  image_url: '',
  link_url: '',
  sort_order: 0,
  starts_at: '',
  ends_at: '',
};

export function BannerTable() {
  const queryClient = useQueryClient();
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<BannerFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('JPG, PNG, WebP 이미지만 업로드 가능합니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다.');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImage(file, 'banners');
      setForm((prev) => ({ ...prev, image_url: result.data.url }));
    } catch {
      toast.error('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: () => getBanners(),
  });

  const createMutation = useMutation({
    mutationFn: (data: BannerFormData) =>
      createBanner({
        title: data.title,
        image_url: data.image_url,
        link_url: data.link_url || undefined,
        sort_order: data.sort_order,
        starts_at: data.starts_at || undefined,
        ends_at: data.ends_at || undefined,
      }),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateBanner>[1] }) =>
      updateBanner(id, data),
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    },
  });

  const openCreate = () => {
    setEditingBanner(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      sort_order: banner.sort_order,
      starts_at: banner.starts_at || '',
      ends_at: banner.ends_at || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBanner(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (editingBanner) {
      updateMutation.mutate({
        id: editingBanner.id,
        data: {
          title: form.title,
          image_url: form.image_url,
          link_url: form.link_url || undefined,
          sort_order: form.sort_order,
          starts_at: form.starts_at || undefined,
          ends_at: form.ends_at || undefined,
        },
      });
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
        <h1 className="text-2xl font-bold dark:text-white">배너 관리</h1>
        <button
          onClick={openCreate}
          className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          새 배너 등록
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">미리보기</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">제목</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">순서</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">기간</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((banner) => (
                <tr key={banner.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="h-12 w-20 rounded-xl object-cover border border-gray-200 dark:border-gray-800"
                    />
                  </td>
                  <td className="px-5 py-3 font-medium dark:text-gray-200">{banner.title}</td>
                  <td className="px-5 py-3 text-center dark:text-gray-300">{banner.sort_order}</td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        banner.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {banner.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400">
                    {banner.starts_at
                      ? new Date(banner.starts_at).toLocaleDateString()
                      : '시작일 없음'}
                    {' ~ '}
                    {banner.ends_at
                      ? new Date(banner.ends_at).toLocaleDateString()
                      : '종료일 없음'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => openEdit(banner)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        수정
                      </button>
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: banner.id,
                            data: { is_active: !banner.is_active },
                          })
                        }
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        {banner.is_active ? '비활성' : '활성'}
                      </button>
                      <button
                        onClick={() => setDeleteId(banner.id)}
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
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Image className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                    <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">등록된 배너가 없습니다.</p>
                  </td>
                </tr>
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
              <h3 className="text-sm font-bold dark:text-white">
                {editingBanner ? '배너 수정' : '새 배너 등록'}
              </h3>
              <button onClick={closeModal} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">제목</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="배너 제목"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">배너 이미지</label>
                {/* Upload area */}
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                    form.image_url
                      ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                      : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-white" />
                      <p className="text-sm text-gray-900 dark:text-white">업로드 중...</p>
                    </div>
                  ) : form.image_url ? (
                    <div>
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="mx-auto h-28 rounded-xl object-cover mb-2"
                      />
                      <p className="text-[12px] text-gray-500 dark:text-gray-400">클릭하여 이미지 변경</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Image className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">클릭하여 이미지를 업로드하세요</p>
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">JPG, PNG, WebP / 최대 5MB</p>
                    </div>
                  )}
                </div>
                {/* URL fallback */}
                <div className="mt-2">
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-1">또는 이미지 URL 직접 입력</p>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">링크 URL</label>
                <input
                  type="text"
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder="클릭 시 이동할 URL (선택)"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">순서</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">시작일</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                    onChange={(e) =>
                      setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : '' })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">종료일</label>
                  <input
                    type="datetime-local"
                    value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                    onChange={(e) =>
                      setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : '' })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button onClick={closeModal} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  !form.title.trim() ||
                  !form.image_url.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                {editingBanner ? '수정' : '등록'}
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
              <h3 className="text-sm font-bold dark:text-white">배너 삭제</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                이 배너를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
