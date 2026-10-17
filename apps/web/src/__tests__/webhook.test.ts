import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '../app/api/webhooks/clerk/route';
import { Webhook } from 'svix';
import { prisma, withTenant } from '@compass/db';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const RAW_KEY = Buffer.from('test_secret_for_svix_verification_12345').toString('base64');
const WEBHOOK_SECRET = `whsec_${RAW_KEY}`;

describe('Clerk Svix Webhook Synchronization', () => {
  const originalSecret = process.env.CLERK_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.CLERK_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterAll(async () => {
    process.env.CLERK_WEBHOOK_SECRET = originalSecret;
    // Clean up test organization if created
    await withTenant('org_test_clerk_webhook_synced', async (tx) => {
      await tx.organization.deleteMany({
        where: { clerkOrgId: 'org_test_clerk_webhook_synced' },
      });
    });
    await prisma.$disconnect();
  });

  it('1. Rejects webhook request without Svix headers with 400', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      body: JSON.stringify({ type: 'organization.created' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing svix verification headers/i);
  });

  it('2. Rejects webhook request with invalid signature with 400', async () => {
    const payload = JSON.stringify({
      type: 'organization.created',
      data: { id: 'org_fake', name: 'Fake Org' },
    });

    const req = new Request('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': 'msg_fake_123',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,invalid_signature_string',
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid webhook signature/i);
  });

  it('3. Successfully verifies and synchronizes organization.created event', async () => {
    const testOrgId = 'org_test_clerk_webhook_synced';
    const testOrgName = 'Simba Cement Wholesalers';

    const payload = JSON.stringify({
      type: 'organization.created',
      data: { id: testOrgId, name: testOrgName },
    });

    const wh = new Webhook(WEBHOOK_SECRET);
    const timestamp = new Date();
    // Generate valid Svix signature (msgId, timestamp, payload)
    const signature = wh.sign('msg_valid_test_001', timestamp, payload);

    const req = new Request('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': 'msg_valid_test_001',
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify organization was persisted to database
    const org = await withTenant(testOrgId, async (tx) => {
      return tx.organization.findUnique({
        where: { clerkOrgId: testOrgId },
      });
    });
    expect(org).not.toBeNull();
    expect(org?.name).toBe(testOrgName);
  });

  it('4. Successfully processes organization.deleted event', async () => {
    const testOrgId = 'org_test_clerk_webhook_synced';

    const payload = JSON.stringify({
      type: 'organization.deleted',
      data: { id: testOrgId, deleted: true },
    });

    const wh = new Webhook(WEBHOOK_SECRET);
    const timestamp = new Date();
    const signature = wh.sign('msg_valid_test_002', timestamp, payload);

    const req = new Request('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': 'msg_valid_test_002',
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': signature,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify organization was deleted
    const org = await withTenant(testOrgId, async (tx) => {
      return tx.organization.findUnique({
        where: { clerkOrgId: testOrgId },
      });
    });
    expect(org).toBeNull();
  });
});
