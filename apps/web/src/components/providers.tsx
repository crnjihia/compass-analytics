'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '../utils/trpc';

export interface TenantInfo {
  id: string;
  name: string;
  shortcode: string;
  type: string;
}

export const DEMO_TENANTS: TenantInfo[] = [
  {
    id: 'org_baraka_hardware',
    name: 'Baraka Hardware Ltd',
    shortcode: '890123 (PayBill)',
    type: 'Hardware & Construction Supplies',
  },
  {
    id: 'org_nairobi_fresh',
    name: 'Nairobi Fresh Grocers',
    shortcode: '987654 (Till)',
    type: 'Fresh Produce & Groceries',
  },
];

interface TenantContextType {
  activeTenant: TenantInfo;
  setActiveTenant: (tenant: TenantInfo) => void;
  activeRole: 'org:admin' | 'org:member';
  setActiveRole: (role: 'org:admin' | 'org:member') => void;
}

const TenantContext = createContext<TenantContextType>({
  activeTenant: DEMO_TENANTS[0],
  setActiveTenant: () => {},
  activeRole: 'org:admin',
  setActiveRole: () => {},
});

export const useTenant = () => useContext(TenantContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [activeTenant, setActiveTenant] = useState<TenantInfo>(DEMO_TENANTS[0]);
  const [activeRole, setActiveRole] = useState<'org:admin' | 'org:member'>('org:admin');

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const trpcClient = useMemo(() => {
    return trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            return {
              'x-mock-user-id': `user_${activeTenant.id}`,
              'x-mock-org-id': activeTenant.id,
              'x-mock-role': activeRole,
            };
          },
        }),
      ],
    });
  }, [activeTenant.id, activeRole]);

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        setActiveTenant,
        activeRole,
        setActiveRole,
      }}
    >
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </TenantContext.Provider>
  );
}
