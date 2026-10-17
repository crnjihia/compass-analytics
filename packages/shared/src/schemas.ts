import { z } from 'zod';

/**
 * Daraja C2B Callback Payload schema
 */
export const DarajaCallbackSchema = z.object({
  TransactionType: z.string().optional(),
  TransID: z.string().min(1, 'TransID is required'),
  TransTime: z.string().min(14, 'TransTime must be YYYYMMDDHHmmss'),
  TransAmount: z.union([z.string(), z.number()]),
  BusinessShortCode: z.string().min(1, 'Shortcode is required'),
  BillRefNumber: z.string().default(''),
  InvoiceNumber: z.string().optional(),
  OrgAccountBalance: z.string().optional(),
  ThirdPartyTransID: z.string().optional(),
  MSISDN: z.string().min(9, 'MSISDN is required'),
  FirstName: z.string().optional(),
  MiddleName: z.string().optional(),
  LastName: z.string().optional(),
});

export type DarajaCallback = z.infer<typeof DarajaCallbackSchema>;

/**
 * M-Pesa Shortcode Connection setup schema
 */
export const MpesaConnectionSchema = z.object({
  shortcode: z.string().min(5).max(7),
  shortcodeType: z.enum(['PAYBILL', 'TILL']),
  consumerKey: z.string().min(10),
  consumerSecret: z.string().min(10),
  passkey: z.string().min(10),
});

export type MpesaConnectionInput = z.infer<typeof MpesaConnectionSchema>;

/**
 * Inventory Product Schema
 */
export const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.bigint().or(z.number().transform((n) => BigInt(n))),
  stockOnHand: z.number().int().default(0),
  reorderLevel: z.number().int().default(10),
});

export type ProductInput = z.infer<typeof ProductSchema>;

/**
 * Stock Adjustment Schema
 */
export const AdjustStockSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().min(1),
});

export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

/**
 * Timeseries Granularity Filter Schema
 */
export const TimeseriesFilterSchema = z.object({
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type TimeseriesFilter = z.infer<typeof TimeseriesFilterSchema>;
