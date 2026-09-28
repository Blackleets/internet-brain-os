// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsView } from './efesto-product-views';

afterEach(cleanup);

const noop = () => {};

describe('SettingsView Replay Lab link follows the connected Kernel', () => {
  it('points at the connected Kernel origin, not a hardcoded port', () => {
    render(<SettingsView connected connecting={false} rememberSession kernelBaseUrl="http://127.0.0.1:4310" onConnect={noop} onDisconnect={noop} onRefresh={noop} />);
    expect(screen.getByRole('link', { name: /Abrir Replay Lab/ }).getAttribute('href')).toBe('http://127.0.0.1:4310/replay-lab');
  });

  it('falls back to the default local Kernel when not connected', () => {
    render(<SettingsView connected={false} connecting={false} rememberSession onConnect={noop} onDisconnect={noop} onRefresh={noop} />);
    expect(screen.getByRole('link', { name: /Abrir Replay Lab/ }).getAttribute('href')).toBe('http://127.0.0.1:4000/replay-lab');
  });

  it('never points the link off-loopback even if handed a foreign URL', () => {
    render(<SettingsView connected connecting={false} rememberSession kernelBaseUrl="https://attacker.example" onConnect={noop} onDisconnect={noop} onRefresh={noop} />);
    expect(screen.getByRole('link', { name: /Abrir Replay Lab/ }).getAttribute('href')).toBe('http://127.0.0.1:4000/replay-lab');
  });

  it('shell passes the live connection baseUrl to SettingsView', () => {
    const shell = readFileSync(join(__dirname, 'efesto-product-shell.tsx'), 'utf8');
    expect(shell).toContain('kernelBaseUrl={connection?.baseUrl}');
  });
});
