import { describe, expect, it, jest } from '@jest/globals';

import { CATEGORIES, MEDITATIONS, SOUNDSCAPES, audioFor, findMeditation } from '../../content/catalog';
import { clampPosition, formatClock } from '../time';

jest.mock('../../content/audio-files', () => {
  const catalog = jest.requireActual<typeof import('../../../content/catalog.json')>('../../../content/catalog.json');
  const ids = catalog.categories.flatMap((c) => c.meditations).map((m) => m.id);
  const sounds = Object.fromEntries(catalog.soundscapes.map((s, i) => [s.id, 100 + i]));
  return {
    MEDITATION_AUDIO: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
    SOUNDSCAPE_AUDIO: sounds,
  };
});

describe('catalog', () => {
  it('has 5 categories with a 3, 5 and 10 minute meditation each', () => {
    expect(CATEGORIES).toHaveLength(5);
    for (const category of CATEGORIES) {
      expect(category.meditations.map((m) => m.minutes)).toEqual([3, 5, 10]);
    }
    expect(MEDITATIONS).toHaveLength(15);
  });

  it('has 12 soundscapes with unique ids', () => {
    expect(SOUNDSCAPES).toHaveLength(12);
    expect(new Set(SOUNDSCAPES.map((s) => s.id)).size).toBe(12);
  });

  it('gives every meditation a unique id and its category', () => {
    expect(new Set(MEDITATIONS.map((m) => m.id)).size).toBe(15);
    expect(findMeditation('breath-3')).toMatchObject({ categoryId: 'breath', categoryTitle: 'Breathing', minutes: 3 });
  });
});

describe('soundscapes', () => {
  it('has bundled audio for every meditation and soundscape', () => {
    for (const meditation of MEDITATIONS) expect(audioFor('meditation', meditation.id)).toBeGreaterThan(0);
    for (const soundscape of SOUNDSCAPES) expect(audioFor('soundscape', soundscape.id)).toBeGreaterThan(0);
  });

  it('includes the current soundscapes and none of the retired ones', () => {
    const ids = SOUNDSCAPES.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['lullaby', 'bells', 'chimes', 'heartbeat', 'guitar', 'car', 'shush']));
    for (const retired of ['stream', 'drone', 'thunderstorm', 'wind', 'night']) {
      expect(ids).not.toContain(retired);
    }
  });
});

describe('time helpers', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(185.9)).toBe('3:05');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(-4)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });

  it('clamps positions to the track', () => {
    expect(clampPosition(-3, 180)).toBe(0);
    expect(clampPosition(90, 180)).toBe(90);
    expect(clampPosition(500, 180)).toBe(180);
  });
});
