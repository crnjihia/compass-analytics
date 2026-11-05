import { inventoryRouter } from '../inventory';
import { createTRPCContext } from '../../../utils/trpc';
import { invalidateTenantCache } from '../../../lib/cache';

jest.mock('../../../lib/cache', () => ({
  ...jest.requireActual('../../../lib/cache'),
  invalidateTenantCache: jest.fn().mockResolvedValue(2),
}));

describe('inventory.adjustStock mutation', () => {
  const mockCtx = {
    db: {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prod1', stockOnHand: 10 }),
        update: jest.fn().mockResolvedValue({ stockOnHand: 5, id: 'prod1', sku: 'SKU1', name: 'TestProd' }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    },
    orgId: 'org_test',
  } as any;

  test('calls invalidateTenantCache after successful adjustment', async () => {
    const input = { productId: 'prod1', delta: -5, reason: 'Stock correction' };
    const result = await inventoryRouter.createCaller(mockCtx).adjustStock(input);
    expect(result.product.stockOnHand).toBe(5);
    expect(invalidateTenantCache).toHaveBeenCalledWith('org_test');
  });
});
