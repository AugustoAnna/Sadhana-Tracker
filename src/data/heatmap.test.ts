import { describe, it, expect } from 'vitest';
import {
  heatmapBand,
  heatmapColor,
  HEATMAP_EMPTY,
  HEATMAP_EMPTY_DARK,
  HEATMAP_SHADES,
  HEATMAP_SHADES_DARK,
} from './heatmap';

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

describe('dark theme ramp', () => {
  it('runs the other way: more practice is brighter', () => {
    expect(heatmapColor(1000, 'dark')).toBe('#C2EBDC');
    expect(heatmapColor(1, 'dark')).toBe(HEATMAP_SHADES_DARK[0]);
  });

  it('uses the dark empty colour when nothing was practised', () => {
    expect(heatmapColor(0, 'dark')).toBe(HEATMAP_EMPTY_DARK);
    expect(heatmapColor(0)).toBe(HEATMAP_EMPTY);
  });
});
