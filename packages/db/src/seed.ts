import { PrismaClient } from '../generated/client';
import { encryptCredential, hashMsisdn, maskMsisdn } from '@compass/shared';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Use DIRECT_URL for admin seeding without RLS restrictions
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
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

async function main() {
  console.log('🌱 Starting database seed with Kenyan SME demo organizations...');

  // Clean existing seed data
  await prisma.salesItem.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.mpesaConnection.deleteMany({});
  await prisma.revenueHourly.deleteMany({});
  await prisma.cohortMonthly.deleteMany({});
  await prisma.organization.deleteMany({});

  // Seed Organizations
  await prisma.organization.createMany({
    data: [
      { id: ORG_1.id, clerkOrgId: ORG_1.clerkOrgId, name: ORG_1.name },
      { id: ORG_2.id, clerkOrgId: ORG_2.clerkOrgId, name: ORG_2.name },
    ],
  });

  // Seed M-Pesa Connections with AES-256-GCM encrypted credentials
  await prisma.mpesaConnection.createMany({
    data: [
      {
        orgId: ORG_1.clerkOrgId,
        shortcode: ORG_1.shortcode,
        shortcodeType: ORG_1.shortcodeType,
        consumerKeyEnc: encryptCredential('baraka_live_consumer_key_xyz'),
        consumerSecretEnc: encryptCredential('baraka_live_consumer_secret_abc'),
        passkeyEnc: encryptCredential('baraka_passkey_1234567890'),
        callbackSecret: 'whsec_baraka_secret_token_123',
        status: 'ACTIVE',
      },
      {
        orgId: ORG_2.clerkOrgId,
        shortcode: ORG_2.shortcode,
        shortcodeType: ORG_2.shortcodeType,
        consumerKeyEnc: encryptCredential('nairobi_fresh_consumer_key_xyz'),
        consumerSecretEnc: encryptCredential('nairobi_fresh_consumer_secret_abc'),
        passkeyEnc: encryptCredential('nairobi_fresh_passkey_0987654321'),
        callbackSecret: 'whsec_nairobi_secret_token_456',
        status: 'ACTIVE',
      },
    ],
  });

  // Seed Products for Org 1 (Hardware)
  const p1_1 = await prisma.product.create({
    data: {
      orgId: ORG_1.clerkOrgId,
      sku: 'BAM-CEM-50KG',
      name: 'Bamburi Nguvu Cement 50kg',
      priceCents: 92000n, // KES 920.00
      stockOnHand: 140,
      reorderLevel: 25,
    },
  });

  const p1_2 = await prisma.product.create({
    data: {
      orgId: ORG_1.clerkOrgId,
      sku: 'CRW-VIN-4L',
      name: 'Crown Vinyl Matt Brilliant White 4L',
      priceCents: 245000n, // KES 2,450.00
      stockOnHand: 32,
      reorderLevel: 10,
    },
  });

  const p1_3 = await prisma.product.create({
    data: {
      orgId: ORG_1.clerkOrgId,
      sku: 'NLS-3IN-1KG',
      name: 'Ordinary Steel Wire Nails 3 inch (1kg packet)',
      priceCents: 18000n, // KES 180.00
      stockOnHand: 8, // Low stock!
      reorderLevel: 15,
    },
  });

  // Seed Products for Org 2 (Fresh Produce)
  const p2_1 = await prisma.product.create({
    data: {
      orgId: ORG_2.clerkOrgId,
      sku: 'AV-HASS-BX',
      name: 'Organic Hass Avocado Export Grade (10kg Crate)',
      priceCents: 150000n, // KES 1,500.00
      stockOnHand: 65,
      reorderLevel: 15,
    },
  });

  const p2_2 = await prisma.product.create({
    data: {
      orgId: ORG_2.clerkOrgId,
      sku: 'TEA-KG-500G',
      name: 'Kericho Gold Pure Black Tea 500g',
      priceCents: 45000n, // KES 450.00
      stockOnHand: 120,
      reorderLevel: 20,
    },
  });

  // Seed Customers for Org 1
  const phonesOrg1 = [
    { phone: '254712345678', name: 'Juma Kamau' },
    { phone: '254722987654', name: 'Amina Wanjiku' },
    { phone: '254733112233', name: 'David Omondi' },
  ];

  for (const c of phonesOrg1) {
    const msisdnHash = hashMsisdn(c.phone, ORG_1.clerkOrgId);
    const masked = maskMsisdn(c.phone);
    await prisma.customer.create({
      data: {
        orgId: ORG_1.clerkOrgId,
        msisdnHash,
        maskedMsisdn: masked,
        customerName: c.name,
        firstSeenAt: new Date(Date.now() - 25 * 86400000),
        lastSeenAt: new Date(Date.now() - 2 * 86400000),
        txnCount: 3,
        ltvCents: 755000n, // KES 7,550.00
      },
    });
  }

  // Seed Customers for Org 2
  const phonesOrg2 = [
    { phone: '254701445566', name: 'Faith Muthoni' },
    { phone: '254799887766', name: 'Brian Kiprono' },
  ];

  for (const c of phonesOrg2) {
    const msisdnHash = hashMsisdn(c.phone, ORG_2.clerkOrgId);
    const masked = maskMsisdn(c.phone);
    await prisma.customer.create({
      data: {
        orgId: ORG_2.clerkOrgId,
        msisdnHash,
        maskedMsisdn: masked,
        customerName: c.name,
        firstSeenAt: new Date(Date.now() - 15 * 86400000),
        lastSeenAt: new Date(Date.now() - 1 * 86400000),
        txnCount: 2,
        ltvCents: 340000n, // KES 3,400.00
      },
    });
  }

  // Seed Transactions & Sales Items for Org 1
  const t1 = await prisma.transaction.create({
    data: {
      orgId: ORG_1.clerkOrgId,
      mpesaReceipt: 'SHK981AB01',
      msisdnHash: hashMsisdn('254712345678', ORG_1.clerkOrgId),
      maskedMsisdn: maskMsisdn('254712345678'),
      customerName: 'Juma Kamau',
      amountCents: 510000n, // KES 5,100.00
      billRef: 'INVOICE-001',
      paidAt: new Date(Date.now() - 3600000 * 4),
      raw: {
        TransactionType: 'Customer PayBill',
        TransID: 'SHK981AB01',
        TransAmount: '5100.00',
        BusinessShortCode: ORG_1.shortcode,
      },
    },
  });

  await prisma.salesItem.create({
    data: {
      orgId: ORG_1.clerkOrgId,
      transactionId: t1.id,
      productId: p1_1.id,
      qty: 5,
      unitPriceCents: 92000n,
      soldAt: t1.paidAt,
    },
  });

  // Seed Transactions for Org 2
  await prisma.transaction.create({
    data: {
      orgId: ORG_2.clerkOrgId,
      mpesaReceipt: 'QRT123CD89',
      msisdnHash: hashMsisdn('254701445566', ORG_2.clerkOrgId),
      maskedMsisdn: maskMsisdn('254701445566'),
      customerName: 'Faith Muthoni',
      amountCents: 300000n, // KES 3,000.00
      billRef: 'TILL-BUY',
      paidAt: new Date(Date.now() - 3600000 * 2),
      raw: {
        TransactionType: 'Customer Buy Goods',
        TransID: 'QRT123CD89',
        TransAmount: '3000.00',
        BusinessShortCode: ORG_2.shortcode,
      },
    },
  });

  // Seed Rollup Tables (revenue_hourly)
  const now = new Date();
  const currentHourBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));

  await prisma.revenueHourly.createMany({
    data: [
      {
        orgId: ORG_1.clerkOrgId,
        bucket: currentHourBucket,
        totalCents: 510000n,
        txnCount: 1,
      },
      {
        orgId: ORG_2.clerkOrgId,
        bucket: currentHourBucket,
        totalCents: 300000n,
        txnCount: 1,
      },
    ],
  });

  // Seed Cohorts (cohort_monthly)
  const cohortMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await prisma.cohortMonthly.createMany({
    data: [
      {
        orgId: ORG_1.clerkOrgId,
        cohortMonth,
        periodN: 0,
        activeCustomers: 3,
      },
      {
        orgId: ORG_2.clerkOrgId,
        cohortMonth,
        periodN: 0,
        activeCustomers: 2,
      },
    ],
  });

  console.log('✅ Seed completed successfully:');
  console.log(` - Org 1: ${ORG_1.name} (${ORG_1.clerkOrgId})`);
  console.log(` - Org 2: ${ORG_2.name} (${ORG_2.clerkOrgId})`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
