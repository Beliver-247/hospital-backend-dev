// src/app.js
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'node:path';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// serve files from /uploads
app.use('/uploads', express.static(path.resolve('uploads')));

app.use('/api', routes);

// 404
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

// error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

export default app;
