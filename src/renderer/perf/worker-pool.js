// ═══════════════════════════════════════════════════════════════
//  NOTER WORKER POOL — src/renderer/perf/worker-pool.js
//
//  Manages named worker pools so heavy CPU work never blocks the
//  UI thread. Each pool holds N workers of the same type; tasks
//  are distributed round-robin to idle workers or queued.
//
//  Usage:
//    WorkerPool.create('indexer', '../workers/indexer.worker.js', 2);
//    const result = await WorkerPool.post('indexer', { files: [...] });
//    WorkerPool.terminate('indexer');
// ═══════════════════════════════════════════════════════════════
'use strict';

window.WorkerPool = (() => {
  // poolName → { workers: WorkerEntry[], queue: PendingTask[], nextId: number }
  const _pools = new Map();

  // ── Internal helpers ──────────────────────────────────────────

  function _entry(worker) {
    return { worker, busy: false, pending: null };
  }

  function _dispatch(pool, entry, task) {
    entry.busy    = true;
    entry.pending = task;
    entry.worker.postMessage({ id: task.id, ...task.data });
  }

  function _drainQueue(pool) {
    if (!pool.queue.length) return;
    const idle = pool.workers.find(e => !e.busy);
    if (!idle) return;
    _dispatch(pool, idle, pool.queue.shift());
  }

  function _makeWorker(url, pool) {
    const entry = _entry(new Worker(url));

    entry.worker.onmessage = ({ data }) => {
      const task = entry.pending;
      entry.busy    = false;
      entry.pending = null;

      if (task) {
        if (data.error) task.reject(new Error(data.error));
        else            task.resolve(data);
      }

      _drainQueue(pool);
    };

    entry.worker.onerror = (err) => {
      const task = entry.pending;
      entry.busy    = false;
      entry.pending = null;
      if (task) task.reject(err);

      // Recreate the crashed worker
      entry.worker.terminate();
      Object.assign(entry, _entry(new Worker(url)));
      _makeWorker._patch(entry, url, pool);
      _drainQueue(pool);
    };

    return entry;
  }

  // Patch onerror/onmessage onto a fresh entry (used after crash)
  _makeWorker._patch = (entry, url, pool) => {
    entry.worker.onmessage = ({ data }) => {
      const task = entry.pending;
      entry.busy    = false;
      entry.pending = null;
      if (task) {
        if (data.error) task.reject(new Error(data.error));
        else            task.resolve(data);
      }
      _drainQueue(pool);
    };
    entry.worker.onerror = (err) => {
      const task = entry.pending;
      entry.busy    = false;
      entry.pending = null;
      if (task) task.reject(err);
      entry.worker.terminate();
      const fresh = _entry(new Worker(url));
      Object.assign(entry, fresh);
      _makeWorker._patch(entry, url, pool);
      _drainQueue(pool);
    };
  };

  // ── Public API ────────────────────────────────────────────────

  /**
   * Create a named pool.
   * @param {string} name  - pool identifier
   * @param {string} url   - worker script URL
   * @param {number} size  - number of parallel workers (default 2)
   */
  function create(name, url, size = 2) {
    if (_pools.has(name)) return;
    const pool = { workers: [], queue: [], nextId: 0, url };
    for (let i = 0; i < size; i++) {
      pool.workers.push(_makeWorker(url, pool));
    }
    _pools.set(name, pool);
  }

  /**
   * Post a task to a named pool.
   * Returns a Promise that resolves with the worker's response.
   * @param {string} name  - pool identifier
   * @param {object} data  - payload (merged with { id })
   */
  function post(name, data) {
    const pool = _pools.get(name);
    if (!pool) return Promise.reject(new Error(`WorkerPool: unknown pool "${name}"`));

    return new Promise((resolve, reject) => {
      const task = { id: pool.nextId++, data, resolve, reject };
      const idle = pool.workers.find(e => !e.busy);
      if (idle) _dispatch(pool, idle, task);
      else      pool.queue.push(task);
    });
  }

  /** Drain all queued tasks and terminate workers for a pool. */
  function terminate(name) {
    const pool = _pools.get(name);
    if (!pool) return;
    for (const entry of pool.workers) entry.worker.terminate();
    for (const task of pool.queue) task.reject(new Error('WorkerPool: terminated'));
    _pools.delete(name);
  }

  /** Return queue depth + worker count for debugging. */
  function stats(name) {
    const pool = _pools.get(name);
    if (!pool) return null;
    return {
      workers: pool.workers.length,
      busy:    pool.workers.filter(e => e.busy).length,
      queued:  pool.queue.length,
    };
  }

  return { create, post, terminate, stats };
})();
