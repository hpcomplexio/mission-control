import { setInterval } from 'node:timers';

export class EventHub {
  constructor({ db, heartbeatMs = 15000 }) {
    this.db = db;
    this.clients = new Set();
    this.heartbeatMs = heartbeatMs;
    this.heartbeatTimer = setInterval(() => this.heartbeat(), heartbeatMs);
    this.heartbeatTimer.unref();
  }

  close() {
    clearInterval(this.heartbeatTimer);
    for (const client of this.clients) {
      client.res.end();
    }
    this.clients.clear();
  }

  publish(event) {
    const seq = this.db.insertEvent(event);
    const frame = toSseFrame(seq, event);
    for (const client of this.clients) {
      client.res.write(frame);
      client.lastSentSeq = seq;
    }
    return seq;
  }

  attachClient(req, res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive'
    });
    res.write(': connected\n\n');

    const lastEventId = req.headers['last-event-id'];
    const lastSeq = normalizeLastEventId(this.db, lastEventId);
    const backlog = this.db.getEventsAfter(lastSeq, 500);
    for (const row of backlog) {
      res.write(toSseFrame(row.seq, row.event));
    }

    const client = { req, res, lastSentSeq: backlog.length ? backlog.at(-1).seq : lastSeq };
    this.clients.add(client);

    req.on('close', () => {
      this.clients.delete(client);
    });
  }

  heartbeat() {
    const data = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`;
    for (const client of this.clients) {
      client.res.write(data);
    }
  }
}

function normalizeLastEventId(db, headerValue) {
  if (!headerValue) return 0;
  const numeric = Number(headerValue);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }
  return db.getSeqForEventId(String(headerValue));
}

function toSseFrame(seq, event) {
  return `id: ${seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
