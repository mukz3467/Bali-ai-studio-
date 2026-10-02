import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 10000);
const WORKER_TOKEN = process.env.WORKER_TOKEN || '';

function authorized(req) {
  if (!WORKER_TOKEN) return true;
  return req.header('x-worker-token') === WORKER_TOKEN;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bali-browser-worker',
    browserRuntime: 'not-connected',
    message: 'Worker API is online. A browser runtime must be attached before website automation can run.'
  });
});

app.post('/worker/claim', (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const job = req.body?.job;
  if (!job?.id) return res.status(400).json({ error: 'job.id is required' });

  res.json({
    accepted: false,
    jobId: job.id,
    status: 'waiting_for_browser',
    message: 'The worker API received the job, but no browser runtime is attached. No external website action was performed.'
  });
});

app.post('/worker/heartbeat', (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    ok: true,
    browserConnected: false,
    timestamp: Date.now()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Bali browser worker listening on port ' + PORT);
});