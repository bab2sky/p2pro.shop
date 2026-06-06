import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface HomeSectionProps {
  title: string;
  subtitle?: string;
  linkTo?: string;
  linkText?: string;
  children: React.ReactNode;
}

export function HomeSection({ title, subtitle, linkTo, linkText, children }: HomeSectionProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center sm:items-end justify-between px-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl dark:text-gray-50">
            {title}
          </h2>
          {subtitle && <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="group flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-2 text-[13px] font-bold text-gray-700 shadow-sm transition-all hover:border-gray-900 hover:bg-gray-900 hover:text-white active:scale-95 sm:mb-1 sm:px-4 sm:py-1.5 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-white dark:hover:bg-white dark:hover:text-gray-900"
          >
            <span className="hidden sm:inline">{linkText || '더보기'}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
