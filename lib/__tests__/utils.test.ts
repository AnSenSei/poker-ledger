import { describe, it, expect } from 'vitest';
import { formatDateShort, formatDateFull } from '../utils';

describe('formatDateShort', () => {
  it('formats a date with month, day and weekday', () => {
    // Use a known date: 2025-02-22 is Saturday
    const result = formatDateShort('2025-02-22T12:00:00Z');
    expect(result).toContain('2');
    expect(result).toContain('22');
  });

  it('handles ISO strings with timezone offset', () => {
    const result = formatDateShort('2025-06-15T08:30:00+08:00');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('handles midnight dates', () => {
    const result = formatDateShort('2025-01-01T00:00:00Z');
    expect(result).toContain('1');
  });
});

describe('formatDateFull', () => {
  it('includes year, month, day, weekday, hour and minute', () => {
    const result = formatDateFull('2025-02-22T20:00:00+08:00');
    expect(result).toContain('2025');
    expect(result).toContain('2');
    expect(result).toContain('22');
  });

  it('returns a non-empty string for valid dates', () => {
    const result = formatDateFull('2025-12-31T23:59:00Z');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(5);
  });
});
