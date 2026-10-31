import { describe, expect, it } from 'vitest';
import { chooseSmaller, fitImage, isCompressible } from './media-upload';

describe('upload rules', () => {
  it('limits the longest side to 1600px', () => {
    expect(fitImage(3200, 2400)).toEqual({ width: 1600, height: 1200 });
    expect(fitImage(1200, 2400)).toEqual({ width: 800, height: 1600 });
  });
  it('does not enlarge a small image', () => {
    expect(fitImage(400, 200)).toEqual({ width: 400, height: 200 });
  });
  it('uses a compressed file only if smaller', () => {
    const original = new File(['12345'], 'a.png', { type: 'image/png' });
    const smaller = new File(['123'], 'a.png', { type: 'image/png' });
    expect(chooseSmaller(original, smaller)).toBe(smaller);
    expect(chooseSmaller(original, original)).toBe(original);
    expect(chooseSmaller(original, new File(['123456'], 'a.png'))).toBe(original);
  });
  it('leaves animated GIF intact', () => {
    expect(isCompressible('image/gif')).toBe(false);
    expect(isCompressible('image/png')).toBe(true);
  });
});