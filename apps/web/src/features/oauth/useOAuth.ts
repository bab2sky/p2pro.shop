import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';

interface SocialLogin {
  provider: string;
  provider_email: string | null;
  provider_name: string | null;
  linked_at: string;
  last_login_at: string | null;
}

export function useSocialLogins() {
  return useQuery<SocialLogin[]>({
    queryKey: ['social-logins'],
    queryFn: async () => {
      const res = await api.get('/profile/social-logins');
      return res.data.data;
    },
  });
}

export function useUnlinkSocial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: string) => {
      const res = await api.delete(`/auth/oauth/unlink/${provider}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-logins'] });
    },
  });
}
