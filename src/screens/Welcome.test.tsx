import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Welcome } from '@/screens/Welcome';

vi.mock('@/components', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  PracticeIllustration: () => null,
}));

describe('Welcome', () => {
  it('routes Get started to sign-up', async () => {
    render(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/sign-up" element={<p>sign-up screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    await screen.findByText('sign-up screen');
  });

  it('offers a sign-in link below Get started', async () => {
    render(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/sign-in" element={<p>sign-in screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    await screen.findByText('sign-in screen');
  });
});
