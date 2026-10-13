import catalog from '../../content/catalog.json';

import { MEDITATION_AUDIO, NARRATORS, SOUNDSCAPE_AUDIO, type Narrator } from './audio-files';

export { NARRATORS, type Narrator };

/** How each narrator is shown in the app. */
export const NARRATOR_INFO: Record<Narrator, { name: string; label: string }> = {
  bella: { name: 'Bella', label: 'Female' },
  george: { name: 'George', label: 'Male' },
};

export type Meditation = {
  id: string;
  title: string;
  minutes: number;
  description: string;
  categoryId: string;
  categoryTitle: string;
};

export type Category = {
  id: string;
  title: string;
  description: string;
  meditations: Meditation[];
};

export type Soundscape = {
  id: string;
  title: string;
  description: string;
};

export const CATEGORIES: Category[] = catalog.categories.map((category) => ({
  id: category.id,
  title: category.title,
  description: category.description,
  meditations: category.meditations.map((meditation) => ({
    ...meditation,
    categoryId: category.id,
    categoryTitle: category.title,
  })),
}));

export const MEDITATIONS: Meditation[] = CATEGORIES.flatMap((category) => category.meditations);

export const SOUNDSCAPES: Soundscape[] = catalog.soundscapes;

export function findMeditation(id: string): Meditation | undefined {
  return MEDITATIONS.find((meditation) => meditation.id === id);
}

export function findSoundscape(id: string): Soundscape | undefined {
  return SOUNDSCAPES.find((soundscape) => soundscape.id === id);
}

/** The bundled audio file for a meditation (in the chosen narrator's voice) or a soundscape. */
export function audioFor(kind: 'meditation' | 'soundscape', id: string, narrator: Narrator): number {
  const source = kind === 'meditation' ? MEDITATION_AUDIO[narrator][id] : SOUNDSCAPE_AUDIO[id];
  if (source === undefined) {
    throw new Error(`No bundled audio for ${kind} "${id}"`);
  }
  return source;
}
