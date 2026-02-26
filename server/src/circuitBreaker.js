export class CircuitBreaker {
  constructor({ failureThreshold = 5, openMs = 2 * 60 * 1000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
    this.failures = 0;
    this.openUntil = 0;
  }

  canRequest() {
    return Date.now() >= this.openUntil;
  }

  markSuccess() {
    this.failures = 0;
    this.openUntil = 0;
  }

  markFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.openUntil = Date.now() + this.openMs;
      this.failures = 0;
    }
  }
}
