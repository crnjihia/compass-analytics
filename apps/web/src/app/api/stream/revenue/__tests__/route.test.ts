import { NextRequest } from 'next/server';
import { GET } from '../../../../api/stream/revenue/route';
import { NextResponse } from 'next/server';

describe('Revenue SSE route', () => {
  test('returns 400 when orgId missing', async () => {
    const req = new NextRequest('http://localhost/api/stream/revenue');
    const res = (await GET(req)) as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing organization context for live stream');
  });

  test('returns stream when orgId provided', async () => {
    const req = new NextRequest('http://localhost/api/stream/revenue?orgId=org_test');
    const res = (await GET(req)) as NextResponse;
    expect(res.status).toBe(200);
    // Ensure content-type is event-stream
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });
});
