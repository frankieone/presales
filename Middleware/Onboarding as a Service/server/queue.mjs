/**
 * The request queue. Every intermediary shares one FrankieOne account, so one
 * rate limit. This keeps one busy intermediary from starving the rest:
 *
 *   - at most POLICY.maxConcurrent calls to FrankieOne at once
 *   - intermediaries take turns (round robin), so capacity is shared fairly
 *     and capacity one isn't using goes to the others
 *   - one investor at a time: two intermediaries onboarding the same person
 *     are run in sequence, so they don't conflict on the same record
 *   - a rate-limit response from FrankieOne is retried after a growing delay
 */
import { POLICY } from './config.mjs';

const queues = new Map(); // intermediaryId → [{ entityKey, task, resolve, reject }]
const busyInvestors = new Set();
let running = 0;
let turn = 0;

export function schedule(intermediaryId, entityKey, task) {
  return new Promise((resolve, reject) => {
    if (!queues.has(intermediaryId)) queues.set(intermediaryId, []);
    queues.get(intermediaryId).push({ entityKey, task, resolve, reject });
    pump();
  });
}

function next() {
  const ids = [...queues.keys()];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[(turn + i) % ids.length];
    const q = queues.get(id);
    const idx = q.findIndex((job) => !busyInvestors.has(job.entityKey));
    if (idx >= 0) {
      turn = (turn + i + 1) % Math.max(ids.length, 1);
      const [job] = q.splice(idx, 1);
      if (!q.length) queues.delete(id);
      return job;
    }
  }
  return null;
}

function pump() {
  while (running < POLICY.maxConcurrent) {
    const job = next();
    if (!job) return;
    running += 1;
    busyInvestors.add(job.entityKey);
    withRetry(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        running -= 1;
        busyInvestors.delete(job.entityKey);
        pump();
      });
  }
}

async function withRetry(task, attempt = 0) {
  try {
    return await task();
  } catch (err) {
    if (err.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      return withRetry(task, attempt + 1);
    }
    throw err;
  }
}

export const queueDepth = () => [...queues.values()].reduce((n, q) => n + q.length, 0) + running;
