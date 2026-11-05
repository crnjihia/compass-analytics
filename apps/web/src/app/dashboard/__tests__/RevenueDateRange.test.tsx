import { render } from '@testing-library/react';
import DashboardOverviewPage from '../dashboard/page';

jest.mock('../../../utils/trpc', () => ({
  trpc: {
    revenue: {
      summary: { useQuery: jest.fn(() => ({ data: null, isLoading: false, refetch: jest.fn() })) },
      timeseries: { useQuery: jest.fn(() => ({ data: null, isLoading: false, refetch: jest.fn() })) },
      recent: { useQuery: jest.fn(() => ({ data: null, isLoading: false, refetch: jest.fn() })) },
    },
    // mock other routers if required
  },
}));

test('renders date range filter inputs and apply button', () => {
  const { container, getByText } = render(<DashboardOverviewPage />);
  const dateInputs = container.querySelectorAll('input[type="date"]');
  expect(dateInputs.length).toBe(2);
  const applyBtn = getByText('Apply');
  expect(applyBtn).toBeInTheDocument();
});
