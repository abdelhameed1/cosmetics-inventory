import React from 'react';
import { render, screen } from './test-utils';
import { FormField } from '../src/components/ui/FormField';
import { Input } from '@chakra-ui/react';

describe('FormField', () => {
  it('renders label and input child', () => {
    render(
      <FormField label="Product Name">
        <Input placeholder="Enter product name" />
      </FormField>
    );
    expect(screen.getByText('Product Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter product name')).toBeInTheDocument();
  });

  it('indicates required field when required prop is true', () => {
    render(
      <FormField label="Brand" required>
        <Input placeholder="Select brand" />
      </FormField>
    );
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
