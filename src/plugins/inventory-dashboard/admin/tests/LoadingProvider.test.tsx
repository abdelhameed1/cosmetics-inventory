import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { LoadingProvider, useIsLoading, useLoadingTracker } from '../src/loading/LoadingProvider';

describe('LoadingProvider & Hooks', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LoadingProvider>{children}</LoadingProvider>
  );

  it('tracks request count and reflects in useIsLoading', () => {
    const { result } = renderHook(
      () => ({
        isLoading: useIsLoading(),
        tracker: useLoadingTracker(),
      }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.tracker.begin();
    });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.tracker.begin();
    });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.tracker.end();
    });
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.tracker.end();
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('never lets count drop below 0 when end() is called excessively', () => {
    const { result } = renderHook(
      () => ({
        isLoading: useIsLoading(),
        tracker: useLoadingTracker(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.tracker.end();
      result.current.tracker.end();
    });

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.tracker.begin();
    });
    expect(result.current.isLoading).toBe(true);
  });
});
