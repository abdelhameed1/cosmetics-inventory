import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import Overview from '../src/pages/Overview';
import { useOverview } from '../src/hooks/useOverview';
import { useSettings } from '../src/hooks/useSettings';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../src/hooks/useOverview');
jest.mock('../src/hooks/useSettings');

describe('Overview Page Component', () => {
  const mockSave = jest.fn();
  const mockReload = jest.fn();

  const sampleOverviewData = {
    totalStockUnits: 150,
    stockValueUsd: 3000.5,
    stockValueEgp: 150025.0,
    exchangeRate: 50.0,
    outOfStock: [
      { variantId: 'v1', label: 'Shade 100', threshold: 5 },
    ],
    lowStock: [
      { variantId: 'v2', label: 'Shade 200', quantity: 2, threshold: 10 },
    ],
    expired: [],
    expiringSoon: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSettings as jest.Mock).mockReturnValue({
      exchangeRate: 50.0,
      exchangeRateUpdatedAt: '2026-08-04T00:00:00.000Z',
      save: mockSave,
    });
  });

  it('renders LoadingState when isInitialLoading is true', () => {
    (useOverview as jest.Mock).mockReturnValue({
      data: null,
      error: null,
      isInitialLoading: true,
      reload: mockReload,
    });

    render(<Overview />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders error message when initial load fails', () => {
    (useOverview as jest.Mock).mockReturnValue({
      data: null,
      error: new Error('Failed to load overview'),
      isInitialLoading: false,
      reload: mockReload,
    });

    render(<Overview />);
    expect(screen.getByText(/could not load overview data/i)).toBeInTheDocument();
  });

  it('renders stats, exchange rate input, and signal lists when loaded', () => {
    (useOverview as jest.Mock).mockReturnValue({
      data: sampleOverviewData,
      error: null,
      isInitialLoading: false,
      reload: mockReload,
    });

    render(<Overview />);

    // Header
    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument();

    // Stats
    expect(screen.getByText('Total stock units')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('$3000.50')).toBeInTheDocument();
    expect(screen.getByText('E£150025.00')).toBeInTheDocument();

    // Signal lists
    expect(screen.getByText('Shade 100')).toBeInTheDocument();
    expect(screen.getByText('Shade 200')).toBeInTheDocument();
  });

  it('triggers save rate on button click', async () => {
    (useOverview as jest.Mock).mockReturnValue({
      data: sampleOverviewData,
      error: null,
      isInitialLoading: false,
      reload: mockReload,
    });
    mockSave.mockResolvedValueOnce({ exchangeRate: 55.0, exchangeRateUpdatedAt: 'now' });

    render(<Overview />);

    const saveBtn = screen.getByRole('button', { name: /save rate/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(50.0);
    });
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
