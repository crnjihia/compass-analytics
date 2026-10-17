import { NextRequest, NextResponse } from 'next/server';
import { createRedisSubscriber } from '../../../../lib/redis';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // 1. Resolve Organization Context
  let orgId = req.nextUrl.searchParams.get('orgId') || req.headers.get('x-mock-org-id');

  if (!orgId) {
    try {
      const session = auth();
      orgId = session.orgId || null;
    } catch {
      // In testing / without Clerk context
    }
  }

  if (!orgId) {
    return NextResponse.json(
      { error: 'Missing organization context for live stream' },
      { status: 400 }
    );
  }

  const channel = `org:${orgId}:txn`;
  const encoder = new TextEncoder();
  let subscriber = createRedisSubscriber();
  let keepAliveTimer: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Handle Redis messages
      subscriber.on('message', (chan, message) => {
        if (isClosed) return;
        if (chan === channel) {
          try {
            controller.enqueue(
              encoder.encode(`event: transaction\ndata: ${message}\n\n`)
            );
          } catch (err) {
            console.error('[SSE Stream] Failed to enqueue message:', err);
          }
        }
      });

      try {
        await subscriber.subscribe(channel);
      } catch (err) {
        console.error('[SSE Stream] Error subscribing to Redis channel:', err);
        controller.error(err);
        return;
      }

      // Send initial connection event once Redis subscription is established
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', orgId, timestamp: new Date().toISOString() })}\n\n`)
      );

      // Keepalive heartbeat every 15s to prevent proxy/browser timeout
      keepAliveTimer = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // Controller might already be closed
        }
      }, 15000);
    },

    cancel() {
      isClosed = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (subscriber) {
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
      }
    },
  });

  // Handle client abort / disconnect
  req.signal.addEventListener('abort', () => {
    isClosed = true;
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    if (subscriber) {
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
