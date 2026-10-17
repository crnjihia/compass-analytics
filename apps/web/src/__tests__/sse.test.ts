import { describe, it, expect, afterAll } from 'vitest';
import { GET } from '../app/api/stream/revenue/route';
import { redis } from '../lib/redis';
import { NextRequest } from 'next/server';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const TEST_ORG_ID = 'org_baraka_hardware';

describe('Server-Sent Events (SSE) Live Streaming Route', () => {
  afterAll(async () => {
    redis.disconnect();
  });

  it('1. Rejects request without organization context with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/stream/revenue');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing organization context/i);
  });

  it('2. Establishes SSE stream with correct headers and connected event', async () => {
    const req = new NextRequest(`http://localhost:3000/api/stream/revenue?orgId=${TEST_ORG_ID}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/i);
    expect(res.headers.get('cache-control')).toMatch(/no-cache/i);

    const body = res.body;
    expect(body).not.toBeNull();

    const reader = body!.getReader();
    const { value, done } = await reader.read();
    expect(done).toBe(false);

    const text = new TextDecoder().decode(value);
    expect(text).toMatch(/event: connected/);
    expect(text).toMatch(/org_baraka_hardware/);

    // Cancel stream to trigger cleanup
    await reader.cancel();
  });

  it('3. Streams real-time transaction events published to Redis channel', async () => {
    const req = new NextRequest(`http://localhost:3000/api/stream/revenue?orgId=${TEST_ORG_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();

    // Read initial connected event
    const { value: connectedVal } = await reader.read();
    const connectedText = new TextDecoder().decode(connectedVal);
    expect(connectedText).toMatch(/event: connected/);

    // Publish a mock transaction event to Redis channel
    const mockTxn = {
      id: 'txn_mock_sse_123',
      orgId: TEST_ORG_ID,
      mpesaReceipt: 'SSE999888',
      customerName: 'Juma Kamau',
      maskedMsisdn: '2547****678',
      amountCents: 250000,
      paidAt: new Date().toISOString(),
      billRef: 'INV-SSE-01',
    };

    await redis.publish(`org:${TEST_ORG_ID}:txn`, JSON.stringify(mockTxn));

    // Read the transaction event from stream (ignoring comments if any)
    let eventText = '';
    for (let i = 0; i < 5; i++) {
      const { value } = await reader.read();
      const chunk = new TextDecoder().decode(value);
      if (chunk.includes('event: transaction')) {
        eventText = chunk;
        break;
      }
    }

    expect(eventText).toMatch(/event: transaction/);
    expect(eventText).toMatch(/SSE999888/);
    expect(eventText).toMatch(/Juma Kamau/);

    await reader.cancel();
  });
});
