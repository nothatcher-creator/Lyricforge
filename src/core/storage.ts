import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from './types';
import { readProject } from './validate';
import { createDemo } from './demo';
const KEY = 'lyricforge-projects-v1';
export function savedProjects(): Project[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') as unknown[]).flatMap((p) => {
      try {
        return [readProject(p)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
export function useProject() {
  const [project, setProject] = useState<Project>(() => savedProjects()[0] ?? createDemo());
  const undoStack = useRef<Project[]>([]);
  const redoStack = useRef<Project[]>([]);
  const [, revision] = useState(0);
  const update = useCallback(
    (change: Partial<Project> | ((p: Project) => Project)) =>
      setProject((p) => {
        undoStack.current = [...undoStack.current.slice(-49), p];
        redoStack.current = [];
        return {
          ...(typeof change === 'function' ? change(p) : { ...p, ...change }),
          updatedAt: Date.now(),
        };
      }),
    [],
  );
  const undo = useCallback(
    () =>
      setProject((p) => {
        const prev = undoStack.current.pop();
        if (!prev) return p;
        redoStack.current.push(p);
        revision((x) => x + 1);
        return prev;
      }),
    [],
  );
  const redo = useCallback(
    () =>
      setProject((p) => {
        const next = redoStack.current.pop();
        if (!next) return p;
        undoStack.current.push(p);
        revision((x) => x + 1);
        return next;
      }),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      const items = savedProjects().filter((p) => p.id !== project.id);
      try {
        localStorage.setItem(KEY, JSON.stringify([project, ...items].slice(0, 20)));
      } catch {
        try {
          localStorage.setItem(KEY, JSON.stringify([project]));
        } catch {
          console.warn('Browser storage is full. Download a project JSON to preserve your work.');
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [project]);
  return {
    project,
    update,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
