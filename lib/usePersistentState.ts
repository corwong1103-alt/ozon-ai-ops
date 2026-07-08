"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";

type PersistentStateOptions = {
  ttlMs?: number;
  maxLength?: number;
  userId?: string;
};

type StoredValue<T> = {
  v: T;
  t: number;
};

function currentUserId(userId?: string) {
  if (userId) return userId;
  if (typeof window === "undefined") return "anonymous";
  try {
    return sessionStorage.getItem("ozon_user_id") || "anonymous";
  } catch {
    return "anonymous";
  }
}

function compactValue<T>(value: T, maxLength?: number): T {
  if (!maxLength || !Array.isArray(value) || value.length <= maxLength) return value;
  return value.slice(0, maxLength) as T;
}

function readStoredValue<T>(storageKey: string, initialValue: T, ttlMs?: number) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return initialValue;
    const parsed = JSON.parse(raw) as StoredValue<T>;
    if (!parsed || typeof parsed !== "object" || !("v" in parsed) || !("t" in parsed)) return initialValue;
    if (ttlMs && Date.now() - Number(parsed.t) > ttlMs) {
      sessionStorage.removeItem(storageKey);
      return initialValue;
    }
    return parsed.v;
  } catch {
    return initialValue;
  }
}

function writeStoredValue<T>(storageKey: string, value: T, maxLength?: number) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ v: value, t: Date.now() }));
  } catch (error) {
    if (error instanceof DOMException && error.name !== "QuotaExceededError") return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ v: compactValue(value, maxLength), t: Date.now() }));
    } catch {
      // Persistence is best-effort; UI state remains in memory.
    }
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options: PersistentStateOptions = {}
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue);
  const mounted = useRef(false);
  const storageKey = useMemo(() => `${key}:${currentUserId(options.userId)}`, [key, options.userId]);

  useEffect(() => {
    setValue(readStoredValue(storageKey, initialValue, options.ttlMs));
    mounted.current = true;
  }, [storageKey, options.ttlMs]);

  useEffect(() => {
    if (!mounted.current) return;
    writeStoredValue(storageKey, compactValue(value, options.maxLength), options.maxLength);
  }, [storageKey, value, options.maxLength]);

  return [value, setValue];
}
