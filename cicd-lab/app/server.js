const express = require('express');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || '1.0.0';
const DEPLOY_TIME = new Date().toISOString();

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; flex-direction: column; }
.navbar { background: #1e293b; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; }
.navbar h1 { color: #3b82f6; font-size: 1.4rem; }
.badge { background: #22c55e; color: #0f172a; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }
.container { max-width: 900px; margin: 40px auto; padding: 0 20px; flex: 1; }
.hero { text-align: center; padding: 40px 0; }
.hero h2 { font-size: 2rem; margin-bottom: 12px; }
.hero p { color: #94a3b8; font-size: 1.1rem; }
.card { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #334155; }
.card h3 { color: #3b82f6; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #334155; }
th { color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; }
.version-tag { background: #3b82f6; color: white; padding: 6px 16px; border-radius: 8px; font-size: 1.2rem; font-weight: 700; display: inline-block; margin: 16px 0; }
.footer { text-align: center; padding: 20px; color: #475569; font-size: 0.85rem; border-top: 1px solid #1e293b; }
`;

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>CI/CD Demo App</title><style>${CSS}</style></head><body>
    <nav class="navbar"><h1>🚀 CI/CD Demo App</h1><span class="badge">● Running</span></nav>
    <div class="container">
      <div class="hero">
        <h2>Hello from the CI/CD Pipeline!</h2>
        <p>This app is deployed automatically via <strong>GitHub Actions</strong></p>
        <div class="version-tag">v${VERSION}</div>
      </div>
      <div class="card"><h3>📋 Deployment Info</h3>
        <table>
          <tr><th>Field</th><th>Value</th></tr>
          <tr><td>App Version</td><td>${VERSION}</td></tr>
          <tr><td>Deploy Time</td><td>${DEPLOY_TIME}</td></tr>
          <tr><td>Hostname</td><td>${os.hostname()}</td></tr>
          <tr><td>Platform</td><td>${os.platform()} ${os.arch()}</td></tr>
          <tr><td>Node.js</td><td>${process.version}</td></tr>
          <tr><td>Uptime</td><td>${Math.floor(process.uptime())}s</td></tr>
        </table>
      </div>
      <div class="card"><h3>🔗 API Endpoints</h3>
        <table>
          <tr><th>Endpoint</th><th>Description</th></tr>
          <tr><td><a href="/api/health" style="color:#3b82f6">/api/health</a></td><td>Health check</td></tr>
          <tr><td><a href="/api/info" style="color:#3b82f6">/api/info</a></td><td>App info (JSON)</td></tr>
        </table>
      </div>
    </div>
    <div class="footer">CI/CD Lab &mdash; Deployed with GitHub Actions + Docker + AWS EC2</div>
  </body></html>`);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', version: VERSION, uptime: Math.floor(process.uptime()) });
});

app.get('/api/info', (req, res) => {
  res.json({
    version: VERSION,
    deployTime: DEPLOY_TIME,
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CI/CD Demo App v${VERSION} running on port ${PORT}`);
});
