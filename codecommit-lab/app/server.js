const express = require('express');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || '1.0.0';

// Home page
app.get('/', (req, res) => {
  res.send(`
    <h1>CI/CD Demo App</h1>
    <p>Version: ${VERSION}</p>
    <p>Hostname: ${os.hostname()}</p>
    <p>Time: ${new Date().toISOString()}</p>
    <hr>
    <a href="/api/health">/api/health</a>
  `);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', version: VERSION });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App v${VERSION} running on port ${PORT}`);
});
