// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EfestoProductShell from './efesto-product-shell';

// Keyboard/focus contract for the shell navigation. On phones the sidebar is an off-canvas
// drawer moved with a CSS transform, so without `inert` its ~12 buttons stayed in the Tab order
// while invisible, Escape did nothing and focus never entered or left the drawer.
function stubViewport(mobile: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: mobile && query === '(max-width: 720px)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

const sidebar = () => screen.getByRole('complementary', { name: 'Navegación principal' });
// Home hides the topbar (CSS) and shows its own menu button; topbar button is used elsewhere.
const homeMenuButton = () => document.querySelector('.forge-menu-button') as HTMLButtonElement;
const topbarMenuButton = () => document.querySelector('.menu-button') as HTMLButtonElement;
const menuButton = homeMenuButton;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shell keyboard navigation', () => {
  it('keeps the closed mobile drawer out of the Tab order and exposes its state', () => {
    stubViewport(true);
    render(<EfestoProductShell />);
    expect(sidebar().hasAttribute('inert')).toBe(true);
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(menuButton().getAttribute('aria-controls')).toBe(sidebar().id);
  });

  it('moves focus into the opened drawer and Escape closes it back to the menu button', () => {
    stubViewport(true);
    const { container } = render(<EfestoProductShell />);
    fireEvent.click(menuButton());
    expect(container.querySelector('.efesto-product')?.classList.contains('nav-open')).toBe(true);
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.classList.contains('mobile-close')).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.efesto-product')?.classList.contains('nav-open')).toBe(false);
    expect(sidebar().hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(menuButton());
  });

  it('closing with the drawer button also returns focus to the menu button', () => {
    stubViewport(true);
    render(<EfestoProductShell />);
    fireEvent.click(menuButton());
    fireEvent.click(document.querySelector('.mobile-close') as HTMLButtonElement);
    expect(document.activeElement).toBe(menuButton());
  });

  it('choosing a destination from the drawer moves focus to the new view', () => {
    stubViewport(true);
    render(<EfestoProductShell />);
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole('button', { name: 'Evidencia' }));
    const main = screen.getByRole('main');
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('button', { name: 'Evidencia' }).getAttribute('aria-current')).toBe('page');

    // Off Home the topbar button opens the drawer; Escape must return focus to that opener.
    fireEvent.click(topbarMenuButton());
    expect(topbarMenuButton().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(topbarMenuButton());
  });

  it('leaves the desktop sidebar reachable and reports collapse state', () => {
    stubViewport(false);
    render(<EfestoProductShell />);
    expect(sidebar().hasAttribute('inert')).toBe(false);
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(menuButton());
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sidebar().hasAttribute('inert')).toBe(false);
  });
});
