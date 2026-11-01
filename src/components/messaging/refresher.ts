"use client";

import { useEffect, useState } from "react";

// Runs a refetch at most once at a time. A call while it runs folds into one
// more run afterwards; schedule() also waits a moment first, so a burst of
// live events (an announcement reaching many patients) costs one fetch.
export class Refresher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private again = false;

  constructor(
    private task: () => Promise<void>,
    private readonly delayMs = 200,
  ) {}

  setTask(task: () => Promise<void>): void {
    this.task = task;
  }

  schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, this.delayMs);
  }

  async run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      await this.task();
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        void this.run();
      }
    }
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

const idle = async () => {};

// A Refresher that always runs the latest `task`. Effects declared after
// this hook already see the current task.
export function useRefresher(
  task: () => Promise<void>,
  delayMs?: number,
): Refresher {
  const [refresher] = useState(() => new Refresher(idle, delayMs));
  useEffect(() => {
    refresher.setTask(task);
  });
  useEffect(() => () => refresher.cancel(), [refresher]);
  return refresher;
}
