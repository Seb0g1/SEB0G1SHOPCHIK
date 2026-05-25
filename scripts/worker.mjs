const appUrl = (process.env.APP_INTERNAL_URL || process.env.APP_PUBLIC_URL || "http://localhost:4317").replace(/\/$/, "");
const onlineInterval = toInterval(process.env.AVITO_WORKER_ONLINE_INTERVAL_SECONDS, 45);
const reviewsInterval = toInterval(process.env.AVITO_WORKER_REVIEWS_INTERVAL_SECONDS, 180);

let lastOnlineAt = 0;
let lastReviewsAt = 0;

console.log(`Avito worker started. App URL: ${appUrl}`);
console.log(`Online interval: ${onlineInterval / 1000}s, reviews interval: ${reviewsInterval / 1000}s`);

while (true) {
  const now = Date.now();

  if (now - lastOnlineAt >= onlineInterval) {
    lastOnlineAt = now;
    await post("/api/automation/online-ping", { force: false });
  }

  if (now - lastReviewsAt >= reviewsInterval) {
    lastReviewsAt = now;
    await post("/api/automation/sync-reviews", { force: false });
  }

  await sleep(1000);
}

async function post(path, body) {
  try {
    const response = await fetch(`${appUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    const status = payload.ok === false ? "warn" : "ok";
    console.log(`[${new Date().toISOString()}] ${status} ${path}: ${payload.message || response.status}`);
  } catch (error) {
    console.log(`[${new Date().toISOString()}] error ${path}: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

function toInterval(value, fallbackSeconds) {
  const seconds = Number(value || fallbackSeconds);
  return Math.max(15, seconds) * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
