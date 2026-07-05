interface QueueTask<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

/**
 * Minimal array-based async queue with bounded concurrency.
 *
 * This exists to satisfy the "asynchronous processing" requirement by
 * decoupling request handling from the simulated DB call: instead of every
 * request handler directly awaiting `fetchUserFromDb`, handlers enqueue a
 * task and await its eventual result, while a fixed-size pool of workers
 * pulls from the queue. This caps how many "DB calls" run concurrently
 * (bounded concurrency) and keeps the API responsive under bursts, since
 * excess requests wait in the queue rather than piling directly onto the
 * simulated datastore.
 */
export class RequestQueue<T> {
  private readonly tasks: QueueTask<T>[] = [];
  private activeWorkers = 0;

  constructor(private readonly concurrency = 20) {}

  enqueue(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.tasks.push({ run, resolve, reject });
      this.drain();
    });
  }

  get queuedCount(): number {
    return this.tasks.length;
  }

  private drain(): void {
    while (this.activeWorkers < this.concurrency && this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) return;
      this.activeWorkers++;

      task
        .run()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.activeWorkers--;
          this.drain();
        });
    }
  }
}
