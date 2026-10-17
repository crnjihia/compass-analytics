import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { encryptCredential } from '@compass/shared';
import { TRPCError } from '@trpc/server';
import crypto from 'crypto';

export const connectionRouter = router({
  /**
   * Get Active M-Pesa Daraja Connection Status (Masked)
   * Plain consumer secrets/keys are NEVER returned.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const connection = await ctx.db.mpesaConnection.findFirst({
      where: { orgId: ctx.orgId },
    });

    if (!connection) {
      return {
        connected: false,
        connection: null,
      };
    }

    return {
      connected: connection.status === 'ACTIVE',
      connection: {
        id: connection.id,
        shortcode: connection.shortcode,
        shortcodeType: connection.shortcodeType,
        status: connection.status,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        hasConsumerKey: Boolean(connection.consumerKeyEnc),
        hasConsumerSecret: Boolean(connection.consumerSecretEnc),
        hasPasskey: Boolean(connection.passkeyEnc),
        callbackSecretPrefix: connection.callbackSecret
          ? `${connection.callbackSecret.slice(0, 10)}...`
          : null,
      },
    };
  }),

  /**
   * Connect M-Pesa Daraja Credentials (Admin only)
   * Encrypts consumer key, consumer secret, and passkey with AES-256-GCM.
   */
  connect: adminProcedure
    .input(
      z.object({
        shortcode: z.string().min(5).max(8),
        shortcodeType: z.enum(['PAYBILL', 'TILL']),
        consumerKey: z.string().min(1, 'Consumer Key is required'),
        consumerSecret: z.string().min(1, 'Consumer Secret is required'),
        passkey: z.string().min(1, 'Passkey is required'),
        callbackSecret: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { shortcode, shortcodeType, consumerKey, consumerSecret, passkey } = input;

      const consumerKeyEnc = encryptCredential(consumerKey);
      const consumerSecretEnc = encryptCredential(consumerSecret);
      const passkeyEnc = encryptCredential(passkey);
      const callbackSecret = input.callbackSecret || `whsec_${crypto.randomBytes(24).toString('hex')}`;

      const connection = await ctx.db.mpesaConnection.upsert({
        where: {
          orgId_shortcode: {
            orgId: ctx.orgId,
            shortcode,
          },
        },
        create: {
          orgId: ctx.orgId,
          shortcode,
          shortcodeType,
          consumerKeyEnc,
          consumerSecretEnc,
          passkeyEnc,
          callbackSecret,
          status: 'ACTIVE',
        },
        update: {
          shortcodeType,
          consumerKeyEnc,
          consumerSecretEnc,
          passkeyEnc,
          callbackSecret,
          status: 'ACTIVE',
        },
      });

      return {
        success: true,
        connectionId: connection.id,
        shortcode: connection.shortcode,
        status: connection.status,
      };
    }),

  /**
   * Rotate M-Pesa Consumer Secret / Passkey (Admin only)
   */
  rotateSecret: adminProcedure
    .input(
      z.object({
        shortcode: z.string(),
        newConsumerSecret: z.string().min(1),
        newPasskey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { shortcode, newConsumerSecret, newPasskey } = input;

      const connection = await ctx.db.mpesaConnection.findUnique({
        where: {
          orgId_shortcode: {
            orgId: ctx.orgId,
            shortcode,
          },
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Connection for shortcode ${shortcode} not found`,
        });
      }

      const consumerSecretEnc = encryptCredential(newConsumerSecret);
      const passkeyEnc = newPasskey ? encryptCredential(newPasskey) : connection.passkeyEnc;

      await ctx.db.mpesaConnection.update({
        where: { id: connection.id },
        data: {
          consumerSecretEnc,
          passkeyEnc,
        },
      });

      return {
        success: true,
        shortcode,
        message: 'Credentials rotated successfully',
      };
    }),

  /**
   * Disconnect / Deactivate M-Pesa Connection (Admin only)
   */
  disconnect: adminProcedure
    .input(
      z.object({
        shortcode: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.mpesaConnection.findUnique({
        where: {
          orgId_shortcode: {
            orgId: ctx.orgId,
            shortcode: input.shortcode,
          },
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Connection for shortcode ${input.shortcode} not found`,
        });
      }

      await ctx.db.mpesaConnection.update({
        where: { id: connection.id },
        data: { status: 'INACTIVE' },
      });

      return {
        success: true,
        shortcode: input.shortcode,
        status: 'INACTIVE',
      };
    }),
});
