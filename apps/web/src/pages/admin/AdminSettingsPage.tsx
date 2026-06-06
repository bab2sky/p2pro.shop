import { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sanitizeHtml } from '@/lib/sanitize';
import { adminApi } from '@/lib/api/admin';
import type { HealthStatus } from '@/lib/api/admin';
import { extractApiError } from '@/lib/api-error';
import { Save, CheckCircle2, AlertCircle, Eye, Pencil, Settings, Wallet, FileText, Shield, Building2, Zap } from 'lucide-react';

const RichTextEditor = lazy(() => import('@/components/common/RichTextEditor'));

type Tab = 'trade' | 'wallet' | 'udg' | 'terms' | 'privacy' | 'about';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'trade', label: '거래 설정', icon: Settings },
  { key: 'wallet', label: 'USDT 지갑 설정', icon: Wallet },
  { key: 'udg', label: 'UDG 연동', icon: Zap },
  { key: 'terms', label: '이용약관', icon: FileText },
  { key: 'privacy', label: '개인정보처리방침', icon: Shield },
  { key: 'about', label: '회사소개', icon: Building2 },
];

const TRADE_SETTINGS = [
  { key: 'commission_rate', label: '수수료율', type: 'number', step: '0.01', min: '0', max: '1', hint: '0~1 사이 값 (예: 0.05 = 5%)' },
  { key: 'auto_confirm_days', label: '자동 구매확정 (일)', type: 'number', step: '1', min: '1' },
  { key: 'txid_timeout_hours', label: 'TXID 입력 제한시간 (시간)', type: 'number', step: '1', min: '1' },
  { key: 'min_withdrawal', label: '최소 출금 금액 (USDT)', type: 'number', step: '0.1', min: '0' },
  { key: 'withdrawal_fee_rate', label: '출금 수수료율', type: 'number', step: '0.01', min: '0', max: '1', hint: '0~1 사이 값 (예: 0.05 = 5%)' },
  { key: 'dispute_deadline_days', label: '분쟁 처리 기한 (일)', type: 'number', step: '1', min: '1' },
];

interface WalletNetworkConfig {
  id: 'TRC-20' | 'ERC-20' | 'BEP-20';
  label: string;
  desc: string;
  settingKey: 'company_wallet_tron' | 'company_wallet_eth' | 'company_wallet_address';
  placeholder: string;
}

