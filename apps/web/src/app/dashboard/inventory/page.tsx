'use client';

import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Upload,
  ArrowUpDown,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { trpc } from '../../../utils/trpc';
import { useTenant } from '../../../components/providers';

export default function InventoryPage() {
  const { activeTenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Modal States
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; sku: string; stock: number } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Restocked from supplier');
  const [csvContent, setCsvContent] = useState<string>(
    'sku,name,price,stock,reorderLevel\n' +
    'MBL-SOLAR-10W,M-Kopa Portable Solar Lantern 10W,3200.00,25,5\n' +
    'IRN-SHT-28G,Mabati Iron Sheets 28 Gauge (3 Metres),1150.00,80,20\n' +
    'PNT-WSH-20L,Basco Super Gloss White 20L,8500.00,12,3'
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Queries
  const { data: inventory, isLoading: isInventoryLoading, refetch: refetchInventory } = trpc.inventory.list.useQuery({
    limit: 50,
    search: searchTerm || undefined,
    filter,
  });

  const { data: velocity, isLoading: isVelocityLoading, refetch: refetchVelocity } = trpc.inventory.velocity.useQuery({
    days: '30',
  });

  // Mutations
  const adjustStockMutation = trpc.inventory.adjustStock.useMutation({
    onSuccess: () => {
      setAdjustModalOpen(false);
      refetchInventory();
      refetchVelocity();
    },
  });

  const importCsvMutation = trpc.inventory.importCsv.useMutation({
    onSuccess: (data) => {
      setImportStatus(`Successfully processed ${data.processed} products (${data.created} created, ${data.updated} updated).`);
      refetchInventory();
      refetchVelocity();
      setTimeout(() => {
        setImportModalOpen(false);
        setImportStatus(null);
      }, 1500);
    },
    onError: (err) => {
      setImportStatus(`Error: ${err.message}`);
    },
  });

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || adjustDelta === 0) return;
    adjustStockMutation.mutate({
      productId: selectedProduct.id,
      delta: adjustDelta,
      reason: adjustReason,
    });
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent) return;
    importCsvMutation.mutate({ csvContent });
  };

  // Merge inventory and velocity for table
  const items = inventory?.items || [];
  const velocityMap = new Map((velocity || []).map((v) => [v.productId, v]));

  // Metrics
  const totalSkus = items.length;
  const lowStockCount = items.filter((i) => i.status === 'LOW_STOCK').length;
  const outOfStockCount = items.filter((i) => i.status === 'OUT_OF_STOCK').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Inventory & Velocity
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Run-Rate Engine
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Stockout prediction and sales velocity intelligence for{' '}
            <span className="text-slate-200 font-medium">{activeTenant.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-sm font-medium transition-all"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Total Catalog SKUs</span>
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">{totalSkus}</div>
          <p className="text-xs text-slate-400 mt-1">Managed products under this tenant</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Low Stock Warnings</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-400 tracking-tight">{lowStockCount}</div>
          <p className="text-xs text-slate-400 mt-1">Stock on hand is at or below reorder level</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Critical Stockouts</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-rose-400 tracking-tight">{outOfStockCount}</div>
          <p className="text-xs text-slate-400 mt-1">0 units remaining in stock</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by SKU or Product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-medium">
            {(['ALL', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filter === mode
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isInventoryLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading inventory catalog...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No products match the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-center">Stock on Hand</th>
                  <th className="py-3 px-4 text-center">Reorder Lvl</th>
                  <th className="py-3 px-4 text-center">30-Day Run Rate</th>
                  <th className="py-3 px-4 text-center">Projected Stockout</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((prod) => {
                  const vel = velocityMap.get(prod.id);
                  return (
                    <tr key={prod.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400 text-xs">
                        {prod.sku}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                        {prod.name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-200">
                        {prod.priceFormatted}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-white">
                        {prod.stockOnHand}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-400">
                        {prod.reorderLevel}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-300">
                        {vel ? `${vel.dailyRunRate} / day` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {vel?.daysUntilStockout !== null && vel?.daysUntilStockout !== undefined ? (
                          <span
                            className={`font-semibold font-mono text-xs ${
                              vel.daysUntilStockout <= 7
                                ? 'text-rose-400 font-bold'
                                : vel.daysUntilStockout <= 14
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {vel.daysUntilStockout} days
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">No sales data</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {prod.status === 'IN_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            IN STOCK
                          </span>
                        )}
                        {prod.status === 'LOW_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            LOW STOCK
                          </span>
                        )}
                        {prod.status === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            OUT OF STOCK
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedProduct({
                              id: prod.id,
                              name: prod.name,
                              sku: prod.sku,
                              stock: prod.stockOnHand,
                            });
                            setAdjustDelta(0);
                            setAdjustModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-bold text-white">Adjust Stock Level</h3>
              <p className="text-xs text-slate-400 mt-1">
                {selectedProduct.name} ({selectedProduct.sku})
              </p>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                Current Stock: {selectedProduct.stock} units
              </p>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Stock Change (Delta)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    placeholder="e.g. +10 or -5"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="text-xs text-slate-400">
                    New total: <strong className="text-white">{selectedProduct.stock + adjustDelta}</strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Audit Reason (Required)
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Supplier delivery, damaged goods, inventory count"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {adjustStockMutation.isError && (
                <p className="text-xs text-rose-400 font-medium">
                  {adjustStockMutation.error.message}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending || adjustDelta === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-600/30"
                >
                  {adjustStockMutation.isPending ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span>Batch Import Products (CSV)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload or paste catalog rows in format: <code className="text-emerald-400 font-mono">sku,name,price,stock,reorderLevel</code>
              </p>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  CSV Content
                </label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {importStatus && (
                <div className={`p-3 rounded-xl text-xs font-medium ${
                  importStatus.startsWith('Error')
                    ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                }`}>
                  {importStatus}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportStatus(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importCsvMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-600/30"
                >
                  {importCsvMutation.isPending ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
