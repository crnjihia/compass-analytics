'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  ChevronDown,
  Building2,
  ShieldCheck,
  Radio,
  Menu,
  X,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react';
import { useTenant, DEMO_TENANTS } from '../../components/providers';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Revenue Overview', icon: LayoutDashboard },
  { href: '/dashboard/customers', label: 'Customers & Cohorts', icon: Users },
  { href: '/dashboard/inventory', label: 'Inventory Velocity', icon: Package },
  { href: '/dashboard/settings', label: 'M-Pesa & Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeTenant, setActiveTenant, activeRole, setActiveRole } = useTenant();
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800/80 p-5 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40">
              <CreditCard className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white">Compass</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  Analytics
                </span>
              </div>
              <p className="text-xs text-slate-400">Kenyan SME Intelligence</p>
            </div>
          </div>

          {/* Tenant Switcher Card */}
          <div className="relative">
            <button
              onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
              className="w-full text-left p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Tenant</p>
                  <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {activeTenant.name}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {/* Dropdown Menu */}
            {tenantDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 space-y-1">
                <p className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Switch SME Organization
                </p>
                {DEMO_TENANTS.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => {
                      setActiveTenant(tenant);
                      setTenantDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                      activeTenant.id === tenant.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-xs text-slate-400">{tenant.shortcode}</p>
                    </div>
                    {activeTenant.id === tenant.id && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                  </button>
                ))}

                <div className="pt-2 border-t border-slate-800 mt-2 px-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Role Override:</span>
                    <button
                      onClick={() =>
                        setActiveRole(activeRole === 'org:admin' ? 'org:member' : 'org:admin')
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono"
                    >
                      {activeRole}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Card: Daraja Stream Status */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              M-Pesa Daraja
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              CONNECTED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Shortcode: <span className="font-mono text-slate-200">{activeTenant.shortcode}</span>
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium pt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>RLS Isolation Enforced</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <span>Organizations</span>
              <span>/</span>
              <span className="text-slate-100 font-medium">{activeTenant.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-slate-400">Live Queue:</span>
              <span className="text-emerald-400 font-mono font-semibold">mpesa:txns</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeRole}</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-400 uppercase font-semibold">Active Tenant</p>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_TENANTS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTenant(t);
                      setMobileMenuOpen(false);
                    }}
                    className={`p-2 rounded-lg text-left text-sm ${
                      activeTenant.id === t.id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    pathname === item.href
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
