import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ChakraRoot } from '../src/components/ChakraRoot';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ChakraRoot>{children}</ChakraRoot>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
