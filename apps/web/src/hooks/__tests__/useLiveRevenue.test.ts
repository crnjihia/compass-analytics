import { renderHook, act } from '@testing-library/react-hooks';
import { useLiveRevenue, LiveStreamStatus } from '../useLiveRevenue';

describe('useLiveRevenue hook', () => {
  const originalEventSource = (global as any).EventSource;

  afterEach(() => {
    // Restore original EventSource
    (global as any).EventSource = originalEventSource;
    jest.clearAllMocks();
  });

  test('switches to polling after consecutive SSE errors', () => {
    const mockClose = jest.fn();
    const mockAddEventListener = jest.fn();
    const mockRemoveEventListener = jest.fn();
    const mockAddEventListenerMap: Record<string, Function> = {};

    // Mock EventSource implementation
    (global as any).EventSource = jest.fn().mockImplementation(() => {
      return {
        close: mockClose,
        addEventListener: (type: string, handler: Function) => {
          mockAddEventListener(type, handler);
          mockAddEventListenerMap[type] = handler;
        },
        removeEventListener: mockRemoveEventListener,
        // Simulate error after onopen
        dispatchEvent: (type: string, event?: any) => {
          const handler = mockAddEventListenerMap[type];
          if (handler) handler(event);
        },
      };
    });

    const onRefetch = jest.fn();
    const { result } = renderHook(() =>
      useLiveRevenue({ orgId: 'org_test', onRefetchNeeded: onRefetch })
    );

    // Simulate onopen
    act(() => {
      const onopen = (global as any).EventSource.mock.results[0].value.addEventListener.mock.calls.find(c => c[0] === 'open')[1];
      onopen();
    });

    // Simulate three consecutive errors
    for (let i = 0; i < 3; i++) {
      act(() => {
        const onerror = (global as any).EventSource.mock.results[0].value.addEventListener.mock.calls.find(c => c[0] === 'error')[1];
        onerror();
      });
    }

    expect(result.current.isPolling).toBe(true);
    expect(result.current.status).toBe('polling');
    expect(onRefetch).toHaveBeenCalled();
  });

  test('receives transaction event and calls callbacks', () => {
    const mockClose = jest.fn();
    const mockAddEventListener = jest.fn();
    const handlers: Record<string, Function> = {};

    (global as any).EventSource = jest.fn().mockImplementation(() => {
      return {
        close: mockClose,
        addEventListener: (type: string, handler: Function) => {
          mockAddEventListener(type, handler);
          handlers[type] = handler;
        },
        removeEventListener: jest.fn(),
      };
    });

    const onTxn = jest.fn();
    const onRefetch = jest.fn();
    const { result } = renderHook(() =>
      useLiveRevenue({ orgId: 'org_test', onTransaction: onTxn, onRefetchNeeded: onRefetch })
    );

    // Simulate onopen & connected event
    act(() => {
      handlers['open']?.();
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