const WALLET_NETWORKS: WalletNetworkConfig[] = [
  { id: 'TRC-20', label: 'TRC-20', desc: 'Tron 네트워크 (낮은 수수료)', settingKey: 'company_wallet_tron', placeholder: 'T로 시작하는 TRON 주소' },
  { id: 'ERC-20', label: 'ERC-20', desc: 'Ethereum 네트워크 (높은 보안)', settingKey: 'company_wallet_eth', placeholder: '0x로 시작하는 ETH 주소' },
  { id: 'BEP-20', label: 'BEP-20', desc: 'BNB Smart Chain (빠른 전송)', settingKey: 'company_wallet_address', placeholder: '0x로 시작하는 BSC 주소' },
];

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('trade');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data.data),
  });

  useEffect(() => {
    if (!settingsData) return;
    const next = { ...settingsData };
    // Legacy: admin 이 기존에 usdt_wallet_network/address 로만 저장했을 때
    // 해당 네트워크의 company_wallet_* 값이 비어 있으면 prefill
    const legacyNet = (next.usdt_wallet_network || '').toUpperCase();
    const legacyAddr = (next.usdt_wallet_address || '').trim();
    if (legacyAddr) {
      const map: Record<string, string> = {
        'TRC20': 'company_wallet_tron',
        'TRC-20': 'company_wallet_tron',
        'ERC20': 'company_wallet_eth',
        'ERC-20': 'company_wallet_eth',
        'BEP20': 'company_wallet_address',
        'BEP-20': 'company_wallet_address',
      };
      const targetKey = map[legacyNet];
      if (targetKey && !(next[targetKey] || '').trim()) {
        next[targetKey] = legacyAddr;
      }
    }
    setValues(next);
  }, [settingsData]);

  const mutation = useMutation({
    mutationFn: (settings: Record<string, string>) => adminApi.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setSaved(true);
      setSaveError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setSaveError(extractApiError(err));
    },
  });

  const saveKeys = (keys: string[]) => {
    const data: Record<string, string> = {};
    keys.forEach((k) => {
      if (values[k] !== undefined && values[k] !== '') data[k] = values[k];
    });
    if (Object.keys(data).length > 0) mutation.mutate(data);
  };

  if (isLoading) return (
    <div className="max-w-4xl space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">시스템 설정</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSaved(false); setSaveError(''); }}
            className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
              tab === t.key
                ? 'border-gray-900 font-bold text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'trade' && (
        <TradeSettingsTab
          values={values}
          setValues={setValues}
          onSave={() => saveKeys(TRADE_SETTINGS.map((s) => s.key))}
          isPending={mutation.isPending}
          saved={saved}
          error={saveError}
        />
      )}
      {tab === 'wallet' && (
        <WalletSettingsTab
          values={values}
          setValues={setValues}
          onSave={() => saveKeys(WALLET_NETWORKS.map((n) => n.settingKey))}
          isPending={mutation.isPending}
          saved={saved}
          error={saveError}
        />
      )}
      {tab === 'udg' && <UdgStatusTab />}
      {tab === 'terms' && (
        <TextSettingsTab
          title="이용약관"
          description="서비스 이용약관을 작성합니다. 회원가입 시 동의를 받습니다."
          settingKey="terms_of_service"
          values={values}
          setValues={setValues}
          onSave={() => saveKeys(['terms_of_service'])}
          isPending={mutation.isPending}
          saved={saved}
          error={saveError}
        />
      )}
      {tab === 'privacy' && (
        <TextSettingsTab
          title="개인정보처리방침"
          description="개인정보 수집 및 이용에 관한 방침을 작성합니다."
          settingKey="privacy_policy"
          values={values}
          setValues={setValues}
          onSave={() => saveKeys(['privacy_policy'])}
          isPending={mutation.isPending}
          saved={saved}
          error={saveError}
        />
      )}
      {tab === 'about' && (
        <TextSettingsTab
          title="회사소개"
          description="회사소개 페이지에 표시될 내용을 작성합니다."
          settingKey="about_page"
          values={values}
          setValues={setValues}
          onSave={() => saveKeys(['about_page'])}
          isPending={mutation.isPending}
          saved={saved}
          error={saveError}
        />
      )}
    </div>
  );
}

