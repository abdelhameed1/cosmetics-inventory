import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { useSettings } from '../src/hooks/useSettings';
import { useSchema } from '../src/hooks/useSchema';
import { useOverview } from '../src/hooks/useOverview';
import { useResources } from '../src/hooks/useResources';
import { LoadingProvider } from '../src/loading/LoadingProvider';

jest.mock('@strapi/strapi/admin', () => ({
  useFetchClient: jest.fn(),
}));

describe('Admin Custom Hooks', () => {
  const mockGet = jest.fn();
  const mockPut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({
      get: mockGet,
      put: mockPut,
      post: jest.fn(),
      del: jest.fn(),
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LoadingProvider>{children}</LoadingProvider>
  );

  describe('useSettings', () => {
    it('fetches settings and saves exchange rate', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          exchangeRate: 50.0,
          exchangeRateUpdatedAt: '2026-08-04T00:00:00.000Z',
        },
      });

      const { result } = renderHook(() => useSettings(), { wrapper });

      await waitFor(() => {
        expect(result.current.exchangeRate).toBe(50.0);
      });

      expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/settings', {
        params: undefined,
      });

      // Now test save()
      mockPut.mockResolvedValueOnce({
        data: {
          exchangeRate: 52.5,
          exchangeRateUpdatedAt: '2026-08-04T02:00:00.000Z',
        },
      });

      await act(async () => {
        await result.current.save(52.5);
      });

      expect(mockPut).toHaveBeenCalledWith('/inventory-dashboard/settings', {
        exchangeRate: 52.5,
      });
      expect(result.current.exchangeRate).toBe(52.5);
    });
  });

  describe('useSchema', () => {
    it('fetches metadata schema for a resource', async () => {
      const mockSchema = {
        resource: 'products',
        uid: 'api::product.product',
        fields: [
          { name: 'name', type: 'string', required: true, hidden: false },
        ],
      };

      mockGet.mockResolvedValueOnce({ data: mockSchema });

      const { result } = renderHook(() => useSchema('products'), { wrapper });

      await waitFor(() => {
        expect(result.current.schema).toEqual(mockSchema);
      });

      expect(mockGet).toHaveBeenCalledWith(
        '/inventory-dashboard/resources/products/schema',
        { params: undefined }
      );
    });
  });

  describe('useOverview', () => {
    it('fetches the overview payload', async () => {
      mockGet.mockResolvedValueOnce({ data: { totalStockUnits: 10 } });

      const { result } = renderHook(() => useOverview(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual({ totalStockUnits: 10 });
      });
      expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/overview', { params: undefined });
      expect(result.current.isInitialLoading).toBe(false);
    });

    it('exposes the fetch error and lets reload retry', async () => {
      mockGet.mockRejectedValueOnce(new Error('network down'));
      const { result } = renderHook(() => useOverview(), { wrapper });

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

      mockGet.mockResolvedValueOnce({ data: { totalStockUnits: 5 } });
      await act(async () => {
        result.current.reload();
      });
      await waitFor(() => expect(result.current.data).toEqual({ totalStockUnits: 5 }));
    });
  });

  describe('useResources', () => {
    it('unwraps the resources array from the response', async () => {
      mockGet.mockResolvedValueOnce({ data: { resources: ['brands', 'categories'] } });

      const { result } = renderHook(() => useResources(), { wrapper });

      await waitFor(() => {
        expect(result.current.resources).toEqual(['brands', 'categories']);
      });
    });

    it('defaults to an empty array while loading', () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useResources(), { wrapper });
      expect(result.current.resources).toEqual([]);
    });
  });
});
