import { PrismaClient } from '../generated/client';
import { encryptCredential, hashMsisdn, maskMsisdn } from '@compass/shared';
import * as dotenv from 'dotenv';

dotenv.config();

// Admin client (bypasses RLS)
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

export const ORG_1 = {
  id: 'c0000000-0000-0000-0000-000000000001',
  clerkOrgId: 'org_baraka_hardware',
  name: 'Baraka Hardware Ltd',
  shortcode: '890123',
  shortcodeType: 'PAYBILL',
};
export const ORG_2 = {
  id: 'c0000000-0000-0000-0000-000000000002',
  clerkOrgId: 'org_nairobi_fresh',
  name: 'Nairobi Fresh Grocers',
  shortcode: '987654',
  shortcodeType: 'TILL',
};
export const ORG_3 = {
  id: 'c0000000-0000-0000-0000-000000000003',
  clerkOrgId: 'org_mombasa_market',
  name: 'Mombasa Market Traders',
  shortcode: '555777',
  shortcodeType: 'PAYBILL',
};

async function main() {
  console.log('🌱 Starting synthetic seed for demo orgs...');

  // Clean existing data
  await prisma.salesItem.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.mpesaConnection.deleteMany({});
  await prisma.revenueHourly.deleteMany({});
  await prisma.cohortMonthly.deleteMany({});
  await prisma.organization.deleteMany({});

  // Organizations
  await prisma.organization.createMany({
    data: [ORG_1, ORG_2, ORG_3].map(o => ({ id: o.id, clerkOrgId: o.clerkOrgId, name: o.name })),
  });

  // M-Pesa connections (one per org)
  const connData = [ORG_1, ORG_2, ORG_3].map(o => ({
    orgId: o.clerkOrgId,
    shortcode: o.shortcode,
    shortcodeType: o.shortcodeType,
    consumerKeyEnc: encryptCredential(`${o.clerkOrgId}_key`),
    consumerSecretEnc: encryptCredential(`${o.clerkOrgId}_secret`),
    passkeyEnc: encryptCredential(`${o.clerkOrgId}_passkey`),
    callbackSecret: `whsec_${o.clerkOrgId}`,
    status: 'ACTIVE',
  }));
  await prisma.mpesaConnection.createMany({ data: connData });

  // Products (2 per org)
  const prodTemplates = {
    [ORG_1.clerkOrgId]: [
      { sku: 'BAM-CEM-50KG', name: 'Bamburi Nguvu Cement 50kg', priceCents: 92000n, stockOnHand: 140, reorderLevel: 25 },
      { sku: 'CRW-VIN-4L', name: 'Crown Vinyl Matt 4L', priceCents: 245000n, stockOnHand: 32, reorderLevel: 10 },
      { sku: 'NLS-3IN-1KG', name: 'Wire Nails 3 Inch 1kg', priceCents: 18000n, stockOnHand: 8, reorderLevel: 20 },
    ],
    [ORG_2.clerkOrgId]: [
      { sku: 'AV-HASS-BX', name: 'Organic Hass Avocado 10kg', priceCents: 150000n, stockOnHand: 65, reorderLevel: 15 },
      { sku: 'TEA-500G', name: 'Kericho Gold Black Tea 500g', priceCents: 45000n, stockOnHand: 120, reorderLevel: 20 },
    ],
    [ORG_3.clerkOrgId]: [
      { sku: 'MM-FISH-5KG', name: 'Fresh Tilapia 5kg', priceCents: 125000n, stockOnHand: 80, reorderLevel: 20 },
      { sku: 'MM-SPC-1KG', name: 'Spiced Goat Meat 1kg', priceCents: 300000n, stockOnHand: 45, reorderLevel: 10 },
    ],
  };
  const productMap: Record<string, any[]> = {};
  for (const orgId of Object.keys(prodTemplates)) {
    productMap[orgId] = [];
    for (const tmpl of (prodTemplates as Record<string, any[]>)[orgId]) {
      const p = await prisma.product.create({ data: { orgId, ...tmpl } });
      productMap[orgId].push(p);
    }
  }

  // Demo customers per org
  const customersByOrg: Record<string, { phone: string; name: string }[]> = {
    [ORG_1.clerkOrgId]: [
      { phone: '254712345678', name: 'Juma Kamau' },
      { phone: '254722987654', name: 'Amina Wanjiku' },
    ],
    [ORG_2.clerkOrgId]: [
      { phone: '254701445566', name: 'Faith Muthoni' },
      { phone: '254799887766', name: 'Brian Kiprono' },
    ],
    [ORG_3.clerkOrgId]: [
      { phone: '254711223344', name: 'Mariam Ali' },
      { phone: '254733445566', name: 'Juma Said' },
    ],
  };
  for (const orgId of Object.keys(customersByOrg)) {
    for (const c of customersByOrg[orgId]) {
      await prisma.customer.create({
        data: {
          orgId,
          msisdnHash: hashMsisdn(c.phone, orgId),
          maskedMsisdn: maskMsisdn(c.phone),
          customerName: c.name,
          firstSeenAt: new Date(Date.now() - 30 * 86400000),
          lastSeenAt: new Date(),
          txnCount: 0,
          ltvCents: 0n,
        },
      });
    }
  }

  // ---------- Synthetic transaction generation (12 months) ----------
  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (min: number, max: number, rnd: () => number) => Math.floor(rnd() * (max - min + 1)) + min;
  const ONE_DAY = 86400000;
  const now = new Date();

  for (const org of [ORG_1, ORG_2, ORG_3]) {
    const prods = productMap[org.clerkOrgId];
    const custs = customersByOrg[org.clerkOrgId];
    const seed = org.clerkOrgId.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const rnd = mulberry32(seed);
    for (let d = 0; d < 365; d++) {
      const day = new Date(now.getTime() - d * ONE_DAY);
      const dayOfMonth = day.getUTCDate();
      let txCount = randInt(3, 7, rnd);
      if (dayOfMonth >= 25 && dayOfMonth <= 30) txCount += randInt(5, 10, rnd);
      if (day.getUTCDay() === 1) txCount += randInt(1, 3, rnd);
      for (let i = 0; i < txCount; i++) {
        const cust = custs[randInt(0, custs.length - 1, rnd)];
        const prod = prods[randInt(0, prods.length - 1, rnd)];
        const qty = randInt(1, 5, rnd);
        const amount = prod.priceCents * BigInt(qty);
        const receipt = `RX${org.shortcode.slice(-2)}${d.toString().padStart(3, '0')}${i.toString().padStart(3, '0')}${Math.floor(rnd() * 1000).toString().padStart(3, '0')}`;
        const paidAt = new Date(day.getTime() + randInt(0, ONE_DAY - 1, rnd));
        const tx = await prisma.transaction.create({
          data: {
            orgId: org.clerkOrgId,
            mpesaReceipt: receipt,
            msisdnHash: hashMsisdn(cust.phone, org.clerkOrgId),
            maskedMsisdn: maskMsisdn(cust.phone),
            customerName: cust.name,
            amountCents: amount,
            billRef: null,
            paidAt,
            raw: {
              TransactionType: 'Customer PayBill',
              TransID: receipt,
              TransAmount: (Number(amount) / 100).toFixed(2),
              BusinessShortCode: org.shortcode,
            },
          },
        });
        await prisma.salesItem.create({
          data: {
            orgId: org.clerkOrgId,
            transactionId: tx.id,
            productId: prod.id,
            qty,
            unitPriceCents: prod.priceCents,
            soldAt: paidAt,
          },
        });
      }
    }
  }

  console.log('✅ Synthetic seed completed for all demo orgs.');
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
