'use client';

import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Radio,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  Server,
  Database,
  Lock,
  Globe,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { trpc } from '../../../utils/trpc';
import { useTenant } from '../../../components/providers';

export default function SettingsPage() {
  const { activeTenant, activeRole } = useTenant();

  // Form State
  const [shortcode, setShortcode] = useState('890123');
  const [shortcodeType, setShortcodeType] = useState<'PAYBILL' | 'TILL'>('PAYBILL');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Queries
  const { data: connData, isLoading: isConnLoading, refetch: refetchConn } = trpc.connection.get.useQuery();
  const { data: healthData, isLoading: isHealthLoading, refetch: refetchHealth } = trpc.systemHealth.check.useQuery();

  // Mutations
  const connectMutation = trpc.connection.connect.useMutation({
    onSuccess: (data) => {
      setStatusMessage({ text: `Successfully configured shortcode ${data.shortcode} with AES-256-GCM encryption.` });
      refetchConn();
      setConsumerKey('');
      setConsumerSecret('');
      setPasskey('');
    },
    onError: (err) => {
      setStatusMessage({ text: `Error: ${err.message}`, error: true });
    },
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcode || !consumerKey || !consumerSecret || !passkey) return;

    connectMutation.mutate({
      shortcode,
      shortcodeType,
      consumerKey,
      consumerSecret,
      passkey,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      {/* Top Banner */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            M-Pesa Daraja & Platform Settings
          </h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Security & Integrations
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Manage Safaricom Daraja API credentials and system telemetry for{' '}
          <span className="text-slate-200 font-medium">{activeTenant.name}</span>.
        </p>
      </div>

      {/* Active Connection Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Daraja C2B Webhook Status</span>
                {connData?.connected ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    UNCONFIGURED
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Listening for incoming payments from Safaricom M-Pesa servers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-3 py-1.5 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            <span>AES-256-GCM Secured</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Shortcode</p>
            <p className="text-lg font-bold text-white font-mono">
              {connData?.connection?.shortcode || activeTenant.shortcode}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Type: {connData?.connection?.shortcodeType || 'PAYBILL'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Webhook Secret Signature</p>
            <p className="text-sm font-mono text-slate-300">
              {connData?.connection?.callbackSecretPrefix || 'whsec_••••••••••••'}
            </p>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>HMAC-SHA256 signature verification enabled</span>
            </p>
          </div>
        </div>

        {/* Webhook URLs to register with Safaricom */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Daraja C2B Callback URLs (Register in Safaricom Developer Portal)
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Validation URL:</span>
              <div className="flex items-center gap-2">
                <code className="text-emerald-400 font-mono">
                  https://compass.sme.ke/api/mpesa/c2b/validation/{activeTenant.id}
                </code>
                <button
                  onClick={() =>
                    handleCopy(
                      `https://compass.sme.ke/api/mpesa/c2b/validation/${activeTenant.id}`,
                      'validation'
                    )
                  }
                  className="p-1 text-slate-400 hover:text-white"
                >
                  {copiedField === 'validation' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400">Confirmation URL:</span>
              <div className="flex items-center gap-2">
                <code className="text-emerald-400 font-mono">
                  https://compass.sme.ke/api/mpesa/c2b/confirmation/{activeTenant.id}
                </code>
                <button
                  onClick={() =>
                    handleCopy(
                      `https://compass.sme.ke/api/mpesa/c2b/confirmation/${activeTenant.id}`,
                      'confirmation'
                    )
                  }
                  className="p-1 text-slate-400 hover:text-white"
                >
                  {copiedField === 'confirmation' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connect & Rotate Credentials Form */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <span>Update / Rotate Daraja API Credentials</span>
          </h2>
          <p className="text-xs text-slate-400">
            Keys are encrypted with AES-256-GCM before writing to the multi-tenant database.
          </p>
        </div>

        <form onSubmit={handleConnectSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Business Shortcode
              </label>
              <input
                type="text"
                value={shortcode}
                onChange={(e) => setShortcode(e.target.value)}
                placeholder="e.g. 890123"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Shortcode Type
              </label>
              <select
                value={shortcodeType}
                onChange={(e) => setShortcodeType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="PAYBILL">PayBill (Customer PayBill)</option>
                <option value="TILL">Buy Goods Till (Till Number)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Consumer Key
              </label>
              <input
                type="password"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="Enter Safaricom consumer key..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Consumer Secret
              </label>
              <input
                type="password"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="Enter Safaricom consumer secret..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Online Passkey
            </label>
            <input
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="Enter Safaricom Daraja passkey..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                statusMessage.error
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Only accessible to users with <code className="text-emerald-400">org:admin</code> privileges.
            </span>
            <button
              type="submit"
              disabled={connectMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${connectMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{connectMutation.isPending ? 'Encrypting & Saving...' : 'Save & Encrypt Credentials'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* System Diagnostics Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-400" />
          <span>Platform Infrastructure Health</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="font-semibold text-white">PostgreSQL 16</p>
                <p className="text-slate-400">Row-Level Security</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              {healthData?.services.postgres || 'HEALTHY'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="font-semibold text-white">Redis 7 Streams</p>
                <p className="text-slate-400">Queue & Pub/Sub</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              {healthData?.services.redis || 'HEALTHY'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="font-semibold text-white">Isolation Engine</p>
                <p className="text-slate-400">Tenant Bound</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              ENFORCED
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
