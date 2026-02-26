import { readConfig } from './config.js';
import { createApp } from './app.js';

const config = readConfig();
const app = createApp(config);

app.server.listen(config.port, () => {
  process.stdout.write(`mission-control server listening on ${config.port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    app.close();
    process.exit(0);
  });
}
