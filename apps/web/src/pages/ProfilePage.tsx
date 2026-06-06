import { useState } from 'react';
import { User, Shield, Wallet, Bell, UserX } from 'lucide-react';
import { ProfileForm } from '@/features/profile';
import { TotpSetup } from '@/features/profile';
import { WalletManager } from '@/features/profile';
import { NotificationSettings } from '@/features/profile';
import { AccountDeactivate } from '@/features/profile';

type TabKey = 'profile' | 'security' | 'wallet' | 'notification' | 'account';

const tabs: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'profile', label: '프로필', icon: User },
  { key: 'security', label: '보안 (2FA)', icon: Shield },
  { key: 'wallet', label: '지갑', icon: Wallet },
  { key: 'notification', label: '알림', icon: Bell },
  { key: 'account', label: '계정', icon: UserX },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  return (
    <div>
      <h1 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">프로필 설정</h1>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 overflow-x-auto scrollbar-hide rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl bg-gray-50 p-5 sm:p-6 dark:bg-gray-900">
        {activeTab === 'profile' && <ProfileForm />}
        {activeTab === 'security' && <TotpSetup />}
        {activeTab === 'wallet' && <WalletManager />}
        {activeTab === 'notification' && <NotificationSettings />}
        {activeTab === 'account' && <AccountDeactivate />}
      </div>
    </div>
  );
}
