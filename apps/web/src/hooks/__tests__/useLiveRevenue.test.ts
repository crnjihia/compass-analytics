// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useLiveRevenue, LiveStreamStatus } from '../useLiveRevenue';

describe('useLiveRevenue hook', () => {
  const originalEventSource = (global as any).EventSource;

  afterEach(() => {
    // Restore original EventSource
    (global as any).EventSource = originalEventSource;
    vi.clearAllMocks();
  });

  test('switches to polling after consecutive SSE errors', () => {
    const mockClose = vi.fn();
    const mockAddEventListener = vi.fn();
    const mockRemoveEventListener = vi.fn();
    const handlers: Record<string, Function> = {};

    // Mock EventSource implementation
    (global as any).EventSource = vi.fn().mockImplementation(() => {
      const instance = {
        close: mockClose,
        onopen: null as any,
        onerror: null as any,
        addEventListener: (type: string, handler: Function) => {
          mockAddEventListener(type, handler);
          handlers[type] = handler;
        },
        removeEventListener: mockRemoveEventListener,
      };
      return instance;
    });

    const onRefetch = vi.fn();
    const { result } = renderHook(() =>
      useLiveRevenue({ orgId: 'org_test', onRefetchNeeded: onRefetch })
    );

    // Simulate onopen
    act(() => {
      const es = (global as any).EventSource.mock.results[0].value;
      if (es.onopen) es.onopen();
    });

    // Simulate three consecutive errors
    for (let i = 0; i < 3; i++) {
      act(() => {
        const es = (global as any).EventSource.mock.results[0].value;
        if (es.onerror) es.onerror();
      });
    }

    expect(result.current.isPolling).toBe(true);
    expect(result.current.status).toBe('polling');
    expect(onRefetch).toHaveBeenCalled();
  });

  test('receives transaction event and calls callbacks', () => {
    const mockClose = vi.fn();
    const mockAddEventListener = vi.fn();
    const handlers: Record<string, Function> = {};

    (global as any).EventSource = vi.fn().mockImplementation(() => {
      return {
        close: mockClose,
        onopen: null as any,
        onerror: null as any,
        addEventListener: (type: string, handler: Function) => {
          mockAddEventListener(type, handler);
          handlers[type] = handler;
        },
        removeEventListener: vi.fn(),
      };
    });

    const onTxn = vi.fn();
    const onRefetch = vi.fn();
    const { result } = renderHook(() =>
      useLiveRevenue({ orgId: 'org_test', onTransaction: onTxn, onRefetchNeeded: onRefetch })
    );

    // Simulate onopen & connected event
    act(() => {
      const es = (global as any).EventSource.mock.results[0].value;
      if (es.onopen) es.onopen();
      handlers['connected']?.({ data: '{}' });
    });

    const txnPayload = { id: 'tx1', orgId: 'org_test', mpesaReceipt: 'ABC123', amountCents: 1000, paidAt: new Date().toISOString() };
    act(() => {
      handlers['transaction']?.({ data: JSON.stringify(txnPayload) });
    });

    expect(onTxn).toHaveBeenCalledWith(txnPayload);
    expect(onRefetch).toHaveBeenCalled();
    expect(result.current.lastTransaction).toEqual(txnPayload);
  });
});
