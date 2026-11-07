import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetPath, projectRoot, RenderQueue, validateRenderRequest } from './render';
import { alignmentStatus } from './alignment';

const extensions = new Set([
  '.mp3',
  '.wav',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.mp4',
  '.webm',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
]);
const uploadDir = path.join(projectRoot, 'public/uploads');
mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, done) =>
      done(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 250 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => {
    if (extensions.has(path.extname(file.originalname).toLowerCase())) done(null, true);
    else
      done(
        new Error(
          'Unsupported media. Upload MP3, WAV, PNG, JPG, WebP, MP4, WebM, WOFF, WOFF2, TTF, or OTF.',
        ),
      );
  },
});
export function createApp(port = Number(process.env.API_PORT) || 3002) {
  const app = express();
  const queue = new RenderQueue(`http://127.0.0.1:${port}`);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const origin = process.env.CORS_ORIGIN;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '15mb' }));
  app.use(['/uploads', '/assets', '/renders'], (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  app.use('/uploads', express.static(uploadDir, { immutable: true, maxAge: '1y' }));
  app.use('/assets', express.static(path.join(projectRoot, 'public/assets')));
  app.use(
    '/renders',
    express.static(path.join(projectRoot, 'public/renders'), {
      setHeaders: (res) =>
        res.setHeader('Content-Disposition', 'attachment; filename="lyricforge.mp4"'),
    }),
  );
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      rendering: true,
      alignmentAvailable: alignmentStatus().available,
      alignment: alignmentStatus(),
    }),
  );
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Choose a file to upload.' });
      return;
    }
    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });
  });
  app.post('/api/render', (req, res) => {
    try {
      const { project, resolution } = validateRenderRequest(req.body);
      res.status(202).json(queue.enqueue(project, resolution));
    } catch (error) {
      res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'Invalid render request.' });
    }
  });
  app.get('/api/render/:id', (req, res) => {
    const job = queue.jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Render job not found. The server may have restarted.' });
      return;
    }
    res.json(job);
  });
  app.delete('/api/render/:id', (req, res) => {
    if (!queue.cancel(req.params.id)) {
      res.status(404).json({ error: 'Render job not found.' });
      return;
    }
    res.json(queue.jobs.get(req.params.id));
  });
  app.post('/api/align', async (req, res) => {
    try {
      const { audioUrl, words, duration } = req.body;
      if (typeof audioUrl !== 'string' || !/\.(mp3|wav)$/i.test(audioUrl))
        throw new Error('Choose an uploaded MP3 or WAV.');
      if (
        duration !== undefined &&
        (!Number.isFinite(duration) || duration <= 0 || duration > 1800)
      )
        throw new Error('Invalid audio duration.');
      const audioPath = assetPath(audioUrl);
      if (
        !Array.isArray(words) ||
        words.length > 20000 ||
        !words.every((w) => typeof w?.text === 'string' && w.text.length <= 500)
      )
        throw new Error('Provide the original imported lyrics.');
      const { alignProject } = await import('./alignment');
      res.json({ words: await alignProject(audioPath, words, duration) });
    } catch (error) {
      res
        .status(process.env.ALIGNMENT_URL ? 400 : 503)
        .json({ error: error instanceof Error ? error.message : 'Alignment failed.' });
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use(express.static(path.join(projectRoot, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(projectRoot, 'dist/index.html')));
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Request failed.';
      res
        .status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
        .json({ error: message });
    },
  );
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.API_PORT) || 3002;
  createApp(port).listen(port, '0.0.0.0', () =>
    console.log(`LyricForge render API: http://localhost:${port}`),
  );
}
