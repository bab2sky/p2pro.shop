import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';
import { extractApiError } from '@/lib/api-error';
import { Save, CheckCircle2, AlertCircle, Zap, Bot } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = `당신은 P2PRO 오픈마켓의 AI 고객센터 상담원입니다.

P2PRO는 USDT 에스크로 기반 P2P 마켓플레이스입니다. 주요 규칙:
- 결제는 USDT로만 가능하며, 에스크로 방식으로 안전하게 처리됩니다.
- 판매자 마진: 5~40% (판매자 설정)
- 출금 수수료: 5%, 최소 출금 금액: 10 USDT
- 구매 확정: 배송 완료 후 7일 자동 확정
- TXID 입력 제한: 24시간 이내
- 출금 시 2FA(2단계 인증) 필수
- UDG 분배 후에는 환불 불가

대화 규칙:
- 한국어로 친절하고 간결하게 답변하세요.
- 정확하지 않은 정보는 "확인 후 안내드리겠습니다"라고 답변하세요.
- 개인정보(비밀번호, 지갑 주소 등)를 절대 요청하지 마세요.
- 기술적 문제는 고객센터 이메일이나 1:1 문의를 안내하세요.`;

const OLLAMA_MODELS = [
  { value: 'llama3', label: 'Llama 3 (8B)', desc: 'Meta — 범용, 빠른 응답' },
  { value: 'llama3.1', label: 'Llama 3.1 (8B)', desc: 'Meta — 향상된 추론' },
  { value: 'llama3.2', label: 'Llama 3.2 (3B)', desc: 'Meta — 경량, 빠른 속도' },
  { value: 'llama3.3', label: 'Llama 3.3 (70B)', desc: 'Meta — 고품질 대형 모델' },
  { value: 'gemma2', label: 'Gemma 2 (9B)', desc: 'Google — 균형 잡힌 성능' },
  { value: 'gemma3', label: 'Gemma 3 (12B)', desc: 'Google — 최신, 다국어 강화' },
  { value: 'mistral', label: 'Mistral (7B)', desc: 'Mistral AI — 빠르고 효율적' },
  { value: 'mistral-small', label: 'Mistral Small (24B)', desc: 'Mistral AI — 강화된 추론' },
  { value: 'qwen2.5', label: 'Qwen 2.5 (7B)', desc: 'Alibaba — 다국어, 코딩 강점' },
  { value: 'qwen3', label: 'Qwen 3 (8B)', desc: 'Alibaba — 최신, 하이브리드 추론' },
  { value: 'phi4', label: 'Phi-4 (14B)', desc: 'Microsoft — 소형 고성능' },
  { value: 'deepseek-r1', label: 'DeepSeek R1 (7B)', desc: 'DeepSeek — 추론 특화' },
  { value: 'command-r', label: 'Command R (35B)', desc: 'Cohere — RAG/검색 최적화' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: '최신 — 빠른 사고 모델, 가성비 최고' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: '최신 — 최고 성능, 복잡한 추론' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: '빠른 응답, 멀티모달 지원' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', desc: '경량 — 비용 효율적' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: '안정적 — 100만 토큰 컨텍스트' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: '안정적 — 200만 토큰 컨텍스트' },
];

const CHATBOT_KEYS = [
  'chatbot_provider',
  'chatbot_api_key',
  'chatbot_model',
  'chatbot_system_prompt',
  'chatbot_ollama_url',
];

function ModelSelector({
  provider,
  value,
  onChange,
}: {
  provider: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const models = provider === 'ollama' ? OLLAMA_MODELS : GEMINI_MODELS;
  const inList = models.some((m) => m.value === value);
  const [customMode, setCustomMode] = useState(!inList && value !== '');

  // Provider 변경 시 커스텀 모드 리셋
  useEffect(() => {
    const nowInList = (provider === 'ollama' ? OLLAMA_MODELS : GEMINI_MODELS).some((m) => m.value === value);
    if (nowInList) setCustomMode(false);
  }, [provider, value]);

  const selectValue = customMode ? '__custom__' : value;

  return (
    <div>
      <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
        모델 선택
      </label>
      <select
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === '__custom__') {
            setCustomMode(true);
            onChange('');
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      >
        <option value="">-- 모델을 선택하세요 --</option>
        {models.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label} — {m.desc}
          </option>
        ))}
        <option value="__custom__">직접 입력...</option>
      </select>
      {customMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={provider === 'ollama' ? 'e.g. solar, yi, vicuna...' : 'e.g. gemini-2.0-flash-exp'}
          autoFocus
          className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
      )}
    </div>
  );
}

