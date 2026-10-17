/**
 * Compass Analytics - Interactive Showcase Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initLiveSimulator();
  initArchInspector();
  initAdrAccordion();
  initCopyButtons();
  initKpiCounters();
});

// --- 1. Live M-Pesa Simulator ---
function initLiveSimulator() {
  const streamList = document.getElementById('stream-list');
  const revenueEl = document.getElementById('kpi-revenue');
  const txnCountEl = document.getElementById('kpi-txns');
  const avgBasketEl = document.getElementById('kpi-basket');
  const tenantBtns = document.querySelectorAll('.tenant-btn');
  const triggerBtn = document.getElementById('trigger-pay-btn');
  const customAmountInput = document.getElementById('sim-amount');
  const customNameInput = document.getElementById('sim-name');

  if (!streamList || !revenueEl) return;

  const TENANTS = {
    baraka: {
      name: 'Baraka Hardware Ltd',
      orgId: 'org_baraka_hardware',
      shortcode: '890123',
      shortcodeType: 'PAYBILL',
      revenueCents: 48920000n, // KES 489,200.00
      txnCount: 342,
      samples: [
        { name: 'John Kamau', amount: 920.00, item: 'Bamburi Nguvu Cement 50kg' },
        { name: 'Peter Mwangi', amount: 2450.00, item: 'Crown Vinyl Matt Paint 4L' },
        { name: 'Grace Wambui', amount: 360.00, item: 'Ordinary Nails 3-inch 2kg' },
        { name: 'David Kiprono', amount: 18400.00, item: 'Deformed Bar D12 (20 pcs)' },
        { name: 'Mercy Achieng', amount: 1250.00, item: 'PVA Wood Adhesive 5L' }
      ]
    },
    nairobi_fresh: {
      name: 'Nairobi Fresh Grocers',
      orgId: 'org_nairobi_fresh',
      shortcode: '987654',
      shortcodeType: 'TILL',
      revenueCents: 19450000n, // KES 194,500.00
      txnCount: 488,
      samples: [
        { name: 'Sarah Chebet', amount: 1850.00, item: 'Organic Hass Avocado Export Crate' },
        { name: 'Brian Omondi', amount: 750.00, item: 'Sweet Yellow Passion Fruit 5kg' },
        { name: 'Faith Njeri', amount: 420.00, item: 'Fresh Mint & Basil Herb Pack' },
        { name: 'Kelvin Mutua', amount: 2100.00, item: 'Export Grade French Beans Box' },
        { name: 'Alice Wafula', amount: 980.00, item: 'Ripe Honey Mangoes Crate' }
      ]
    }
  };

  let activeTenantKey = 'baraka';
  let activeTenant = TENANTS[activeTenantKey];

  function updateKpiDisplays() {
    const shillings = Number(activeTenant.revenueCents / 100n);
    revenueEl.textContent = 'KES ' + shillings.toLocaleString('en-KE', { minimumFractionDigits: 2 });
    txnCountEl.textContent = activeTenant.txnCount.toLocaleString();
    const avg = activeTenant.txnCount > 0 ? (shillings / activeTenant.txnCount) : 0;
    avgBasketEl.textContent = 'KES ' + avg.toLocaleString('en-KE', { maximumFractionDigits: 0 });
  }

  function generateReceipt() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = 'QHD';
    for (let i = 0; i < 7; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  function generateMaskedMsisdn() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `2547****${num}`;
  }

  function addTransaction(name, amount, item) {
    const receipt = generateReceipt();
    const msisdn = generateMaskedMsisdn();
    const cents = BigInt(Math.round(amount * 100));

    activeTenant.revenueCents += cents;
    activeTenant.txnCount += 1;
    updateKpiDisplays();

    const itemEl = document.createElement('div');
    itemEl.className = 'stream-item';
    itemEl.innerHTML = `
      <div class="stream-item-info">
        <span class="stream-item-receipt">${receipt} • ${activeTenant.shortcodeType} ${activeTenant.shortcode}</span>
        <span class="stream-item-sender">${escapeHtml(name)} <span style="color:var(--text-dim);font-weight:400;">(${msisdn})</span></span>
        <span style="font-size:0.775rem;color:var(--text-muted);">${escapeHtml(item)}</span>
      </div>
      <div class="stream-item-amount">+KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
    `;

    streamList.prepend(itemEl);

    // Keep max 15 items in view
    while (streamList.children.length > 15) {
      streamList.removeChild(streamList.lastChild);
    }
  }

  // Tenant switcher
  tenantBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tenantBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTenantKey = btn.dataset.tenant;
      activeTenant = TENANTS[activeTenantKey];
      streamList.innerHTML = '';
      updateKpiDisplays();
      
      // Seed 2 initial items
      const sample1 = activeTenant.samples[0];
      const sample2 = activeTenant.samples[1];
      addTransaction(sample1.name, sample1.amount, sample1.item);
      addTransaction(sample2.name, sample2.amount, sample2.item);
    });
  });

  // Manual Trigger
  if (triggerBtn) {
    triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const amount = parseFloat(customAmountInput.value) || 1500;
      const name = customNameInput.value.trim() || 'Verified Customer';
      const item = 'Direct Terminal Checkout';
      addTransaction(name, amount, item);
      customAmountInput.value = '';
      customNameInput.value = '';
    });
  }

  // Auto-stream interval (every 3.5s)
  setInterval(() => {
    const randomSample = activeTenant.samples[Math.floor(Math.random() * activeTenant.samples.length)];
    // add small random variation to price
    const jitter = (Math.random() * 0.2 - 0.1) * randomSample.amount;
    const finalAmount = Math.max(10, Math.round((randomSample.amount + jitter) * 100) / 100);
    addTransaction(randomSample.name, finalAmount, randomSample.item);
  }, 3500);

  // Initialize
  updateKpiDisplays();
  addTransaction('John Kamau', 920.00, 'Bamburi Nguvu Cement 50kg');
  addTransaction('Peter Mwangi', 2450.00, 'Crown Vinyl Matt Paint 4L');
}

// --- 2. Architecture Interactive Inspector ---
function initArchInspector() {
  const cards = document.querySelectorAll('.arch-card');
  const specBox = document.getElementById('arch-spec-box');
  const specTitle = document.getElementById('spec-title');
  const specBody = document.getElementById('spec-body');

  if (!cards.length || !specBox) return;

  const SPECS = {
    daraja: {
      title: 'Safaricom Daraja 2.0 Webhook Gateway',
      body: `
        <p><strong>Protocol:</strong> HTTP POST (JSON Payload: <code>TransID</code>, <code>TransAmount</code>, <code>BillRefNumber</code>, <code>MSISDN</code>)</p>
        <p><strong>Latency Budget:</strong> Response required in &lt; 3000ms by Safaricom Telco Core.</p>
        <p><strong>Security:</strong> Dual validation endpoint verification with AES-256-GCM credentials decrypted per-tenant.</p>
        <p><strong>High Availability:</strong> Multi-region AWS Cape Town ALB terminating SSL with instantaneous 200 OK handshakes.</p>
      `
    },
    ingest: {
      title: 'Go 1.23 High-Throughput Ingest Service',
      body: `
        <p><strong>Runtime:</strong> Static Go binary in Alpine Linux (~14MB footprint), Zero-allocation Chi router.</p>
        <p><strong>Buffering:</strong> Direct non-blocking push into Redis Streams (<code>mpesa:txns</code>) in &lt; 1.8ms.</p>
        <p><strong>Worker Pool:</strong> 8 concurrent worker routines with Redis consumer groups (<code>mpesa_workers</code>) and idempotency deduplication (<code>dedup:mpesa:{org}:{trans_id}</code>).</p>
        <p><strong>Observability:</strong> Native Prometheus metrics at <code>:9100/metrics</code> tracking p95/p99 duration and transaction counters.</p>
      `
    },
    postgres: {
      title: 'PostgreSQL 16 Multi-Tenant Row-Level Security',
      body: `
        <p><strong>Security Boundary:</strong> Hard engine-level RLS policy: <code>USING (org_id = current_setting('app.org_id', true))</code>.</p>
        <p><strong>Connection Session:</strong> Automatic <code>SET LOCAL app.org_id = $1</code> scoped transactions executed via Prisma extension.</p>
        <p><strong>Data Precision:</strong> 64-bit integer Kenyan Shilling cents (<code>BigInt</code>) eliminating IEEE 754 float rounding errors.</p>
        <p><strong>Storage Strategy:</strong> Optimized compound index <code>(org_id, paid_at DESC)</code> for sub-5ms analytics retrieval.</p>
      `
    },
    web: {
      title: 'Next.js 14 Analytics App (tRPC + SSE)',
      body: `
        <p><strong>Architecture:</strong> Next.js 14 Standalone bundle with tRPC v10 end-to-end type safety.</p>
        <p><strong>Live Real-Time:</strong> Server-Sent Events (SSE) route streaming live incoming transactions with 15s keepalive heartbeat.</p>
        <p><strong>Stampede Barrier:</strong> In-memory <code>SingleFlight</code> coalescing concurrent queries, achieving 99.2% database query reduction.</p>
        <p><strong>Multi-Tenant Clerk:</strong> Multi-tenant authentication with Svix webhook synchronization.</p>
      `
    },
    eks: {
      title: 'AWS EKS 1.30 & Cloud-Native Infrastructure',
      body: `
        <p><strong>Region:</strong> AWS Cape Town (<code>af-south-1</code>) for sub-40ms Kenyan roundtrip latency.</p>
        <p><strong>Hardening:</strong> Non-root container execution (UID 1001 / 10001), drop ALL capabilities, read-only root filesystems.</p>
        <p><strong>Zero-Trust:</strong> Default-deny Kubernetes NetworkPolicies isolating internal pod traffic.</p>
        <p><strong>Autoscaling:</strong> Horizontal Pod Autoscalers (HPA) dynamically scaling Go ingest up to 20 replicas under traffic bursts.</p>
      `
    },
    grafana: {
      title: 'Prometheus & Grafana Observability Suite',
      body: `
        <p><strong>Scraping:</strong> Native CoreOS <code>ServiceMonitor</code> scraping Ingest metrics at 5s intervals.</p>
        <p><strong>Alerting:</strong> Automated Prometheus rules triggering on Daraja 5xx rate &gt; 1%, p99 latency &gt; 250ms, and Redis queue depth.</p>
        <p><strong>Dashboard:</strong> Pre-provisioned Grafana dashboards tracking financial volume, throughput (req/s), and tenant activity.</p>
      `
    }
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const key = card.dataset.arch;
      const data = SPECS[key];
      if (data) {
        specTitle.textContent = data.title;
        specBody.innerHTML = data.body;
        specBox.classList.add('show');
        specBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });
}

// --- 3. ADR Accordion ---
function initAdrAccordion() {
  const items = document.querySelectorAll('.adr-item');
  items.forEach(item => {
    const header = item.querySelector('.adr-header');
    if (!header) return;
    header.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => i.classList.remove('open'));
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

// --- 4. One-Click Copy Buttons ---
function initCopyButtons() {
  const buttons = document.querySelectorAll('.copy-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      
      const text = targetEl.textContent.trim();
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        btn.style.color = 'var(--emerald)';
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.color = '';
        }, 2000);
      });
    });
  });
}

// --- 5. Animated KPI Counters ---
function initKpiCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const targetVal = parseFloat(el.dataset.counter);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 1200;
        const start = performance.now();

        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const current = (easeOut * targetVal).toFixed(el.dataset.decimals || 0);
          el.textContent = `${prefix}${current}${suffix}`;
          if (progress < 1) {
            requestAnimationFrame(step);
          }
        }

        requestAnimationFrame(step);
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.2 });

  counters.forEach(c => observer.observe(c));
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
