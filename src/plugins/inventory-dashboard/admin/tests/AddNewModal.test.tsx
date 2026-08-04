import React from 'react';
import { render, screen, fireEvent, within } from './test-utils';
import { AddNewModal } from '../src/components/AddNewModal';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../src/components/InlineResourceForm', () => ({
  InlineResourceForm: ({ onDone }: { onDone: (created?: any) => void }) => (
    <button onClick={() => onDone({ documentId: 'br-1' })}>Mock InlineResourceForm</button>
  ),
}));
jest.mock('../src/components/ProductVariantsForm', () => ({
  __esModule: true,
  default: () => <div>Mock ProductVariantsForm</div>,
}));
jest.mock('../src/pages/StockPurchase', () => ({
  __esModule: true,
  default: () => <div>Mock StockPurchase</div>,
}));
jest.mock('../src/pages/OrderForm', () => ({
  __esModule: true,
  default: () => <div>Mock OrderForm</div>,
}));

describe('AddNewModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when isOpen is false', () => {
    render(<AddNewModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Add new')).not.toBeInTheDocument();
  });

  it('renders the picker grid with group headings and a Guided badge only on wizard items', () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    expect(screen.getByText('Add new')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();

    const productCard = screen.getByText('Product').closest('button') as HTMLElement;
    expect(within(productCard).getByText('Guided')).toBeInTheDocument();

    const brandCard = screen.getByText('Brand').closest('button') as HTMLElement;
    expect(within(brandCard).queryByText('Guided')).not.toBeInTheDocument();
  });

  it('opens a simple resource form with a Back button and "New {label}" title', async () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Brand'));

    expect(await screen.findByText('New Brand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    expect(await screen.findByText('Mock InlineResourceForm')).toBeInTheDocument();
  });

  it('Back returns to the picker grid', async () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Brand'));
    await screen.findByText('New Brand');

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Add new')).toBeInTheDocument();
  });

  it('navigates to the resource list and closes after a simple create completes', async () => {
    const onClose = jest.fn();
    render(<AddNewModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Brand'));
    const createBtn = await screen.findByRole('button', { name: /mock inlineresourceform/i });
    fireEvent.click(createBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/plugins/inventory-catalog/brands');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the guided Product wizard for the Product item', async () => {
    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Product'));
    expect(await screen.findByText('Mock ProductVariantsForm')).toBeInTheDocument();
  });

  it('opens the guided Stock Purchase and Order wizards', async () => {
    const { unmount } = render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Stock Purchase'));
    expect(await screen.findByText('Mock StockPurchase')).toBeInTheDocument();
    unmount();

    render(<AddNewModal isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Order'));
    expect(await screen.findByText('Mock OrderForm')).toBeInTheDocument();
  });
});
