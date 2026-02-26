import { setTimeout as sleep } from 'node:timers/promises';

const ATTEMPTS = [500, 1000, 2000];

export async function postJsonWithRetry(url, body, { headers = {}, timeoutMs = 5000 } = {}) {
  let lastError;
  for (let i = 0; i < ATTEMPTS.length; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('request_timeout')), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (i === ATTEMPTS.length - 1) break;
      const jitter = 1 + (Math.random() * 0.4 - 0.2);
      await sleep(Math.round(ATTEMPTS[i] * jitter));
    }
  }
  throw lastError;
}
