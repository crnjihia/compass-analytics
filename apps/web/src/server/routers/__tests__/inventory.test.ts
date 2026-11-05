import { describe, test, expect, vi } from 'vitest';
import { inventoryRouter } from '../inventory';
import { invalidateTenantCache } from '../../../lib/cache';

vi.mock('../../../lib/cache', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/cache')>('../../../lib/cache');
  return {
    ...actual,
    invalidateTenantCache: vi.fn().mockResolvedValue(2),
  };
});

describe('inventory.adjustStock mutation', () => {
  const mockCtx = {
    userId: 'user_test',
    orgRole: 'org:admin',
    db: {
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'prod1', stockOnHand: 10 }),
        update: vi.fn().mockResolvedValue({ stockOnHand: 5, id: 'prod1', sku: 'SKU1', name: 'TestProd' }),
      },
      stockMovement: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
    orgId: 'org_test',
  } as any;

  test('calls invalidateTenantCache after successful adjustment', async () => {
    const productId = 'a0000000-0000-0000-0000-000000000001';
    mockCtx.db.product.findUnique.mockResolvedValue({ id: productId, stockOnHand: 10 });
    mockCtx.db.product.update.mockResolvedValue({ stockOnHand: 5, id: productId, sku: 'SKU1', name: 'TestProd' });

    const input = { productId, delta: -5, reason: 'Stock correction' };
    const result = await inventoryRouter.createCaller(mockCtx).adjustStock(input);
    expect(result.product.stockOnHand).toBe(5);
    expect(invalidateTenantCache).toHaveBeenCalledWith('org_test');
  });
});
