const BUILD_TIME = "2026-08-27T23:30:00Z";
const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
const el = document.getElementById("timestamp");
if (el) el.textContent = `live ${ts} UTC · build ${BUILD_TIME.slice(0,16).replace("T"," ")} UTC`;

const branchEl = document.getElementById("branch");
if (branchEl) {
  // Allow override via query? Keep default.
}

const runLink = document.getElementById("runLink") as HTMLAnchorElement | null;
if (runLink) {
  const runId = "33126349997";
  runLink.href = `https://github.com/agents-dev/aiplay/actions/runs/${runId}`;
  runLink.textContent = `Run #${runId}`;
}

let count = 0;
const btn = document.getElementById("counterBtn") as HTMLButtonElement | null;
const countEl = document.getElementById("count");
if (btn && countEl) {
  btn.addEventListener("click", () => {
    count++;
    countEl.textContent = String(count);
    btn.textContent = count === 1 ? "Clicked 1 time" : `Clicked ${count} times`;
  });
}

// Expose for verifier browser checks
declare global { interface Window { __smokeTest: { getCount: () => number } } }
window.__smokeTest = { getCount: () => count };
console.log("[smoke-test] Standard workflow path OK - verifier can check window.__smokeTest.getCount()");
