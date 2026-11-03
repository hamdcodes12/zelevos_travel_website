// ==============================================================================
// THINKATIC GLOBAL BPO DELIVERY PLATFORM — 5-SECOND AUTOSAVE HOOK
// Robust enterprise debounced autosave with request sequencing, concurrency locking,
// flush-on-navigation, and authoritative state synchronization.
// ==============================================================================

import { useState, useEffect, useRef, useCallback } from "react";

export type AutosaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export interface AutosaveResult<TResult = any> {
  success: boolean;
  data?: TResult;
  error?: string;
}

export interface UseAutosaveFormOptions<TData, TResult = any> {
  /**
   * Async save handler that persists to Supabase/PostgreSQL via backend API.
   */
  onSave: (data: TData) => Promise<AutosaveResult<TResult>>;

  /**
   * Debounce delay in milliseconds after user stops editing.
   * Default: 5000ms (5 seconds).
   */
  debounceMs?: number;

  /**
   * Callback invoked when authoritative backend save succeeds.
   */
  onSuccess?: (result: TResult) => void;

  /**
   * Callback invoked when backend save fails.
   */
  onError?: (errorMessage: string) => void;

  /**
   * Whether the form is currently in its initial loading/populating phase.
   * When true, edits will NOT trigger autosave.
   */
  isInitialLoading?: boolean;

  /**
   * Optional custom comparison function to check if data actually changed.
   * Defaults to deep JSON string comparison.
   */
  isEqual?: (a: TData, b: TData) => boolean;
}

export interface UseAutosaveFormReturn<TData> {
  status: AutosaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
  retry: () => Promise<boolean>;
  flush: () => Promise<boolean>;
  resetSavedState: (newData?: TData) => void;
  isSaving: boolean;
  isUnsaved: boolean;
}

export function useAutosaveForm<TData, TResult = any>(
  data: TData,
  options: UseAutosaveFormOptions<TData, TResult>
): UseAutosaveFormReturn<TData> {
  const {
    onSave,
    debounceMs = 5000,
    onSuccess,
    onError,
    isInitialLoading = false,
    isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  } = options;

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // References for concurrency, sequence, and debounce management
  const currentDataRef = useRef<TData>(data);
  currentDataRef.current = data;

  const lastSavedDataRef = useRef<TData | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const requestSeqRef = useRef<number>(0);
  const latestCompletedSeqRef = useRef<number>(0);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Initial mount guard
  const isMountedRef = useRef<boolean>(true);
  const isInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Initialize baseline once loading completes
  useEffect(() => {
    if (!isInitialLoading && !isInitializedRef.current) {
      lastSavedDataRef.current = JSON.parse(JSON.stringify(data));
      isInitializedRef.current = true;
    }
  }, [isInitialLoading, data]);

  // Execute internal save with concurrency lock & sequence protection
  const executeSave = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;

    // Concurrency lock: prevent duplicate concurrent requests
    if (isSavingRef.current) {
      return false;
    }

    // Check if data actually differs from last saved state
    if (lastSavedDataRef.current && isEqual(currentDataRef.current, lastSavedDataRef.current)) {
      if (status === "unsaved") setStatus("saved");
      return true;
    }

    isSavingRef.current = true;
    setStatus("saving");
    setError(null);

    // Snapshot current state for this save request
    const dataToSave = JSON.parse(JSON.stringify(currentDataRef.current)) as TData;
    const currentSeq = ++requestSeqRef.current;

    try {
      const res = await onSaveRef.current(dataToSave);

      if (!isMountedRef.current) return false;

      // Ensure out-of-order responses do not overwrite newer state
      if (currentSeq >= latestCompletedSeqRef.current) {
        latestCompletedSeqRef.current = currentSeq;

        if (res.success) {
          lastSavedDataRef.current = dataToSave;
          setStatus("saved");
          setLastSavedAt(new Date());
          setError(null);
          if (onSuccessRef.current && res.data) {
            onSuccessRef.current(res.data);
          }
          return true;
        } else {
          const errMsg = res.error || "Unable to save — Retry";
          setStatus("error");
          setError(errMsg);
          if (onErrorRef.current) {
            onErrorRef.current(errMsg);
          }
          return false;
        }
      }
      return false;
    } catch (err: any) {
      if (!isMountedRef.current) return false;

      if (currentSeq >= latestCompletedSeqRef.current) {
        latestCompletedSeqRef.current = currentSeq;
        const errMsg = err?.message || "Unable to save — Retry";
        setStatus("error");
        setError(errMsg);
        if (onErrorRef.current) {
          onErrorRef.current(errMsg);
        }
      }
      return false;
    } finally {
      isSavingRef.current = false;

      // If user typed/edited during save, trigger new 5-second debounce with latest batched data
      if (isMountedRef.current && lastSavedDataRef.current && !isEqual(currentDataRef.current, lastSavedDataRef.current)) {
        setStatus("unsaved");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void executeSave();
        }, debounceMs);
      }
    }
  }, [debounceMs, isEqual, status]);

  // Debounce Effect: triggered whenever `data` changes
  useEffect(() => {
    if (isInitialLoading || !isInitializedRef.current) {
      return;
    }

    // Compare current data with last saved baseline
    if (lastSavedDataRef.current && isEqual(data, lastSavedDataRef.current)) {
      // Data matches last saved state: cancel pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (status === "unsaved") {
        setStatus("saved");
      }
      return;
    }

    // User made a change:
    // 1. Mark status as "unsaved"
    setStatus("unsaved");

    // 2. Cancel previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 3. Start fresh 5-second debounce timer
    timerRef.current = setTimeout(() => {
      void executeSave();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [data, isInitialLoading, debounceMs, isEqual, executeSave, status]);

  // Manual immediate flush (for Save Draft or step navigation)
  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return await executeSave();
  }, [executeSave]);

  // Manual retry trigger (when in error state)
  const retry = useCallback(async (): Promise<boolean> => {
    return await flush();
  }, [flush]);

  // Reset baseline (e.g. after initial fetch or authoritative sync)
  const resetSavedState = useCallback((newData?: TData) => {
    const target = newData !== undefined ? newData : currentDataRef.current;
    lastSavedDataRef.current = JSON.parse(JSON.stringify(target));
    setStatus("saved");
    setLastSavedAt(new Date());
    setError(null);
  }, []);

  return {
    status,
    error,
    lastSavedAt,
    retry,
    flush,
    resetSavedState,
    isSaving: status === "saving",
    isUnsaved: status === "unsaved",
  };
}
