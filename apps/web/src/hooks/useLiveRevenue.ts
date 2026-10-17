'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface LiveTransactionEvent {
  id: string;
  orgId: string;
  mpesaReceipt: string;
  customerName: string;
  maskedMsisdn: string;
  amountCents: number | string | bigint;
  paidAt: string;
  billRef?: string;
}

export type LiveStreamStatus = 'connected' | 'reconnecting' | 'polling' | 'disconnected';

interface UseLiveRevenueOptions {
  orgId: string;
  onTransaction?: (txn: LiveTransactionEvent) => void;
  onRefetchNeeded?: () => void;
  maxConsecutiveErrorsBeforeFallback?: number;
  pollIntervalMs?: number;
}

export function useLiveRevenue({
  orgId,
  onTransaction,
  onRefetchNeeded,
  maxConsecutiveErrorsBeforeFallback = 3,
  pollIntervalMs = 5000,
}: UseLiveRevenueOptions) {
  const [status, setStatus] = useState<LiveStreamStatus>('disconnected');
  const [lastTransaction, setLastTransaction] = useState<LiveTransactionEvent | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const consecutiveErrorsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sseRetryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const cleanupPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (sseRetryTimerRef.current) {
      clearTimeout(sseRetryTimerRef.current);
      sseRetryTimerRef.current = null;
    }
  }, []);

  const initSSERef = useRef<() => void>();

  // Polling Fallback Mechanism
  const startPollingFallback = useCallback(() => {
    cleanupSSE();
    setIsPolling(true);
    setStatus('polling');
    console.warn('[useLiveRevenue] SSE encountered 3 consecutive errors. Falling back to HTTP polling.');

    if (onRefetchNeeded) {
      onRefetchNeeded();
    }

    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        if (onRefetchNeeded) {
          onRefetchNeeded();
        }
      }, pollIntervalMs);
    }

    // Attempt to probe and resume SSE after 30 seconds
    if (!sseRetryTimerRef.current) {
      sseRetryTimerRef.current = setTimeout(() => {
        console.log('[useLiveRevenue] Attempting to reconnect SSE after polling period...');
        cleanupPolling();
        setIsPolling(false);
        consecutiveErrorsRef.current = 0;
        initSSERef.current?.();
      }, 30000);
    }
  }, [cleanupPolling, cleanupSSE, onRefetchNeeded, pollIntervalMs]);

  const initSSE = useCallback(() => {
    initSSERef.current = initSSE;
    if (!orgId) return;
    cleanupSSE();

    try {
      const url = `/api/stream/revenue?orgId=${encodeURIComponent(orgId)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        consecutiveErrorsRef.current = 0;
        setIsPolling(false);
        setStatus('connected');
        cleanupPolling();
      };

      es.addEventListener('connected', () => {
        setStatus('connected');
      });

      es.addEventListener('transaction', (event: MessageEvent) => {
        try {
          const data: LiveTransactionEvent = JSON.parse(event.data);
          setLastTransaction(data);
          if (onTransaction) {
            onTransaction(data);
          }
          if (onRefetchNeeded) {
            onRefetchNeeded();
          }
        } catch (err) {
          console.error('[useLiveRevenue] Failed to parse transaction event:', err);
        }
      });

      es.onerror = () => {
        consecutiveErrorsRef.current += 1;
        console.warn(`[useLiveRevenue] SSE connection error (count: ${consecutiveErrorsRef.current})`);

        if (consecutiveErrorsRef.current >= maxConsecutiveErrorsBeforeFallback) {
          startPollingFallback();
        } else {
          setStatus('reconnecting');
        }
      };
    } catch (err) {
      console.error('[useLiveRevenue] Failed to initialize EventSource:', err);
      startPollingFallback();
    }
  }, [cleanupPolling, cleanupSSE, maxConsecutiveErrorsBeforeFallback, onRefetchNeeded, onTransaction, orgId, startPollingFallback]);

  useEffect(() => {
    consecutiveErrorsRef.current = 0;
    setIsPolling(false);
    initSSE();

    return () => {
      cleanupSSE();
      cleanupPolling();
    };
  }, [orgId, initSSE, cleanupSSE, cleanupPolling]);

  return {
    status,
    lastTransaction,
    isPolling,
    reconnect: () => {
      cleanupPolling();
      cleanupSSE();
      consecutiveErrorsRef.current = 0;
      setIsPolling(false);
      initSSE();
    },
  };
}