// --- Trade Settings ---
function TradeSettingsTab({
  values,
  setValues,
  onSave,
  isPending,
  saved,
  error,
}: {
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
  error: string;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        거래, 출금, 분쟁 관련 기본 설정값을 관리합니다.
      </p>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">거래 파라미터</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5">
          {TRADE_SETTINGS.map(({ key, label, type, step, min, max, hint }) => (
            <div key={key}>
              <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</label>
              <input
                type={type}
                value={values[key] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                step={step}
                min={min}
                max={max}
              />
              {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
            </div>
          ))}
        </div>
      </div>
      <SaveBar onSave={onSave} isPending={isPending} saved={saved} error={error} />
    </div>
  );
}

// --- USDT Wallet Settings ---
function WalletSettingsTab({
  values,
  setValues,
  onSave,
  isPending,
  saved,
  error,
}: {
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
  error: string;
}) {
  const configured = WALLET_NETWORKS.filter((n) => (values[n.settingKey] || '').trim() !== '');

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">USDT 입금 주소 설정</h3>
        </div>
        <div className="p-5 space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            네트워크별로 USDT 입금 주소를 설정합니다. 비워둔 네트워크는 구매자 결제 화면에서 선택할 수 없습니다.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            모든 상품 판매 대금은 이 주소로 입금됩니다. 구매 확정 후 판매자에게 수수료를 제외한 판매대금이 지급됩니다.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {WALLET_NETWORKS.map((net) => {
          const value = values[net.settingKey] || '';
          return (
            <div key={net.id} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{net.label}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{net.desc}</p>
                </div>
                {value.trim() ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    활성
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    미설정
                  </span>
                )}
              </div>
              <div className="p-5">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValues((prev) => ({ ...prev, [net.settingKey]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder={net.placeholder}
                />
                {value && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    주소 길이: {value.length}자
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {configured.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">현재 설정 확인 ({configured.length}/3)</h3>
          </div>
          <div className="space-y-2 p-5 text-sm">
            {configured.map((n) => (
              <div key={n.id} className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{n.label}</span>
                <span className="break-all font-mono text-xs text-gray-900 dark:text-white">{values[n.settingKey]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SaveBar onSave={onSave} isPending={isPending} saved={saved} error={error} />
    </div>
  );
}

// --- Terms / Privacy Text Settings ---
function TextSettingsTab({
  title,
  description,
  settingKey,
  values,
  setValues,
  onSave,
  isPending,
  saved,
  error,
}: {
  title: string;
  description: string;
  settingKey: string;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
  error: string;
}) {
  const [preview, setPreview] = useState(false);
  const content = values[settingKey] || '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setPreview(false)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${!preview ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            편집
          </button>
          <button
            onClick={() => setPreview(true)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${preview ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            <Eye className="h-3.5 w-3.5" />
            미리보기
          </button>
        </div>
        <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
          {content.length}자
          {content ? ' (등록됨)' : ' (미등록)'}
        </span>
      </div>

      {preview ? (
        <div className="min-h-[400px] rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-600 dark:prose-invert dark:text-gray-300 prose-headings:font-bold prose-a:text-pink-500 prose-a:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content || '<p>(내용이 없습니다)</p>') }}
          />
        </div>
      ) : (
        <Suspense fallback={<div className="h-[400px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />}>
          <RichTextEditor
            value={content}
            onChange={(html) => setValues((prev) => ({ ...prev, [settingKey]: html }))}
            placeholder={`${title} 내용을 입력하세요...`}
          />
        </Suspense>
      )}

      <SaveBar onSave={onSave} isPending={isPending} saved={saved} error={error} />
    </div>
  );
}

// --- UDG Status Tab ---
function UdgStatusTab() {
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: () => adminApi.getHealthCheck().then((r) => r.data as unknown as HealthStatus),
    refetchInterval: 30_000,
  });

  const { data: udgStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin', 'udg', 'stats'],
    queryFn: () => adminApi.getUdgStats().then((r) => r.data.data),
  });

  const isLoading = healthLoading || statsLoading;

  const statusColor = (status: string) => {
    switch (status) {
      case 'ok':
      case 'connected':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'reachable':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'not_configured':
        return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ok': return '정상';
      case 'connected': return '연결됨';
      case 'reachable': return '응답 있음';
      case 'not_configured': return '미설정';
      case 'unreachable': return '연결 불가';
      case 'disconnected': return '연결 끊김';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          UDG 플랫폼 연동 상태 및 웹훅 이벤트 통계를 확인합니다.
        </p>
        <button
          onClick={() => { refetchHealth(); refetchStats(); }}
          className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          새로고침
        </button>
      </div>

      {/* System Health */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">시스템 연결 상태</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          {[
            { label: 'Database', value: healthData?.db ?? 'unknown' },
            { label: 'Redis', value: healthData?.redis ?? 'unknown' },
            { label: 'UDG Webhook', value: healthData?.udg_webhook ?? 'unknown' },
            { label: '전체 상태', value: healthData?.status ?? 'unknown' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="mb-1.5 text-[12px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
              <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-bold ${statusColor(value)}`}>
                {statusLabel(value)}
              </span>
            </div>
          ))}
        </div>
        {healthData && (
          <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              응답 지연: {healthData.latency_ms}ms | 버전: {healthData.version}
            </p>
          </div>
        )}
      </div>

      {/* UDG Webhook Stats */}
      {udgStats && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">UDG 웹훅 이벤트 통계</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{udgStats.total}</p>
              <p className="mt-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">전체 이벤트</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{udgStats.sent}</p>
              <p className="mt-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">전송 완료</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{udgStats.failed}</p>
              <p className="mt-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">실패</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">{udgStats.dlq}</p>
              <p className="mt-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">DLQ</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{udgStats.success_rate}</p>
              <p className="mt-1 text-[12px] font-bold text-gray-500 dark:text-gray-400">성공률</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Save Bar ---
function SaveBar({
  onSave,
  isPending,
  saved,
  error,
}: {
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
  error: string;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-gray-200 pt-4 dark:border-gray-800">
      <button
        onClick={onSave}
        disabled={isPending}
        className="flex items-center gap-2 rounded-full bg-gray-900 px-6 py-2.5 font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        <Save className="h-4 w-4" />
        {isPending ? '저장 중...' : '저장'}
      </button>
      {saved && (
        <span className="flex items-center gap-1 text-sm font-bold text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          저장되었습니다.
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1 text-sm font-bold text-red-500">
          <AlertCircle className="h-4 w-4" />
          {error}
        </span>
      )}
    </div>
  );
}

export default AdminSettingsPage;
