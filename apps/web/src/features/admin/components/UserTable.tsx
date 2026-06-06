import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  adminApi,
  type UserDetail,
  type UserUpdateData,
  type UserSellerProfile,
  type UserSellerGrade,
  type UserOrderStats,
} from '@/lib/api/admin';

const ROLE_LABELS: Record<string, string> = { admin: '관리자', seller: '판매자', buyer: '구매자' };
const STATUS_LABELS: Record<string, string> = { active: '활성', banned: '차단', suspended: '정지', inactive: '비활성' };
const GRADE_LABELS: Record<string, string> = { bronze: '브론즈', silver: '실버', gold: '골드', platinum: '플래티넘', diamond: '다이아몬드' };
const GRADE_COLORS: Record<string, string> = {
  bronze: 'text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
  silver: 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300',
  gold: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400',
  platinum: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400',
  diamond: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400',
};

function roleBadge(role: string) {
  const cls =
    role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    : role === 'seller' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{ROLE_LABELS[role] || role}</span>;
}

function statusBadge(status: string | null) {
  const s = status || 'active';
  const cls = (s === 'banned' || s === 'suspended' || s === 'inactive')
    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>{STATUS_LABELS[s] || s}</span>;
}

// --- Tab Button ---
function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
        active
          ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

// --- User Detail/Edit Modal ---
function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'info' | 'seller' | 'orders'>('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UserUpdateData>({});
  const [confirmReset2fa, setConfirmReset2fa] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.getUser(userId).then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: (d: UserUpdateData) => adminApi.updateUser(userId, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      setEditing(false);
      setConfirmReset2fa(false);
    },
  });

  const startEditing = (user: UserDetail) => {
    setForm({
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      nickname: user.nickname || '',
      status: user.status || 'active',
      is_email_verified: user.is_email_verified,
      is_phone_verified: user.is_phone_verified,
      is_udg_member: user.is_udg_member,
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: UserUpdateData = { ...form };
    if (confirmReset2fa) payload.reset_2fa = true;
    updateMutation.mutate(payload);
  };

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-white" />
            <p className="text-sm text-gray-500 dark:text-gray-400">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  const { user, seller_profile, seller_grade, order_stats } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-bold dark:text-white">{user.real_name}</h2>
            <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {roleBadge(user.role)}
            {statusBadge(user.status)}
            <button onClick={onClose} className="ml-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5 dark:border-gray-800">
          <TabButton label="기본 정보" active={tab === 'info'} onClick={() => { setTab('info'); setEditing(false); }} />
          <TabButton label={`판매자 정보${seller_profile ? '' : ' (없음)'}`} active={tab === 'seller'} onClick={() => { setTab('seller'); setEditing(false); }} />
          <TabButton label="주문/거래" active={tab === 'orders'} onClick={() => { setTab('orders'); setEditing(false); }} />
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {tab === 'info' && (
            editing ? (
              <EditInfoTab
                user={user}
                form={form}
                setForm={setForm}
                confirmReset2fa={confirmReset2fa}
                setConfirmReset2fa={setConfirmReset2fa}
                error={updateMutation.isError}
              />
            ) : (
              <InfoTab user={user} />
            )
          )}
          {tab === 'seller' && <SellerTab profile={seller_profile} grade={seller_grade} />}
          {tab === 'orders' && <OrdersTab stats={order_stats} />}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          {tab === 'info' && editing ? (
            <>
              <button onClick={() => { setEditing(false); setConfirmReset2fa(false); }} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
              <button onClick={handleSave} disabled={updateMutation.isPending} className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">닫기</button>
              {tab === 'info' && (
                <button onClick={() => startEditing(user)} className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">수정</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Info Tab (read-only) ---
function InfoTab({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-5 text-sm">
      {/* Account info */}
      <Section title="계정 정보">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <InfoRow label="사용자명" value={user.username} />
          <InfoRow label="이메일" value={user.email} />
          <InfoRow label="전화번호" value={user.phone || '-'} />
          <InfoRow label="실명" value={user.real_name} />
          <InfoRow label="닉네임" value={user.nickname || '-'} />
          <InfoRow label="언어" value={user.locale || 'ko'} />
        </div>
      </Section>

      {/* Status */}
      <Section title="상태 및 역할">
        <div className="grid grid-cols-3 gap-4">
          <div><span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">역할</span><p className="mt-0.5">{roleBadge(user.role)}</p></div>
          <div><span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</span><p className="mt-0.5">{statusBadge(user.status)}</p></div>
          <div><span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">2FA</span><p className={`mt-0.5 font-medium ${user.is_2fa_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{user.is_2fa_enabled ? '활성' : '비활성'}</p></div>
        </div>
      </Section>

      {/* Verification */}
      <Section title="인증 상태">
        <div className="grid grid-cols-3 gap-3">
          <VerifyBadge label="이메일 인증" verified={user.is_email_verified} />
          <VerifyBadge label="전화번호 인증" verified={user.is_phone_verified} />
          <VerifyBadge label="UDG 회원" verified={user.is_udg_member} />
        </div>
      </Section>

      {/* Login & Dates */}
      <Section title="활동 기록">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <InfoRow label="가입일" value={user.created_at ? new Date(user.created_at).toLocaleString('ko-KR') : '-'} />
          <InfoRow label="최근 로그인" value={user.last_login_at ? new Date(user.last_login_at).toLocaleString('ko-KR') : '-'} />
          <InfoRow label="최근 접속 IP" value={user.last_login_ip || '-'} />
          <InfoRow label="최근 수정일" value={user.updated_at ? new Date(user.updated_at).toLocaleString('ko-KR') : '-'} />
        </div>
        {user.withdrawn_at && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            탈퇴일: {new Date(user.withdrawn_at).toLocaleString('ko-KR')}
          </div>
        )}
      </Section>
    </div>
  );
}

// --- Edit Info Tab ---
function EditInfoTab({
  user,
  form,
  setForm,
  confirmReset2fa,
  setConfirmReset2fa,
  error,
}: {
  user: UserDetail;
  form: UserUpdateData;
  setForm: (f: UserUpdateData) => void;
  confirmReset2fa: boolean;
  setConfirmReset2fa: (v: boolean) => void;
  error: boolean;
}) {
  return (
    <div className="space-y-5 text-sm">
      <Section title="계정 정보 수정">
        <div className="space-y-3">
          <FormField label="이메일">
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </FormField>
          <FormField label="전화번호 (E.164, 예: +821012345678)">
            <input
              type="tel"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+821012345678"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              비워두면 기존 번호가 삭제됩니다. 변경 시 인증 상태는 별도로 갱신해 주세요.
            </p>
          </FormField>
          <FormField label="닉네임">
            <input
              type="text"
              value={form.nickname || ''}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </FormField>
        </div>
      </Section>

      <Section title="역할 및 상태">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="역할">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="buyer">구매자</option>
              <option value="seller">판매자</option>
            </select>
          </FormField>
          <FormField label="상태">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="suspended">정지</option>
              <option value="banned">차단</option>
            </select>
          </FormField>
        </div>
      </Section>

      <Section title="인증 상태 변경">
        <div className="space-y-2">
          <ToggleSwitch label="이메일 인증" checked={form.is_email_verified ?? false} onChange={(v) => setForm({ ...form, is_email_verified: v })} />
          <ToggleSwitch label="전화번호 인증" checked={form.is_phone_verified ?? false} onChange={(v) => setForm({ ...form, is_phone_verified: v })} />
          <ToggleSwitch label="UDG 회원" checked={form.is_udg_member ?? false} onChange={(v) => setForm({ ...form, is_udg_member: v })} />
        </div>
      </Section>

      {/* 2FA Reset */}
      {user.is_2fa_enabled && (
        <Section title="2FA (2단계 인증)">
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20">
            <p className="text-orange-700 dark:text-orange-400">현재 2FA가 활성화되어 있습니다.</p>
            {!confirmReset2fa ? (
              <button
                onClick={() => setConfirmReset2fa(true)}
                className="mt-2 rounded-full bg-orange-500 px-3 py-1.5 text-sm text-white hover:bg-orange-600"
              >
                2FA 초기화
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  2FA를 초기화하면 사용자는 다시 설정해야 합니다. 계속하시겠습니까?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmReset2fa(false)} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">취소</button>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-400">저장 시 2FA가 초기화됩니다</span>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {error && <p className="text-sm text-red-500">수정 실패. 다시 시도해 주세요.</p>}
    </div>
  );
}

// --- Seller Tab ---
function SellerTab({ profile, grade }: { profile: UserSellerProfile | null; grade: UserSellerGrade | null }) {
  if (!profile) {
    return (
      <div className="py-12 text-center">
        <Users className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
        <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">판매자 등록 정보가 없습니다</p>
        <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">이 사용자는 판매자로 등록되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Seller Grade */}
      {grade && (
        <Section title="판매자 등급">
          <div className="flex items-center gap-4">
            <span className={`rounded-xl px-4 py-2 text-lg font-bold ${GRADE_COLORS[grade.grade] || 'bg-gray-100 text-gray-600'}`}>
              {GRADE_LABELS[grade.grade] || grade.grade}
            </span>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>점수: <span className="font-medium dark:text-white">{parseFloat(grade.score).toFixed(1)}</span></p>
              <p>산정일: {grade.calculated_at ? new Date(grade.calculated_at).toLocaleDateString('ko-KR') : '-'}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <StatBox label="총 판매" value={`${grade.total_sales}건`} />
            <StatBox label="평균 평점" value={parseFloat(grade.avg_rating).toFixed(1)} />
            <StatBox label="응답률" value={`${parseFloat(grade.response_rate).toFixed(1)}%`} />
            <StatBox label="분쟁률" value={`${parseFloat(grade.dispute_rate).toFixed(1)}%`} color={parseFloat(grade.dispute_rate) > 5 ? 'text-red-600' : undefined} />
          </div>
        </Section>
      )}

      {/* Seller Profile */}
      <Section title="판매자 프로필">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <InfoRow label="판매자 유형" value={profile.seller_type === 'individual' ? '개인' : profile.seller_type === 'business' ? '사업자' : profile.seller_type} />
          <InfoRow label="판매자 상태" value={profile.seller_status} />
          <InfoRow label="지갑 주소" value={profile.wallet_address.slice(0, 10) + '...' + profile.wallet_address.slice(-6)} />
          <InfoRow label="연락처" value={profile.contact_phone || '-'} />
          <InfoRow label="등록일" value={profile.seller_created_at ? new Date(profile.seller_created_at).toLocaleDateString('ko-KR') : '-'} />
          <InfoRow label="승인일" value={profile.approved_at ? new Date(profile.approved_at).toLocaleDateString('ko-KR') : '-'} />
        </div>
      </Section>

      {/* Sales Performance */}
      <Section title="판매 성과">
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="총 판매 건수" value={`${profile.total_sales}건`} />
          <StatBox label="총 매출" value={`${parseFloat(profile.total_revenue).toLocaleString()} USDT`} />
          <StatBox label="평균 평점" value={`${parseFloat(profile.avg_rating).toFixed(1)} / 5.0`} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatBox label="응답률" value={`${parseFloat(profile.response_rate).toFixed(1)}%`} />
          <StatBox label="평균 배송일" value={`${parseFloat(profile.avg_ship_days).toFixed(1)}일`} />
          <StatBox label="분쟁 건수" value={`${profile.dispute_count}건`} color={profile.dispute_count > 0 ? 'text-red-600' : undefined} />
        </div>
      </Section>

      {/* Financial */}
      <Section title="재무 정보">
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="보증금" value={`${parseFloat(profile.deposit_amount).toLocaleString()} USDT`} />
          <StatBox label="잔액" value={`${parseFloat(profile.balance).toLocaleString()} USDT`} />
          <StatBox label="등급 점수" value={`${parseFloat(profile.grade_score).toFixed(2)}`} />
        </div>
      </Section>
    </div>
  );
}

// --- Orders Tab ---
function OrdersTab({ stats }: { stats: UserOrderStats }) {
  return (
    <div className="space-y-5 text-sm">
      <Section title="구매 통계">
        <div className="grid grid-cols-2 gap-4">
          <StatBox label="총 주문 수" value={`${stats.total_orders}건`} large />
          <StatBox label="총 구매 금액" value={`${parseFloat(stats.total_spent).toLocaleString()} USDT`} large />
          <StatBox label="완료된 주문" value={`${stats.completed_orders}건`} large />
          <StatBox label="취소/환불" value={`${stats.cancelled_orders}건`} large color={stats.cancelled_orders > 0 ? 'text-red-600' : undefined} />
        </div>
      </Section>

      {stats.total_orders > 0 && (
        <Section title="주문 완료율">
          <div className="relative h-4 rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${stats.total_orders > 0 ? (stats.completed_orders / stats.total_orders * 100) : 0}%` }}
            />
          </div>
          <p className="mt-1 text-center text-gray-500 dark:text-gray-400">
            {stats.total_orders > 0 ? (stats.completed_orders / stats.total_orders * 100).toFixed(1) : 0}%
          </p>
        </Section>
      )}
    </div>
  );
}

// --- Shared Components ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[12px] font-bold text-gray-500 dark:text-gray-400">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</span>
      <p className="font-medium dark:text-white">{value}</p>
    </div>
  );
}

function StatBox({ label, value, large, color }: { label: string; value: string; large?: boolean; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`${large ? 'text-xl' : 'text-lg'} font-bold ${color || 'dark:text-white'}`}>{value}</p>
    </div>
  );
}

function VerifyBadge({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className={`rounded-xl p-2 text-center text-xs font-medium ${
      verified ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
    }`}>
      <div className="text-base">{verified ? '✓' : '✗'}</div>
      <div>{label}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1">
      <span className="text-sm dark:text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-gray-900 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

// --- Main UserTable ---
export function UserTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const statsQ = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: () => adminApi.getUserStats().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search, roleFilter],
    queryFn: () => adminApi.getUsers(page, 20, search || undefined, roleFilter || undefined).then((r) => r.data),
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => adminApi.blockUser(id, blocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 p-3 dark:bg-gray-800">
              <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
              <div className="h-6 w-8 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 h-64" />
      </div>
    );
  }

  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold dark:text-white">회원 관리</h1>
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">전체 역할</option>
            <option value="buyer">구매자</option>
            <option value="seller">판매자</option>
            <option value="admin">관리자</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="이메일, 이름, 닉네임 검색..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-64 rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {statsQ.isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-100 p-3 dark:bg-gray-800">
              <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
              <div className="h-6 w-8 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">전체 회원</p>
            <p className="text-xl font-bold dark:text-white">{stats.total_users}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">구매자</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.buyers}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">판매자</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.sellers}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">관리자</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.admins}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">활성</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">{stats.active_users}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">차단</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{stats.banned_users}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">정지</p>
            <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{stats.suspended_users}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-3 bg-white dark:bg-gray-900 dark:border-gray-800">
            <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">신규 (7일)</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{stats.new_users_7d}</p>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400">
        총 {data.pagination.total}명{roleFilter && ` (${ROLE_LABELS[roleFilter]})`}{search && ` · "${search}"`}
      </p>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">이메일</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">이름</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">닉네임</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">역할</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">가입일</th>
                <th className="px-5 py-3 text-left text-[12px] font-bold text-gray-500 dark:text-gray-400">최근 로그인</th>
                <th className="px-5 py-3 text-center text-[12px] font-bold text-gray-500 dark:text-gray-400">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((user) => (
                <tr key={user.id} className="cursor-pointer border-b border-gray-50 hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/50" onClick={() => setSelectedUserId(user.id)}>
                  <td className="px-5 py-3 dark:text-gray-300">{user.email}</td>
                  <td className="px-5 py-3 dark:text-gray-300">{user.real_name}</td>
                  <td className="px-5 py-3 dark:text-gray-300">{user.nickname || '-'}</td>
                  <td className="px-5 py-3">{roleBadge(user.role)}</td>
                  <td className="px-5 py-3">{statusBadge(user.status)}</td>
                  <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400">{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-5 py-3 text-[12px] text-gray-500 dark:text-gray-400">{user.last_login_at ? new Date(user.last_login_at).toLocaleString('ko-KR') : '-'}</td>
                  <td className="px-5 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelectedUserId(user.id)} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">상세</button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => blockMutation.mutate({ id: user.id, blocked: user.status !== 'banned' })}
                          disabled={blockMutation.isPending}
                          className={`rounded-full px-3 py-1 text-xs disabled:opacity-50 ${user.status === 'banned' ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100' : 'bg-red-600 text-white hover:bg-red-700'}`}
                        >
                          {user.status === 'banned' ? '해제' : '차단'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center">
                  <Users className="mx-auto h-14 w-14 text-gray-200 dark:text-gray-700" />
                  <p className="mt-3 text-sm font-bold text-gray-500 dark:text-gray-400">회원이 없습니다.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(data.pagination.total_pages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button key={p} onClick={() => setPage(p)} className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${page === p ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
                {p}
              </button>
            );
          })}
          {data.pagination.total_pages > 7 && (
            <span className="px-1 text-sm text-gray-400">...</span>
          )}
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pagination.total_pages} className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedUserId && <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}
    </div>
  );
}
