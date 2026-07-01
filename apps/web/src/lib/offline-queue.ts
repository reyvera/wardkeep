const MAX_QUEUE_SIZE = 100;

interface QueuedAction {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  timestamp: number;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];

  add(action: Omit<QueuedAction, 'id' | 'timestamp'>): boolean {
    if (this.queue.length >= MAX_QUEUE_SIZE) return false;
    this.queue.push({
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    });
    this.persist();
    return true;
  }

  async flush(apiBase: string, token: string | null): Promise<{ synced: number; failed: number }> {
    let synced = 0,
      failed = 0;
    const toProcess = [...this.queue];

    for (const action of toProcess) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`${apiBase}${action.path}`, {
          method: action.method,
          headers,
          body: action.body ? JSON.stringify(action.body) : undefined,
        });
        this.queue = this.queue.filter((a) => a.id !== action.id);
        synced++;
      } catch {
        failed++;
      }
    }
    this.persist();
    return { synced, failed };
  }

  getSize(): number {
    return this.queue.length;
  }

  isFull(): boolean {
    return this.queue.length >= MAX_QUEUE_SIZE;
  }

  private persist() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('offline-queue', JSON.stringify(this.queue));
    }
  }

  load() {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('offline-queue');
      if (data) this.queue = JSON.parse(data);
    }
  }
}

export const offlineQueue = new OfflineQueue();
