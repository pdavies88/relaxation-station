import Storage from 'expo-sqlite/kv-store';

import { NARRATORS, type Narrator } from '@/content/catalog';

// The narrator choice is stored on this device only.
const KEY = 'narrator.v1';

export function loadNarrator(): Narrator {
  try {
    const value = Storage.getItemSync(KEY);
    return NARRATORS.includes(value as Narrator) ? (value as Narrator) : 'bella';
  } catch {
    return 'bella';
  }
}

export function saveNarrator(narrator: Narrator): void {
  void Storage.setItemAsync(KEY, narrator).catch(() => undefined);
}
