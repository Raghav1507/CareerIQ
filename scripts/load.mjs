#!/usr/bin/env node
/**
 * Minimal load test —  Node-only (no deps).
 *
 *   node scripts/load.mjs --url http://localhost:3000/api/health -c 10 -d 10
 *
 * Options:
 *   --url <url>            target URL (default http://localhost:3000/api/health)
 *   -c, --concurrency <n>  parallel workers (default 10)
 *   -d, --duration <sec>   test duration in seconds (default 10)
 *   --timeout <ms>         per-request timeout (default 10000)
 *
 * Prints throughput + latency percentiles. Exit code 1 if every request failed
 * or the p95 exceeds --max-p95 (default 5000ms).
 */

const args = process.argv.slice(2);

function arg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

const URL_ = arg("--url", "http://localhost:3000/api/health");
const CONCURRENCY = Math.max(1, Number(arg("-c", arg("--concurrency", "10"))));
const DURATION_S = Math.max(1, Number(arg("-d", arg("--duration", "10"))));
const TIMEOUT_MS = Number(arg("--timeout", "10000"));
const MAX_P95 = Number(arg("--max-p95", "5000"));

const latencies = [];
const statuses = new Map();
let completed = 0;
let failed = 0;
let aborted = 0;

const started = Date.now();
const deadline = started + DURATION_S * 1000;

async function worker(id) {
  while (Date.now() < deadline) {
    const t0 = performance.now();
    try {
      const res = await fetch(URL_, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "x-load-worker": String(id) },
      });
      await res.arrayBuffer().catch(() => undefined);
      const ms = performance.now() - t0;
      latencies.push(ms);
      statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
      if (res.ok) completed += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      if (err?.name === "TimeoutError" || err?.name === "AbortError") aborted += 1;
    }
  }
}

console.log(`load test: ${URL_} · workers=${CONCURRENCY} · duration=${DURATION_S}s`);

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

const elapsedS = (Date.now() - started) / 1000;
latencies.sort((a, b) => a - b);
const pct = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] : 0);
const rps = (completed + failed) / elapsedS;

console.log("---");
console.log(`requests : ${completed + failed} total · ${completed} ok · ${failed} failed (${aborted} timeouts)`);
console.log(`duration : ${elapsedS.toFixed(1)}s`);
console.log(`throughput: ${rps.toFixed(1)} req/s`);
console.log(`latency  : p50=${pct(50).toFixed(1)}ms p95=${pct(95).toFixed(1)}ms p99=${pct(99).toFixed(1)}ms max=${(latencies.at(-1) ?? 0).toFixed(1)}ms`);
console.log(`statuses : ${[...statuses].map(([s, n]) => `${s}×${n}`).join(" ") || "none"}`);

if (completed + failed === 0) {
  console.error("FAIL: no requests completed");
  process.exit(1);
}
if (completed === 0) {
  console.error("FAIL: every request failed");
  process.exit(1);
}
if (pct(95) > MAX_P95) {
  console.error(`FAIL: p95 ${pct(95).toFixed(0)}ms exceeds --max-p95 ${MAX_P95}ms`);
  process.exit(1);
}
console.log("PASS");
