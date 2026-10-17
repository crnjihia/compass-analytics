'use client';

import React from 'react';
import {
  Users,
  Repeat,
  UserCheck,
  UserPlus,
  ArrowUpRight,
  Sparkles,
  Phone,
  Calendar,
  Layers,
} from 'lucide-react';
import { trpc } from '../../../utils/trpc';
import { useTenant } from '../../../components/providers';

export default function CustomersPage() {
  const { activeTenant } = useTenant();

  const { data: repeatData, isLoading: isRepeatLoading } = trpc.customers.repeatRate.useQuery();
  const { data: topCustomers, isLoading: isTopLoading } = trpc.customers.topCustomers.useQuery({
    limit: 10,
  });
  const { data: cohorts, isLoading: isCohortsLoading } = trpc.customers.cohorts.useQuery();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Banner */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Customer Cohorts & Retention
          </h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            SME Loyalty
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Tracking buyer frequency, lifetime value (LTV), and cohort retention for{' '}
          <span className="text-slate-200 font-medium">{activeTenant.name}</span>.
        </p>
      </div>

      {/* Customer KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Customers */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Total Unique Buyers</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {isRepeatLoading ? '...' : repeatData?.totalCustomers || 0}
          </div>
          <p className="text-xs text-slate-400 mt-1">Identified via HMAC-hashed MSISDNs</p>
        </div>

        {/* Repeat Customer Rate */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Repeat Customer Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-400 tracking-tight">
            {isRepeatLoading ? '...' : `${repeatData?.repeatRatePercentage || 0}%`}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Buyers with 2 or more M-Pesa transactions
          </p>
        </div>

        {/* One-Time vs Repeat Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Customer Loyalty Ratio</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {repeatData?.repeatCustomers || 0}
            </span>
            <span className="text-xs text-slate-400">repeat /</span>
            <span className="text-2xl font-bold text-slate-400">
              {repeatData?.oneTimeCustomers || 0}
            </span>
            <span className="text-xs text-slate-400">one-time</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${repeatData?.repeatRatePercentage || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Cohort Retention Heatmap */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Monthly Cohort Retention Heatmap</span>
          </h2>
          <p className="text-xs text-slate-400">
            Percentage of customers who make return purchases in subsequent months after their first transaction
          </p>
        </div>

        {isCohortsLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading cohorts matrix...</div>
        ) : cohorts?.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No cohort history recorded yet. Cohorts generate automatically from monthly rollups.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Cohort Month</th>
                  <th className="py-3 px-4 text-center">New Buyers</th>
                  <th className="py-3 px-4 text-center">Month 0</th>
                  <th className="py-3 px-4 text-center">Month 1</th>
                  <th className="py-3 px-4 text-center">Month 2</th>
                  <th className="py-3 px-4 text-center">Month 3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {cohorts?.map((cohort) => {
                  const m0 = cohort.retention.find((r) => r.period === 0)?.rate ?? 100;
                  const m1 = cohort.retention.find((r) => r.period === 1)?.rate;
                  const m2 = cohort.retention.find((r) => r.period === 2)?.rate;
                  const m3 = cohort.retention.find((r) => r.period === 3)?.rate;

                  const getHeatmapColor = (rate?: number) => {
                    if (rate === undefined) return 'bg-slate-900/40 text-slate-600';
                    if (rate >= 80) return 'bg-emerald-500/30 text-emerald-300 font-bold';
                    if (rate >= 50) return 'bg-emerald-500/20 text-emerald-400 font-semibold';
                    if (rate >= 25) return 'bg-emerald-500/10 text-emerald-500 font-medium';
                    return 'bg-slate-800/40 text-slate-400';
                  };

                  return (
                    <tr key={cohort.cohortMonth} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-white">
                        {cohort.cohortMonth}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-200">
                        {cohort.initialCustomers}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs ${getHeatmapColor(m0)}`}>
                          {m0}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs ${getHeatmapColor(m1)}`}>
                          {m1 !== undefined ? `${m1}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs ${getHeatmapColor(m2)}`}>
                          {m2 !== undefined ? `${m2}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs ${getHeatmapColor(m3)}`}>
                          {m3 !== undefined ? `${m3}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Customers by LTV */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Top Customers by Lifetime Value (LTV)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Highest cumulative spending accounts for {activeTenant.name}
          </p>
        </div>

        {isTopLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading customer directory...</div>
        ) : topCustomers?.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No customer records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Transactions</th>
                  <th className="py-3 px-4 text-right">Lifetime Value</th>
                  <th className="py-3 px-4">First Seen</th>
                  <th className="py-3 px-4">Last Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {topCustomers?.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-400">#{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{c.customerName}</p>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {c.maskedMsisdn}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
                        {c.txnCount} orders
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400 font-mono text-base">
                      {c.ltvFormatted}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(c.firstSeenAt).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(c.lastSeenAt).toLocaleDateString('en-KE', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
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
