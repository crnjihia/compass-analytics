import { Webhook } from 'svix';
import { NextResponse } from 'next/server';
import { prisma, withTenant } from '@compass/db';

type ClerkWebhookEvent =
  | {
      type: 'organization.created' | 'organization.updated';
      data: {
        id: string;
        name: string;
        slug?: string;
      };
    }
  | {
      type: 'organization.deleted';
      data: {
        id: string;
        deleted: boolean;
      };
    };

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Get Svix headers for cryptographic verification directly from request
  const svix_id = req.headers.get('svix-id');
  const svix_timestamp = req.headers.get('svix-timestamp');
  const svix_signature = req.headers.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix verification headers' }, { status: 400 });
  }

  // Read payload body
  const body = await req.text();

  let evt: ClerkWebhookEvent;
  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error verifying Clerk webhook with Svix:', err);
    }
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const eventType = evt.type;

  try {
    if (eventType === 'organization.created' || eventType === 'organization.updated') {
      const { id, name } = evt.data;
      await withTenant(id, async (tx) => {
        await tx.organization.upsert({
          where: { clerkOrgId: id },
          create: {
            clerkOrgId: id,
            name: name || 'Untitled Organization',
          },
          update: {
            name: name || 'Untitled Organization',
          },
        });
      });
      console.log(`[Clerk Webhook] Organization upserted: ${name} (${id})`);
    } else if (eventType === 'organization.deleted') {
      const { id } = evt.data;
      await withTenant(id, async (tx) => {
        await tx.organization.deleteMany({
          where: { clerkOrgId: id },
        });
      });
      console.log(`[Clerk Webhook] Organization deleted: ${id}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[Clerk Webhook] Database error processing ${eventType}:`, err);
    return NextResponse.json({ error: 'Database synchronization failed' }, { status: 500 });
  }
}
