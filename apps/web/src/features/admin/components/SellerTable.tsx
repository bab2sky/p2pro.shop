import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi, type SellerInfo, type SellerStats } from '@/lib/api/admin';

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  pending: { label: '대기', bg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  approved: { label: '승인', bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  suspended: { label: '정지', bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  rejected: { label: '거부', bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

const GRADE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Bronze', color: 'text-amber-600' },
  2: { label: 'Silver', color: 'text-slate-500' },
  3: { label: 'Gold', color: 'text-yellow-500' },
  4: { label: 'Platinum', color: 'text-gray-500' },
  5: { label: 'Diamond', color: 'text-purple-500' },
};

const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'approved', label: '승인' },
  { value: 'suspended', label: '정지' },
  { value: 'rejected', label: '거부' },
];

function formatMoney(val: string | null) {
  if (!val) return '$0';
  const n = parseFloat(val);
  return isNaN(n) ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function truncateAddr(addr: string | null) {
  if (!addr) return '-';
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

export function SellerTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<SellerInfo | null>(null);
  const [modal, setModal] = useState<'detail' | 'reject' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');
  const [editingWallet, setEditingWallet] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);

  // Stats query
  const { data: statsData } = useQuery({
    queryKey: ['admin', 'sellers', 'stats'],
    queryFn: () => adminApi.getSellerStats().then((r) => r.data.data),
  });

  // List query
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sellers', page, statusFilter, search],
    queryFn: () => adminApi.getSellers(page, 20, statusFilter || undefined, search || undefined).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'approved' | 'suspended' | 'rejected'; reason?: string }) =>
      adminApi.updateSellerStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sellers'] });
      setModal(null);
      setReason('');
      setSelectedSeller(null);
    },
  });

  const walletMutation = useMutation({
    mutationFn: ({ id, wallet_address, reason }: { id: string; wallet_address: string; reason?: string }) =>
      adminApi.updateSellerWallet(id, wallet_address, reason),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sellers'] });
      setEditingWallet(false);
      setWalletError(null);
      setWalletReason('');
      // 모달에 표시되는 데이터를 즉시 반영
      if (selectedSeller && selectedSeller.id === vars.id) {
        setSelectedSeller({ ...selectedSeller, wallet_address: res.data.data.wallet_address });
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || '지갑 주소 변경에 실패했습니다.';
      setWalletError(msg);
    },
  });

  const startEditWallet = () => {
    if (!selectedSeller) return;
    setWalletInput(selectedSeller.wallet_address || '');
    setWalletReason('');
    setWalletError(null);
    setEditingWallet(true);
  };

  const cancelEditWallet = () => {
    setEditingWallet(false);
    setWalletError(null);
    setWalletReason('');
  };

  const submitWallet = () => {
    if (!selectedSeller) return;
    const trimmed = walletInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setWalletError('BEP-20 지갑 주소만 등록 가능합니다 (0x + 40자리 16진수).');
      return;
    }
    if (trimmed === (selectedSeller.wallet_address || '')) {
      setWalletError('기존 지갑 주소와 동일합니다.');
      return;
    }
    walletMutation.mutate({
      id: selectedSeller.id,
      wallet_address: trimmed,
      reason: walletReason.trim() || undefined,
    });
  };

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const openModal = (seller: SellerInfo, type: 'detail' | 'reject' | 'suspend') => {
    setSelectedSeller(seller);
    setModal(type);
    setReason('');
    setEditingWallet(false);
    setWalletError(null);
    setWalletReason('');
  };

  const stats: SellerStats = statsData || {
    total_sellers: 0, pending_sellers: 0, approved_sellers: 0,
    suspended_sellers: 0, rejected_sellers: 0, today_new: 0,
    total_revenue: '0', total_balance: '0',
  };

  const statCards = [
    { label: '전체 판매자', value: stats.total_sellers },
    { label: '승인 대기', value: stats.pending_sellers, highlight: stats.pending_sellers > 0 },
    { label: '활동 중', value: stats.approved_sellers },
    { label: '정지/거부', value: stats.suspended_sellers + stats.rejected_sellers },
    { label: '오늘 신규', value: stats.today_new },
    { label: '총 매출', value: formatMoney(stats.total_revenue) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold dark:text-white">판매자 관리</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 ${card.highlight ? 'ring-2 ring-yellow-400' : ''}`}>
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="mt-1 text-xl font-bold dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이름, 이메일, 연락처 검색..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <button type="submit" className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">검색</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">초기화</button>
          )}
        </form>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === f.value
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {f.label}
              {f.value === 'pending' && stats.pending_sellers > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{stats.pending_sellers}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-64" />
      )}

      {/* Table */}
      {!isLoading && data && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">유형</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">지갑</th>
                  <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">잔액</th>
                  <th className="px-5 py-3 text-right text-[12px] font-bold text-gray-500 dark:text-gray-400">매출</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">등급</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">평점</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                  <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">등록일</th>
                  <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((seller) => {
                  const gradeInfo = GRADE_LABELS[seller.grade ?? 1] || GRADE_LABELS[1];
                  const statusCfg = STATUS_CONFIG[seller.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={seller.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50">
                      {/* Seller name + email */}
                      <td className="px-5 py-3">
                        <button onClick={() => openModal(seller, 'detail')} className="text-left hover:underline">
                          <p className="font-medium dark:text-gray-200">{seller.seller_name}</p>
                          <p className="text-[12px] text-gray-400">{seller.email || '-'}</p>
                        </button>
                      </td>
                      <td className="px-5 py-3 dark:text-gray-300">
                        <span className={`text-xs ${seller.seller_type === 'business' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                          {seller.seller_type === 'business' ? '사업자' : '개인'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {truncateAddr(seller.wallet_address)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-pink-500">{formatMoney(seller.balance)}</td>
                      <td className="px-5 py-3 text-right text-pink-500">{formatMoney(seller.total_revenue)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs font-bold ${gradeInfo.color}`}>{gradeInfo.label}</span>
                      </td>
                      <td className="px-5 py-3 text-center dark:text-gray-300">
                        {seller.avg_rating ? parseFloat(seller.avg_rating).toFixed(1) : '-'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusCfg.bg}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400">
                        {seller.created_at ? new Date(seller.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {seller.status === 'pending' && (
                            <>
                              <button onClick={() => statusMutation.mutate({ id: seller.id, status: 'approved' })}
                                disabled={statusMutation.isPending}
                                className="rounded-full bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
                                승인
                              </button>
                              <button onClick={() => openModal(seller, 'reject')}
                                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">
                                거부
                              </button>
                            </>
                          )}
                          {seller.status === 'approved' && (
                            <button onClick={() => openModal(seller, 'suspend')}
                              className="rounded-full bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">
                              정지
                            </button>
                          )}
                          {seller.status === 'suspended' && (
                            <button onClick={() => statusMutation.mutate({ id: seller.id, status: 'approved' })}
                              disabled={statusMutation.isPending}
                              className="rounded-full bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                              복원
                            </button>
                          )}
                          {seller.status === 'rejected' && (
                            <button onClick={() => statusMutation.mutate({ id: seller.id, status: 'approved' })}
                              disabled={statusMutation.isPending}
                              className="rounded-full bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50">
                              재승인
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center">
                      <Store className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                      <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">
                        {search ? `"${search}" 검색 결과가 없습니다.` : '등록된 판매자가 없습니다.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">
            {page} / {data.pagination.total_pages} (총 {data.pagination.total}명)
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pagination.total_pages}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {modal === 'detail' && selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <h3 className="text-sm font-bold dark:text-white">판매자 상세 정보</h3>
              <button onClick={() => setModal(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자명</p>
                  <p className="font-medium dark:text-gray-200">{selectedSeller.seller_name}</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">이메일</p>
                  <p className="dark:text-gray-200">{selectedSeller.email || '-'}</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">유형</p>
                  <p className="dark:text-gray-200">{selectedSeller.seller_type === 'business' ? '사업자' : '개인'}</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">연락처</p>
                  <p className="dark:text-gray-200">{selectedSeller.contact_phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">지갑 주소 (BEP-20)</p>
                    {!editingWallet && (
                      <button
                        onClick={startEditWallet}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                      >
                        지갑 주소 변경
                      </button>
                    )}
                  </div>
                  {!editingWallet ? (
                    <p className="break-all font-mono text-xs dark:text-gray-200">{selectedSeller.wallet_address || '-'}</p>
                  ) : (
                    <div className="mt-2 space-y-2 rounded-xl border border-orange-200 bg-orange-50/50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
                      <p className="text-[11px] font-bold text-orange-700 dark:text-orange-400">
                        ⚠ 정산 지갑 변경은 분실/오기재 등 예외 상황에만 사용하세요. 변경 즉시 판매자에게 알림이 발송되고 감사 로그에 기록됩니다.
                      </p>
                      <input
                        type="text"
                        value={walletInput}
                        onChange={(e) => { setWalletInput(e.target.value); setWalletError(null); }}
                        placeholder="0x로 시작하는 42자리 주소"
                        spellCheck={false}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      />
                      <input
                        type="text"
                        value={walletReason}
                        onChange={(e) => setWalletReason(e.target.value)}
                        placeholder="변경 사유 (감사 로그에 기록)"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      />
                      {walletError && (
                        <p className="text-xs text-red-600 dark:text-red-400">{walletError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEditWallet}
                          disabled={walletMutation.isPending}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
                        >
                          취소
                        </button>
                        <button
                          onClick={submitWallet}
                          disabled={walletMutation.isPending}
                          className="rounded-full bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                        >
                          {walletMutation.isPending ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">잔액</p>
                  <p className="font-bold text-pink-500">{formatMoney(selectedSeller.balance)}</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">총 매출</p>
                  <p className="font-bold text-pink-500">{formatMoney(selectedSeller.total_revenue)}</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">판매 건수</p>
                  <p className="dark:text-gray-200">{selectedSeller.total_sales ?? 0}건</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">평점</p>
                  <p className="dark:text-gray-200">{selectedSeller.avg_rating ? parseFloat(selectedSeller.avg_rating).toFixed(1) : '-'} / 5.0</p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">등급</p>
                  <p className={`font-bold ${GRADE_LABELS[selectedSeller.grade ?? 1]?.color || ''}`}>
                    {GRADE_LABELS[selectedSeller.grade ?? 1]?.label || 'Bronze'}
                    {selectedSeller.grade_score && <span className="ml-1 text-xs text-gray-400">({parseFloat(selectedSeller.grade_score).toFixed(1)}점)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">분쟁 횟수</p>
                  <p className={`dark:text-gray-200 ${(selectedSeller.dispute_count ?? 0) > 0 ? 'text-red-600 font-bold' : ''}`}>
                    {selectedSeller.dispute_count ?? 0}건
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</p>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_CONFIG[selectedSeller.status]?.bg || ''}`}>
                    {STATUS_CONFIG[selectedSeller.status]?.label || selectedSeller.status}
                  </span>
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">등록일</p>
                  <p className="dark:text-gray-200">{selectedSeller.created_at ? new Date(selectedSeller.created_at).toLocaleString() : '-'}</p>
                </div>
                {selectedSeller.approved_at && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">승인일</p>
                    <p className="dark:text-gray-200">{new Date(selectedSeller.approved_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedSeller.rejected_reason && (
                  <div className="col-span-2">
                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">거부/정지 사유</p>
                    <p className="text-red-600 dark:text-red-400">{selectedSeller.rejected_reason}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              {selectedSeller.status === 'pending' && (
                <>
                  <button onClick={() => statusMutation.mutate({ id: selectedSeller.id, status: 'approved' })}
                    disabled={statusMutation.isPending}
                    className="rounded-full bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">승인</button>
                  <button onClick={() => { setModal('reject'); setReason(''); }}
                    className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">거부</button>
                </>
              )}
              {selectedSeller.status === 'approved' && (
                <button onClick={() => { setModal('suspend'); setReason(''); }}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">정지</button>
              )}
              {(selectedSeller.status === 'suspended' || selectedSeller.status === 'rejected') && (
                <button onClick={() => statusMutation.mutate({ id: selectedSeller.id, status: 'approved' })}
                  disabled={statusMutation.isPending}
                  className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                  {selectedSeller.status === 'rejected' ? '재승인' : '복원'}
                </button>
              )}
              <button onClick={() => setModal(null)} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {modal === 'reject' && selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-bold dark:text-white">판매자 신청 거부</h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">{selectedSeller.seller_name}</span> 판매자 신청을 거부합니다.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="거부 사유를 입력하세요 (필수)"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
              <button
                onClick={() => reason.trim() && statusMutation.mutate({ id: selectedSeller.id, status: 'rejected', reason })}
                disabled={!reason.trim() || statusMutation.isPending}
                className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                {statusMutation.isPending ? '처리 중...' : '거부'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {modal === 'suspend' && selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-bold text-red-600 dark:text-red-400">판매자 활동 정지</h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">{selectedSeller.seller_name}</span> 판매자를 정지합니다.
            </p>
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              정지 시 해당 판매자의 역할이 일반 사용자로 변경되며, 상품 등록 및 판매가 불가능합니다.
              {selectedSeller.balance && parseFloat(selectedSeller.balance) > 0 && (
                <p className="mt-1 font-bold">현재 잔액: {formatMoney(selectedSeller.balance)} (출금 불가 상태)</p>
              )}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="정지 사유를 입력하세요 (필수)"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
              <button
                onClick={() => reason.trim() && statusMutation.mutate({ id: selectedSeller.id, status: 'suspended', reason })}
                disabled={!reason.trim() || statusMutation.isPending}
                className="rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {statusMutation.isPending ? '처리 중...' : '정지'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
