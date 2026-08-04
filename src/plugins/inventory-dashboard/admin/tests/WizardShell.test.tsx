import React from 'react';
import { render, screen, fireEvent } from './test-utils';
import { WizardShell, type WizardStep } from '../src/components/WizardShell';

function makeSteps(overrides?: Partial<Record<number, boolean>>): WizardStep[] {
  return [
    { label: 'Step One', content: <div>Content One</div>, isValid: () => overrides?.[0] ?? true },
    { label: 'Step Two', content: <div>Content Two</div>, isValid: () => overrides?.[1] ?? true },
  ];
}

describe('WizardShell', () => {
  it('renders first step content, no Back button, and the step indicator text', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    expect(screen.getByText('Content One')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
    expect(screen.getByText('Step One — step 1 of 2')).toBeInTheDocument();
  });

  it('disables Next when the current step is invalid', () => {
    render(<WizardShell steps={makeSteps({ 0: false })} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('advances to the next step and back again', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Content Two')).toBeInTheDocument();
    expect(screen.getByText('Step Two — step 2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });

  it('shows the submit button with submitLabel on the last step and calls onSubmit', () => {
    const onSubmit = jest.fn();
    render(<WizardShell steps={makeSteps()} onSubmit={onSubmit} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders submitError only on the last step', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError="Boom" />);
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });

  it('clicking an earlier step indicator jumps back to it', () => {
    render(<WizardShell steps={makeSteps()} onSubmit={jest.fn()} submitLabel="Finish" isSubmitting={false} submitError={null} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Content Two')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Step One'));
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });
});
