// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KernelIdChip } from './kernel-id-chip';

describe('KernelIdChip', () => {
  const id = 'case:verified:b08de4bb68ab6276c752e96faf6a662a176810c200c1cdaede230e1803f2f36c';
  it('shows a compact chip, keeps the full id in the title and for screen readers, copies the full id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onOpen = vi.fn();
    const { container, getByRole } = render(<KernelIdChip id={id} onOpen={onOpen} />);
    const chip = container.querySelector('.kernel-id-chip') as HTMLElement;
    expect(chip.getAttribute('title')).toBe(id);
    expect(chip.querySelector('.kid-short')?.textContent).toBe('b08de4bb');
    expect(chip.textContent).toContain(id);
    fireEvent.click(container.querySelector('.kid-open') as HTMLElement);
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(getByRole('button', { name: `Copiar id completo ${id}` }));
    expect(writeText).toHaveBeenCalledWith(id);
  });
});
