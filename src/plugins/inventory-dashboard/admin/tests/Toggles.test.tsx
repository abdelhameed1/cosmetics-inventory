import React from 'react';
import { render, screen, fireEvent } from './test-utils';
import { LanguageToggle } from '../src/components/LanguageToggle';
import { ColorModeToggle } from '../src/components/ColorModeToggle';

describe('Preference Toggles', () => {
  describe('LanguageToggle', () => {
    it('switches between English and Arabic when clicked', () => {
      render(<LanguageToggle />);

      // Initially in 'en', shows target language 'العربية'
      const toggleBtn = screen.getByRole('button');
      expect(screen.getByText('العربية')).toBeInTheDocument();

      fireEvent.click(toggleBtn);
      expect(screen.getByText('English')).toBeInTheDocument();

      fireEvent.click(toggleBtn);
      expect(screen.getByText('العربية')).toBeInTheDocument();
    });
  });

  describe('ColorModeToggle', () => {
    it('renders color mode toggle button', () => {
      render(<ColorModeToggle />);

      const toggleBtn = screen.getByRole('button');
      expect(toggleBtn).toBeInTheDocument();
      // Should display Dark mode or Light mode text
      expect(
        screen.getByText(/dark mode|light mode/i)
      ).toBeInTheDocument();
    });
  });
});
