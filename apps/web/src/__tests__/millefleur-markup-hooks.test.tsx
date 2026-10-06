import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '../components/AppShell.js';
import DetailSheet from '../components/DetailSheet.js';

vi.mock('../lib/auth-context.js', () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));
vi.mock('../lib/command-insert-context.js', () => ({ useCommandInsert: () => ({ insertCommand: vi.fn() }) }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('header nav marks the current place', () => {
  it('sets aria-current on the link for the current route only', () => {
    render(
      <MemoryRouter initialEntries={['/room/r1/workshop']}>
        <AppShell roomId="r1" roomName="Room">x</AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toBe('Workshop');
  });

  it('does not keep The Ring current on a sub-route', () => {
    render(
      <MemoryRouter initialEntries={['/room/r1/chat']}>
        <AppShell roomId="r1" roomName="Room">x</AppShell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Chat');
  });
});

describe('DetailSheet close box', () => {
  const sheet = () => (
    <DetailSheet title="Hit" titleId="t" closeTitle="Close the card details" onClose={() => undefined}>
      <p>body</p>
    </DetailSheet>
  );

  it('is not rendered in the dark themes', () => {
    render(sheet());
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('is rendered, and closes, under Millefleur', () => {
    localStorage.setItem('deck-monsters-theme', 'millefleur');
    const onClose = vi.fn();
    render(
      <DetailSheet title="Hit" titleId="t" closeTitle="Close the card details" onClose={onClose}>
        <p>body</p>
      </DetailSheet>,
    );
    const box = screen.getByRole('button', { name: 'Close the card details' });
    act(() => box.click());
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
