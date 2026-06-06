import { useState, useEffect } from 'react';
import { Copy, Check, Timer, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentGuideProps {
  walletAddress: string;
  totalAmount: string;
  deadline: string | null;
  paymentNetwork?: string | null;
}

const NETWORK_COLORS: Record<string, string> = {
  'TRC-20': 'bg-red-500',
  'ERC-20': 'bg-blue-500',
  'BEP-20': 'bg-yellow-500',
};

export function PaymentGuide({ walletAddress, totalAmount, deadline, paymentNetwork }: PaymentGuideProps) {
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('만료됨');
        clearInterval(timer);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const copy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white text-center dark:border-gray-600 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">USDT 에스크로 결제</h2>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-3xl font-bold text-pink-500">{totalAmount} USDT</p>

        {paymentNetwork && (
          <div className="flex items-center justify-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${NETWORK_COLORS[paymentNetwork] || 'bg-gray-400'}`} />
            <span className="text-[13px] font-bold text-gray-700 dark:text-gray-300">{paymentNetwork}</span>
          </div>
        )}

        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-2xl bg-white">
          <QRCodeSVG
            value={walletAddress}
            size={144}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <div>
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[12px] font-bold text-gray-400">
            <Wallet className="h-3 w-3" />
            회사 지갑 주소
          </p>
          <div className="flex items-center justify-center gap-2">
            <code className="break-all rounded-xl bg-gray-100 px-3 py-1.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{walletAddress}</code>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
        </div>

        {deadline && (
          <p className="flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-red-500">
            <Timer className="h-4 w-4" />
            {remaining}
          </p>
        )}

        <p className="text-[11px] text-gray-400">
          위 지갑 주소로 정확한 금액의 USDT를 전송해주세요
        </p>
      </div>
    </div>
  );
}
