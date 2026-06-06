import { useState } from 'react';

interface OnboardingModalProps {
  onClose: () => void;
}

const steps = [
  {
    title: 'USDT 지갑 준비',
    desc: 'TRC20 또는 ERC20 네트워크를 지원하는 지갑을 준비하세요. (Trust Wallet, MetaMask 등)',
  },
  {
    title: '결제 주소 복사',
    desc: '결제 페이지에 표시된 회사 지갑 주소를 복사하세요.',
  },
  {
    title: 'USDT 전송',
    desc: '준비한 지갑에서 복사한 주소로 정확한 금액의 USDT를 전송하세요.',
  },
  {
    title: 'TXID 입력',
    desc: '전송 완료 후 발급된 TXID(거래 해시)를 결제 페이지에 입력하세요.',
  },
];

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  const handleDontShow = () => {
    localStorage.setItem('usdt_onboarding_done', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">USDT 결제 가이드</h2>

        <div className="mb-6">
          <div className="mb-3 flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded ${i <= step ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
            <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">
              Step {step + 1}. {steps[step].title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{steps[step].desc}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleDontShow}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            다시 보지 않기
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
              >
                이전
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="rounded-full bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
              >
                다음
              </button>
            ) : (
              <button
                onClick={onClose}
                className="rounded-full bg-gray-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
              >
                시작하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
