import { describe, it, expect } from 'vitest';
import { heatmapBand, heatmapColor, HEATMAP_SHADES } from './heatmap';

describe('heatmapBand', () => {
  it('returns -1 for zero or negative minutes', () => {
    expect(heatmapBand(0)).toBe(-1);
    expect(heatmapBand(-1)).toBe(-1);
  });

  it('maps band boundaries per spec', () => {
    expect(heatmapBand(1)).toBe(0);
    expect(heatmapBand(5)).toBe(0);
    expect(heatmapBand(6)).toBe(1);
    expect(heatmapBand(20)).toBe(3);
    expect(heatmapBand(21)).toBe(4);
    expect(heatmapBand(239)).toBe(10);
    expect(heatmapBand(240)).toBe(11);
    expect(heatmapBand(500)).toBe(11);
  });

  it('uses darkest shade at 240+', () => {
    expect(heatmapColor(240)).toBe(HEATMAP_SHADES[11]);
    expect(heatmapColor(1000)).toBe('#044034');
  });
});
