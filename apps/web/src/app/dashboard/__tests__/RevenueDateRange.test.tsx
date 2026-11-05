// @vitest-environment jsdom
import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import DashboardOverviewPage from '../page';

vi.mock('../../../utils/trpc', () => ({
  trpc: {
    revenue: {
      summary: { useQuery: vi.fn(() => ({ data: null, isLoading: false, refetch: vi.fn() })) },
      timeseries: { useQuery: vi.fn(() => ({ data: null, isLoading: false, refetch: vi.fn() })) },
      recent: { useQuery: vi.fn(() => ({ data: null, isLoading: false, refetch: vi.fn() })) },
    },
  },
}));

vi.mock('../../../components/providers', () => ({
  useTenant: () => ({
    activeTenant: { id: 'org_baraka_hardware', name: 'Baraka Hardware Ltd', shortcode: '890123' },
  }),
}));

vi.mock('../../../hooks/useLiveRevenue', () => ({
  useLiveRevenue: () => ({
    status: 'connected',
    lastTransaction: null,
    isPolling: false,
  }),
}));

test('renders date range filter inputs and apply button', () => {
  const { container, getByText } = render(<DashboardOverviewPage />);
  const dateInputs = container.querySelectorAll('input[type="date"]');
  expect(dateInputs.length).toBe(2);
  const applyBtn = getByText('Apply');
  expect(applyBtn).toBeInTheDocument();
});
