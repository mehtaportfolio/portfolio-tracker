import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Synchronize a form-like state object with localStorage so drafts survive
 * temporary navigation or minimizing the app. Intended for small/medium
 * sized payloads.
 *
 * @template T
 * @param {string} storageKey Unique key per form/modal.
 * @param {T} initialState Default values when nothing is stored yet.
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>, () => void]}
 */
const usePersistentDraft = (storageKey, initialState) => {
  const initialSnapshot = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return initialState;
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : initialState;
    } catch (error) {
      console.warn(`usePersistentDraft: failed to parse ${storageKey}`, error);
      return initialState;
    }
  }, [initialState, storageKey]);

  const [draft, setDraft] = useState(initialSnapshot);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (error) {
      console.warn(`usePersistentDraft: failed to persist ${storageKey}`, error);
    }
  }, [draft, storageKey]);

  const resetDraft = () => {
    setDraft(initialState);
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`usePersistentDraft: failed to clear ${storageKey}`, error);
    }
  };

  return [draft, setDraft, resetDraft];
};

export default usePersistentDraft;