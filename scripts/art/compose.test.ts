// scripts/art/compose.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { composeSvg, hexesOf, innerSvg, openMojiUrl, parseSources } from './compose';

const apple = '<svg id="emoji" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">\n  <g id="color"><path fill="#ea5a47" d="M1 1"/></g>\n  <g id="line"><path d="M2 2"/></g>\n</svg>\n';
const basket = '<svg id="emoji" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><g id="line"><path d="M3 3"/></g></svg>';

describe('innerSvg', () => {
  it('keeps the drawing and drops the wrapper and the ids', () => {
    expect(innerSvg(apple)).toBe('<g><path fill="#ea5a47" d="M1 1"/></g>\n  <g><path d="M2 2"/></g>');
  });
  it('rejects a file that is not an SVG', () => {
    expect(() => innerSvg('<html></html>')).toThrow('not an SVG file');
    expect(() => innerSvg('<!-- <svg> --><svg viewBox="0 0 72 72"></svg>')).toThrow('not an SVG file');
  });
  it('rejects a drawing that is not 72 × 72, or that refers to its own ids', () => {
    expect(() => innerSvg('<svg viewBox="0 0 36 36"><path d="M1 1"/></svg>')).toThrow('viewBox "0 0 72 72"');
    expect(() => innerSvg('<svg viewBox="0 0 72 72"><linearGradient id="g"/><path fill="url(#g)"/></svg>')).toThrow('refers to its own ids');
    expect(() => innerSvg('<svg viewBox="0 0 72 72"><use href="#a"/></svg>')).toThrow('refers to its own ids');
    expect(() => innerSvg(`<svg viewBox="0 0 72 72"><path fill="url('#g')"/></svg>`)).toThrow('refers to its own ids');
  });
});

describe('composeSvg', () => {
  it('draws the shapes, then each picture scaled into its box, later layers on top', () => {
    const pictures = new Map([['1F34E', apple], ['1F9FA', basket]]);
    const svg = composeSvg({ viewBox: '0 0 160 90', shapes: ['<rect width="160" height="90" fill="#def"/>'], layers: [
      { hex: '1F34E', x: 10, y: 4, size: 30 },
      { hex: '1F9FA', x: 0, y: 12, size: 60, flip: true },
    ] }, pictures);
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#def"/>'
      + '<svg x="10" y="4" width="30" height="30" viewBox="0 0 72 72"><g><path fill="#ea5a47" d="M1 1"/></g>\n  <g><path d="M2 2"/></g></svg>'
      + '<svg x="0" y="12" width="60" height="60" viewBox="0 0 72 72"><g transform="matrix(-1 0 0 1 72 0)"><g><path d="M3 3"/></g></g></svg></svg>\n',
    );
    expect(svg).not.toContain('id=');
  });
  it('draws in a 72 × 72 box unless the composition says otherwise', () => {
    expect(composeSvg({ layers: [{ hex: '1F34E', x: 0, y: 0, size: 72 }] }, new Map([['1F34E', apple]]))).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 72 72">/);
  });
  it('names a picture it was not given', () => {
    expect(() => composeSvg({ layers: [{ hex: '1F600', x: 0, y: 0, size: 72 }] }, new Map())).toThrow('no picture for 1F600');
  });
});

describe('parseSources', () => {
  it('accepts art/openmoji.json, and names an entry with a typo or a missing number', () => {
    const real = parseSources(JSON.parse(readFileSync(new URL('../../art/openmoji.json', import.meta.url), 'utf8')));
    expect(Object.keys(real).length).toBeGreaterThan(100);
    expect(() => parseSources({ 'bins/x.svg': { layer: [{ hex: '1F9FA', x: 0, y: 0, size: 72 }] } })).toThrow('bins/x.svg');
    expect(() => parseSources({ 'bins/x.svg': { layers: [{ hex: '1F9FA', x: 0, y: 0 }] } })).toThrow('size');
    expect(() => parseSources({ 'apple.svg': '1F34E' })).toThrow('not a picture path');
  });
});

describe('sources', () => {
  it('lists the codes a source needs, and pins the OpenMoji release', () => {
    expect(hexesOf('1F34E')).toEqual(['1F34E']);
    expect(hexesOf({ layers: [{ hex: 'A', x: 0, y: 0, size: 1 }, { hex: 'B', x: 0, y: 0, size: 1 }] })).toEqual(['A', 'B']);
    expect(openMojiUrl('1F34E')).toBe('https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/1F34E.svg');
  });
});
