// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SourceMark, sourceMark } from './source-mark';

afterEach(cleanup);

describe('local source identity', () => {
  it('uses the parsed hostname and only bundled assets', () => {
    expect(sourceMark('https://github.com/git-guides/?private=ignored')).toEqual({ asset: '/brand/sources/github.png', initials: 'GI' });
    expect(sourceMark('https://code.visualstudio.com/docs').asset).toBe('/brand/sources/vscode.png');
    expect(sourceMark('https://unlisted.example/page')).toEqual({ asset: undefined, initials: 'UN' });
  });
  it.each(['https://github.com.evil.example', 'https://evil.example/github.com', 'https://evil.example/?host=github.com', 'https://github.com@evil.example', 'javascript:github.com', 'not a URL', 'https://constructor', 'https://__proto__'])('cannot adopt another source brand from %s', (url) => {
    expect(sourceMark(url).asset).toBeUndefined();
  });
  it('falls back locally after asset failure and recovers when a different source is shown', () => {
    const view = render(<SourceMark url="https://github.com/git-guides" />);
    const image = view.container.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('/brand/sources/github.png');
    expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
    fireEvent.error(image);
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.textContent).toBe('GI');
    view.rerender(<SourceMark url="https://code.visualstudio.com/docs" />);
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/brand/sources/vscode.png');
    view.rerender(<SourceMark url="https://unknown.example" />);
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.container.textContent).toBe('UN');
  });
});