export function AdminChatbotPage() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data.data),
  });

  useEffect(() => {
    if (settingsData) setValues(settingsData);
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

  const handleSave = () => {
    const data: Record<string, string> = {};
    CHATBOT_KEYS.forEach((k) => {
      if (values[k] !== undefined && values[k] !== '') data[k] = values[k];
    });
    if (Object.keys(data).length > 0) mutation.mutate(data);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await adminApi.testChatbot();
      const data = resp.data.data;
      setTestResult({
        success: data.success,
        message: data.success ? data.reply : data.error,
      });
    } catch (e: unknown) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const provider = values.chatbot_provider || 'ollama';

  if (isLoading) return (
    <div className="max-w-4xl space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-500/10">
          <Bot className="h-5 w-5 text-pink-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI 챗봇 설정</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">고객센터 AI 챗봇의 LLM 프로바이더와 설정을 관리합니다.</p>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">LLM 프로바이더</h3>
        </div>
        <div className="flex gap-3 p-5">
          {(['ollama', 'gemini'] as const).map((p) => (
            <label
              key={p}
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 transition-colors ${
                provider === p
                  ? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="chatbot_provider"
                value={p}
                checked={provider === p}
                onChange={(e) => setValues((prev) => ({ ...prev, chatbot_provider: e.target.value }))}
                className="text-gray-900 dark:text-white"
              />
              <div>
                <span className="font-bold text-gray-900 dark:text-white">
                  {p === 'ollama' ? 'Ollama (로컬)' : 'Google Gemini (클라우드)'}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {p === 'ollama' ? '로컬 서버에서 실행되는 오픈소스 LLM' : 'Google AI Studio API'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Provider-specific settings */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">연결 설정</h3>
        </div>
        <div className="space-y-4 p-5">
          {provider === 'ollama' ? (
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                Ollama 서버 URL
              </label>
              <input
                type="text"
                value={values.chatbot_ollama_url || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, chatbot_ollama_url: e.target.value }))}
                placeholder="http://localhost:11434"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <p className="mt-1 text-xs text-gray-400">비워두면 기본값 http://localhost:11434 사용</p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gray-500 dark:text-gray-400">
                Gemini API Key
              </label>
              <input
                type="password"
                value={values.chatbot_api_key || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, chatbot_api_key: e.target.value }))}
                placeholder="AIza..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <p className="mt-1 text-xs text-gray-400">Google AI Studio에서 발급받은 API 키</p>
            </div>
          )}

          <ModelSelector
            provider={provider}
            value={values.chatbot_model || ''}
            onChange={(v) => setValues((prev) => ({ ...prev, chatbot_model: v }))}
          />
        </div>
      </div>

      {/* System Prompt */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">시스템 프롬프트</h3>
          <button
            onClick={() => setValues((prev) => ({ ...prev, chatbot_system_prompt: DEFAULT_SYSTEM_PROMPT }))}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            기본값 복원
          </button>
        </div>
        <div className="p-5">
          <textarea
            value={values.chatbot_system_prompt || ''}
            onChange={(e) => setValues((prev) => ({ ...prev, chatbot_system_prompt: e.target.value }))}
            placeholder="AI 챗봇의 역할과 규칙을 정의하는 시스템 프롬프트..."
            rows={10}
            className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed outline-none focus:border-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
          <p className="mt-1 text-xs text-gray-400">
            {(values.chatbot_system_prompt || '').length}자
            {!values.chatbot_system_prompt && ' (미설정 시 기본 프롬프트 사용)'}
          </p>
        </div>
      </div>

      {/* Connection Test */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">연결 테스트</h3>
        </div>
        <div className="p-5">
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            설정을 저장한 후 테스트 버튼을 눌러 LLM 연결 상태를 확인하세요.
          </p>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-600 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {testing ? '테스트 중...' : '연결 테스트'}
          </button>
          {testResult && (
            <div className={`mt-3 rounded-xl border p-4 text-sm ${
              testResult.success
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {testResult.success ? '연결 성공' : '연결 실패'}
              </div>
              <p className="mt-1 whitespace-pre-line text-xs">{testResult.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Save Bar */}
      <div className="flex items-center gap-4 border-t border-gray-200 pt-4 dark:border-gray-800">
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center gap-2 rounded-full bg-gray-900 px-6 py-2.5 font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <Save className="h-4 w-4" />
          {mutation.isPending ? '저장 중...' : '저장'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-bold text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            저장되었습니다.
          </span>
        )}
        {saveError && (
          <span className="flex items-center gap-1 text-sm font-bold text-red-500">
            <AlertCircle className="h-4 w-4" />
            {saveError}
          </span>
        )}
      </div>
    </div>
  );
}

export default AdminChatbotPage;
