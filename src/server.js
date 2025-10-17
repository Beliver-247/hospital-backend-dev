import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import env from './config/env.js';

const server = http.createServer(app);

(async () => {
  try {
    await connectDB();
    server.listen(env.port, () => {
      console.log(`🚀 Server running at http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();
