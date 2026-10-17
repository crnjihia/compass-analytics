export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mpesa-500/10 border border-mpesa-500/20 text-mpesa-500 text-sm font-medium mb-6">
        <span className="w-2 h-2 rounded-full bg-mpesa-500 animate-pulse"></span>
        Multi-Tenant Business Analytics for Kenyan SMEs
      </div>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
        Compass <span className="text-mpesa-500">Analytics</span>
      </h1>
      <p className="text-slate-400 max-w-xl text-lg mb-8">
        Real-time M-Pesa revenue trends, customer cohort retention, and inventory velocity for African commerce.
      </p>
      <div className="flex gap-4">
        <a
          href="/dashboard"
          className="px-6 py-3 rounded-lg bg-mpesa-600 hover:bg-mpesa-500 text-white font-medium transition-colors"
        >
          Open Dashboard
        </a>
      </div>
    </main>
  );
}
