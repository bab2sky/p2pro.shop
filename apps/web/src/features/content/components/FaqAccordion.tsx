import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFaqs, type Faq } from '@/lib/api/content';

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반',
  payment: '결제',
  shipping: '배송',
  returns: '반품/교환',
  account: '계정',
  seller: '판매',
};

export function FaqAccordion() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['faqs', selectedCategory],
    queryFn: () => getFaqs(selectedCategory || undefined),
  });

  const faqs: Faq[] = data?.data ?? [];

  // Group by category when no filter
  const grouped = faqs.reduce<Record<string, Faq[]>>((acc, faq) => {
    const cat = faq.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  if (isLoading) {
    return <div className="py-8 text-center text-gray-500" role="status" aria-label="로딩 중">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('')}
          className={`rounded-full border px-4 py-1.5 text-sm ${
            !selectedCategory ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'hover:bg-gray-100'
          }`}
        >
          전체
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              selectedCategory === key ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="py-8 text-center text-gray-400">등록된 FAQ가 없습니다.</div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          {!selectedCategory && (
            <h3 className="text-lg font-semibold text-gray-700">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
          )}
          <div className="divide-y rounded-lg border">
            {grouped[cat].map((faq) => (
              <div key={faq.id}>
                <button
                  onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="font-medium">Q. {faq.question}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${
                      openId === faq.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {openId === faq.id && (
                  <div className="border-t bg-gray-50 px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap">
                    A. {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
