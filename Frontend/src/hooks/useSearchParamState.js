import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// A piece of view state (active tab, filter, sort) backed by one URL search
// param, so it survives Back/Forward and is shareable. Absent param ⇒
// `defaultValue`; setting back to the default (or "" / null) removes the param
// to keep URLs clean.
//
// Writes default to { replace: true }: a tab switch mutates the current history
// entry in place, so one Back press from a pushed detail page returns to the
// last tab state with no phantom entries to click through.
export function useSearchParamState(key, defaultValue = null, { replace = true } = {}) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next == null || next === "" || next === defaultValue) p.delete(key);
          else p.set(key, String(next));
          return p;
        },
        { replace },
      );
    },
    [key, defaultValue, replace, setParams],
  );

  return [value, setValue];
}
