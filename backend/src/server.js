import { config } from './config.js';
import { pool } from './db.js';
import { createApp } from './app.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`RNSIT Smart Campus API listening on :${config.port} (${config.env})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
