import { describe, expect, it, jest } from '@jest/globals';

import { CATEGORIES, MEDITATIONS, NARRATORS, SOUNDSCAPES, audioFor, findMeditation } from '../../content/catalog';
import { clampPosition, formatClock } from '../time';

jest.mock('../../content/audio-files', () => {
  const catalog = jest.requireActual<typeof import('../../../content/catalog.json')>('../../../content/catalog.json');
  const ids = catalog.categories.flatMap((c) => c.meditations).map((m) => m.id);
  const sounds = Object.fromEntries(catalog.soundscapes.map((s, i) => [s.id, 100 + i]));
  return {
    NARRATORS: ['bella', 'george'],
    MEDITATION_AUDIO: {
      bella: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
      george: Object.fromEntries(ids.map((id, i) => [id, 200 + i])),
    },
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

  it('has 10 soundscapes with unique ids', () => {
    expect(SOUNDSCAPES).toHaveLength(10);
    expect(new Set(SOUNDSCAPES.map((s) => s.id)).size).toBe(10);
  });

  it('gives every meditation a unique id and its category', () => {
    expect(new Set(MEDITATIONS.map((m) => m.id)).size).toBe(15);
    expect(findMeditation('breath-3')).toMatchObject({ categoryId: 'breath', categoryTitle: 'Breathing', minutes: 3 });
  });
});

describe('narrators', () => {
  it('offers Bella and George, each with their own recording of every meditation', () => {
    expect(NARRATORS).toEqual(['bella', 'george']);
    expect(audioFor('meditation', 'sleep-3', 'bella')).not.toBe(audioFor('meditation', 'sleep-3', 'george'));
    expect(audioFor('soundscape', 'lullaby', 'george')).toBe(audioFor('soundscape', 'lullaby', 'bella'));
  });

  it('includes the new lullaby and bells soundscapes', () => {
    expect(SOUNDSCAPES.map((s) => s.id)).toEqual(expect.arrayContaining(['lullaby', 'bells']));
    expect(SOUNDSCAPES.map((s) => s.id)).not.toEqual(expect.arrayContaining(['stream']));
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
