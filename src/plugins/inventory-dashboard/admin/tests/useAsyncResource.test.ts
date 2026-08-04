import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsyncResource } from '../src/hooks/useAsyncResource';

describe('useAsyncResource hook', () => {
  it('starts with isInitialLoading true, then resolves with data', async () => {
    const fetcher = jest.fn().mockResolvedValue({ rate: 48.5 });

    const { result } = renderHook(() => useAsyncResource(fetcher, []));

    expect(result.current.status).toBe('loading');
    expect(result.current.isInitialLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.data).toEqual({ rate: 48.5 });
    expect(result.current.error).toBeNull();
  });

  it('handles fetcher rejection', async () => {
    const errorObj = new Error('Network failure');
    const fetcher = jest.fn().mockRejectedValue(errorObj);

    const { result } = renderHook(() => useAsyncResource(fetcher, []));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.error).toBe(errorObj);
    expect(result.current.data).toBeNull();
  });

  it('preserves hasSettled flag during reload so isInitialLoading remains false', async () => {
    let callCount = 0;
    const fetcher = jest.fn().mockImplementation(async () => {
      callCount++;
      return `result-${callCount}`;
    });

    const { result } = renderHook(() => useAsyncResource(fetcher, []));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.data).toBe('result-1');
    expect(result.current.isInitialLoading).toBe(false);

    // Trigger reload
    act(() => {
      result.current.reload();
    });

    // During reload, status becomes loading, but isInitialLoading remains false because hasSettled is true
    expect(result.current.status).toBe('loading');
    expect(result.current.isInitialLoading).toBe(false);

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.data).toBe('result-2');
  });

  it('prevents out-of-order responses from overwriting latest request', async () => {
    let resolveFirst!: (val: string) => void;
    let resolveSecond!: (val: string) => void;

    const fetcher1 = () => new Promise<string>((res) => { resolveFirst = res; });
    const fetcher2 = () => new Promise<string>((res) => { resolveSecond = res; });

    let currentFetcher = fetcher1;

    const { result, rerender } = renderHook(
      ({ dep }) => useAsyncResource(() => currentFetcher(), [dep]),
      { initialProps: { dep: 1 } }
    );

    // Change dep to trigger 2nd request
    currentFetcher = fetcher2;
    rerender({ dep: 2 });

    // Resolve 2nd request first
    act(() => {
      resolveSecond('second-result');
    });

    await waitFor(() => {
      expect(result.current.data).toBe('second-result');
    });

    // Now resolve 1st request late (should be ignored)
    act(() => {
      resolveFirst('stale-first-result');
    });

    // Data must remain second-result
    expect(result.current.data).toBe('second-result');
  });
});
