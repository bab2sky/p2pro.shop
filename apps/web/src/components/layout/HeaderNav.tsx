import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function HeaderNav() {
  const { t } = useTranslation();

  return (
    <nav className="hidden items-center gap-6 md:flex">
      <Link to="/products" className="text-gray-600 hover:text-gray-900">
        {t('nav.products')}
      </Link>
      <Link to="/categories" className="text-gray-600 hover:text-gray-900">
        {t('nav.categories')}
      </Link>
    </nav>
  );
}
