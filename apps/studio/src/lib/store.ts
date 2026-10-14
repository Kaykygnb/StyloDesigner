// Um estado reativo mínimo (sem biblioteca): guarda o estado, avisa quem assina e entrega um hook para o React.
import { useSyncExternalStore } from 'react';

export interface Store<S> {
  get: () => S;
  set: (patch: Partial<S> | ((s: S) => Partial<S>)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** Lê um pedaço do estado. O seletor precisa devolver o MESMO valor enquanto nada mudou (não crie objetos novos nele). */
export function useStore<S extends object, T>(store: Store<S>, selector: (s: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
