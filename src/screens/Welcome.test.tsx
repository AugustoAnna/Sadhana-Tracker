import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Welcome } from '@/screens/Welcome';

vi.mock('@/components', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  PracticeIllustration: () => null,
}));

describe('Welcome', () => {
  it('has a single door: Get started leads to sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/welcome']}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/sign-in" element={<p>sign-in screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    await screen.findByText('sign-in screen');
  });
});
