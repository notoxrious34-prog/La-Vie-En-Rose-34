import { useEffect, useSyncExternalStore } from 'react';
import type { ToastItem, ToastKind } from '../components/ui/Toast';

type State = {
  items: ToastItem[];
};

type Listener = () => void;

const state: State = {
  items: [],
};

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state.items;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function pushToast(input: Omit<ToastItem, 'id'> & { id?: string }) {
  const id = input.id ?? uid();
  state.items = [...state.items, { ...input, id }];
  emit();
  return id;
}

export function closeToast(id: string) {
  state.items = state.items.filter((t) => t.id !== id);
  emit();
}

export function toast(kind: ToastKind, title: string, message?: string) {
  return pushToast({ kind, title, message });
}

export function useToasts() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    return () => {
      state.items = [];
      emit();
    };
  }, []);

  return { items, closeToast };
}
