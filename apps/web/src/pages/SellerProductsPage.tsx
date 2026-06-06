import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Pencil,
  Trash2,
  Star,
  Heart,
  ShoppingBag,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { getSellerProducts, deleteProduct, type ProductSummary } from '@/lib/api/products';
import { getMySellerProfile } from '@/lib/api/seller';
import { confirmAction } from '@/lib/confirm';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '심사대기', color: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' },
  active: { label: '판매중', color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' },
  rejected: { label: '반려', color: 'bg-red-50 text-red-500 dark:bg-red-500/10' },
  suspended: { label: '정지', color: 'bg-orange-50 text-orange-500 dark:bg-orange-500/10' },
  deleted: { label: '삭제됨', color: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' },
};

const STATUS_FILTERS = [
  { value: undefined, label: '전체' },
  { value: 'active', label: '판매중' },
  { value: 'pending', label: '심사대기' },
  { value: 'rejected', label: '반려' },
  { value: 'suspended', label: '정지' },
];

export default function SellerProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data: profileData } = useQuery({
    queryKey: ['sellerProfile'],
    queryFn: getMySellerProfile,
  });

  const sellerStatus = profileData?.data?.status;
  const isApproved = sellerStatus === 'approved';

  const { data, isLoading } = useQuery({
    queryKey: ['sellerProducts', statusFilter],
    queryFn: () => getSellerProducts({ per_page: 100, status: statusFilter }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sellerProducts'] }),
  });

  if (isLoading)
    return (
      <div className="max-w-6xl space-y-3 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" style={{ height: 96 }} />
        ))}
      </div>
    );

  const products = data?.data ?? [];

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">상품 관리</h1>
        {isApproved ? (
          <Link
            to="/seller/products/new"
            className="flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            상품 등록
          </Link>
        ) : (
          <span
            className="flex cursor-not-allowed items-center gap-1.5 rounded-full bg-gray-200 px-5 py-2.5 text-[13px] font-bold text-gray-400 dark:bg-gray-800 dark:text-gray-500"
            title={
              sellerStatus === 'pending' ? '판매자 승인 후 상품 등록이 가능합니다' :
              sellerStatus === 'suspended' ? '판매자 활동이 정지되어 상품 등록이 불가합니다' :
              '판매자 승인이 필요합니다'
            }
          >
            <Plus className="h-4 w-4" />
            상품 등록
          </span>
        )}
      </div>

      {/* Status alert for non-approved sellers */}
      {sellerStatus === 'suspended' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-orange-50 p-4 dark:bg-orange-500/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <p className="text-sm text-orange-700 dark:text-orange-400">판매자 활동이 정지되어 상품 등록/수정이 불가합니다. 기존 상품은 조회만 가능합니다.</p>
        </div>
      )}
      {sellerStatus === 'pending' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-400">판매자 승인 대기 중입니다. 승인 후 상품 등록이 가능합니다.</p>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value ?? 'all'}
            onClick={() => setStatusFilter(f.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {statusFilter ? `${STATUS_LABELS[statusFilter]?.label ?? statusFilter} 상태의 상품이 없습니다.` : '등록된 상품이 없습니다.'}
          </p>
          {!statusFilter && isApproved && (
            <Link to="/seller/products/new" className="mt-3 flex items-center gap-1 text-[13px] font-medium text-pink-500 transition-colors hover:text-pink-600">
              <Plus className="h-3.5 w-3.5" />
              첫 상품 등록하기
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p: ProductSummary) => {
            const statusInfo = STATUS_LABELS[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
            return (
              <div key={p.id} className="flex gap-4 rounded-2xl border border-gray-300 bg-white p-4 transition-all hover:shadow-md dark:border-gray-600 dark:bg-gray-900">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                  {p.main_image ? (
                    <img src={p.main_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No Image</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{p.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  {p.category_name && (
                    <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">{p.category_name}</p>
                  )}
                  <p className="mt-1 text-sm font-bold text-pink-500">₮ {p.final_price} <span className="text-[12px] font-medium text-gray-400">USDT</span> <span className="ml-1 text-[12px] font-medium text-gray-400">재고: {p.stock}</span></p>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-gray-400">
                    <span className="flex items-center gap-0.5"><ShoppingBag className="h-3 w-3" /> {p.sold_count}건</span>
                    <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {p.wishlist_count}</span>
                    <span className="flex items-center gap-0.5">리뷰 {p.review_count}건</span>
                    {p.avg_rating && Number(p.avg_rating) > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-400"><Star className="h-3 w-3" /> {Number(p.avg_rating).toFixed(1)}</span>
                    )}
                  </div>
                  {p.rejected_reason && (p.status === 'rejected' || p.status === 'suspended') && (
                    <p className="mt-1 text-[12px] text-red-500">사유: {p.rejected_reason}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  {isApproved && ['active', 'pending', 'rejected'].includes(p.status) && (
                    <button
                      onClick={() => navigate(`/seller/products/${p.id}/edit`)}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      <Pencil className="h-3 w-3" />
                      수정
                    </button>
                  )}
                  {isApproved && ['active', 'pending', 'rejected'].includes(p.status) && (
                    <button
                      onClick={async () => { if (await confirmAction('정말 삭제하시겠습니까?')) deleteMut.mutate(p.id); }}
                      className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      삭제
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
