import { CircuitBreaker } from './circuitBreaker.js';
import { postJsonWithRetry } from './httpClient.js';

export class HealerClient {
  constructor({ healerUrl, healerToken, timeoutMs = 5000 }) {
    this.healerUrl = healerUrl;
    this.healerToken = healerToken;
    this.timeoutMs = timeoutMs;
    this.breaker = new CircuitBreaker({ failureThreshold: 5, openMs: 2 * 60 * 1000 });
  }

  async forwardBuildFailed(event) {
    if (!this.breaker.canRequest()) {
      const err = new Error('circuit_open');
      err.code = 'circuit_open';
      throw err;
    }

    try {
      const response = await postJsonWithRetry(
        this.healerUrl,
        {
          correlationId: event.correlationId,
          buildFailedEvent: event
        },
        {
          timeoutMs: this.timeoutMs,
          headers: {
            Authorization: `Bearer ${this.healerToken}`
          }
        }
      );
      this.breaker.markSuccess();
      return response;
    } catch (err) {
      this.breaker.markFailure();
      throw err;
    }
  }
}
