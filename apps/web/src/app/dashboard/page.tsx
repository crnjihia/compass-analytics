'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  ShoppingCart,
  Clock,
  RefreshCw,
  Sparkles,
  Phone,
  Radio,
  Layers,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { trpc } from '../../utils/trpc';
import { useTenant } from '../../components/providers';
import { useLiveRevenue, LiveTransactionEvent } from '../../hooks/useLiveRevenue';
import { formatKes } from '@compass/shared';

export default function DashboardOverviewPage() {
  const { activeTenant } = useTenant();
  const [timeseriesInterval, setTimeseriesInterval] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [liveAlert, setLiveAlert] = useState<LiveTransactionEvent | null>(null);

  // Queries
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = trpc.revenue.summary.useQuery();
  const { data: timeseries, isLoading: isTimeseriesLoading, refetch: refetchTimeseries } =
    trpc.revenue.timeseries.useQuery({
      interval: timeseriesInterval,
    });
  const { data: recent, isLoading: isRecentLoading, refetch: refetchRecent } = trpc.revenue.recent.useQuery({
    limit: 10,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchTimeseries();
    refetchRecent();
  };

  // Real-Time SSE Stream with Polling Fallback
  const { status: streamStatus, lastTransaction, isPolling } = useLiveRevenue({
    orgId: activeTenant.id,
    onTransaction: (txn) => {
      setLiveAlert(txn);
      // Auto-hide alert after 8 seconds
      setTimeout(() => setLiveAlert(null), 8000);
    },
    onRefetchNeeded: () => {
      refetchSummary();
      refetchRecent();
    },
  });

  // Prepare chart data with numeric shillings for Recharts
  const chartData = (timeseries || []).map((item) => ({
    bucket: item.bucket,
    amount: Number(item.totalCents) / 100,
    formatted: item.totalFormatted,
    txns: item.txnCount,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Real-time incoming transaction banner alert */}
      {liveAlert && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-slate-900 border border-emerald-500/40 shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  New M-Pesa Payment Received!
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  {liveAlert.mpesaReceipt}
                </span>
              </div>
              <p className="text-sm font-semibold text-white">
                {formatKes(liveAlert.amountCents)} from {liveAlert.customerName} ({liveAlert.maskedMsisdn})
              </p>
            </div>
          </div>
          <button
            onClick={() => setLiveAlert(null)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Revenue Analytics
            </h1>
            {streamStatus === 'connected' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                SSE STREAM LIVE
              </span>
            )}
            {streamStatus === 'reconnecting' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                RECONNECTING SSE...
              </span>
            )}
            {streamStatus === 'polling' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                POLLING FALLBACK (5s)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Real-time financial flow for <span className="text-slate-200 font-medium">{activeTenant.name}</span>{' '}
            via Daraja API.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-sm font-medium transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Today&apos;s Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              {isSummaryLoading ? '...' : summary?.today.formatted || 'KES 0.00'}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center font-semibold px-1.5 py-0.5 rounded-md ${
                  (summary?.today.deltaPercentage || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {(summary?.today.deltaPercentage || 0) >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {summary?.today.deltaPercentage || 0}%
              </span>
              <span className="text-slate-400">vs yesterday ({summary?.yesterday.formatted})</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Today&apos;s Transactions:</span>
            <span className="text-slate-200 font-semibold">{summary?.today.txnCount || 0}</span>
          </div>
        </div>

        {/* This Month's Revenue */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>This Month&apos;s Revenue</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              {isSummaryLoading ? '...' : summary?.thisMonth.formatted || 'KES 0.00'}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center font-semibold px-1.5 py-0.5 rounded-md ${
                  (summary?.thisMonth.deltaPercentage || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {(summary?.thisMonth.deltaPercentage || 0) >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {summary?.thisMonth.deltaPercentage || 0}%
              </span>
              <span className="text-slate-400">vs last month</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Month Volume:</span>
            <span className="text-slate-200 font-semibold">{summary?.thisMonth.txnCount || 0} txns</span>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Average Order Value</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              {isSummaryLoading ? '...' : summary?.aov.formatted || 'KES 0.00'}
            </div>
            <p className="text-xs text-slate-400">Per successful customer payment</p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Calculation:</span>
            <span className="text-slate-200 font-semibold">Total / Month Txns</span>
          </div>
        </div>

        {/* Real-time Processing Stats */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Live Stream Engine</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl lg:text-3xl font-bold text-emerald-400 tracking-tight font-mono">
              {isPolling ? 'POLL' : 'SSE'}
            </div>
            <p className="text-xs text-slate-400">
              {isPolling ? 'Fallback HTTP mode active' : 'Direct Redis stream push'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Channel:</span>
            <span className="text-emerald-400 font-mono font-semibold">org:{activeTenant.id}:txn</span>
          </div>
        </div>
      </div>

      {/* Main Revenue Timeseries Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Revenue Trend Over Time</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </h2>
            <p className="text-xs text-slate-400">
              Monetary values aggregated in Kenyan Shillings (KES)
            </p>
          </div>

          {/* Interval Tabs */}
          <div className="inline-flex p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium self-start sm:self-auto">
            {(['hour', 'day', 'week', 'month'] as const).map((interval) => (
              <button
                key={interval}
                onClick={() => setTimeseriesInterval(interval)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  timeseriesInterval === interval
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {interval}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-80 w-full">
          {isTimeseriesLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Loading financial timeseries...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <Layers className="w-8 h-8 stroke-1" />
              <p>No revenue data recorded for this interval.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mpesaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00a859" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00a859" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `KES ${val.toLocaleString()}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-xl space-y-1">
                          <p className="text-xs text-slate-400">{data.bucket}</p>
                          <p className="text-base font-bold text-emerald-400">{data.formatted}</p>
                          <p className="text-xs text-slate-300">
                            Transactions: <span className="font-semibold text-white">{data.txns}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#00a859"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#mpesaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent M-Pesa Transactions Feed */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <span>Live Transactions Stream</span>
            </h2>
            <p className="text-xs text-slate-400">
              Verified M-Pesa C2B payments synchronized for this organization
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Showing latest <span className="text-slate-200 font-semibold">{recent?.items.length || 0}</span> payments
          </span>
        </div>

        {isRecentLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Loading recent transactions...
          </div>
        ) : recent?.items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No transactions found for this tenant organization.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {recent?.items.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400">
                      {txn.mpesaReceipt}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">{txn.customerName}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{txn.maskedMsisdn}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {txn.billRef || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(txn.paidAt).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                      {txn.amountFormatted}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        SUCCESS
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
