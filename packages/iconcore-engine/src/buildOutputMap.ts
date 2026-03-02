import type { GenerationTask, OutputEntry } from './types';

export const buildOutputMap = <T>(tasks: Array<GenerationTask<T>>): OutputEntry[] => {
  const dedupe = new Map<string, OutputEntry>();

  for (const task of tasks) {
    const directory = task.name.includes('/') ? task.name.slice(0, task.name.lastIndexOf('/')) : '.';
    dedupe.set(task.name, {
      path: task.name,
      directory,
      variant: task.variant,
      type: task.type
    });
  }

  return Array.from(dedupe.values()).sort((a, b) => a.path.localeCompare(b.path));
};
