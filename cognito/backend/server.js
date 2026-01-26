const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { CognitoJwtVerifier } = require('aws-jwt-verify');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID,
});

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = await verifier.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/public', (req, res) => {
  res.json({ 
    message: 'This is a public endpoint - no authentication required',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ 
    message: 'This is a protected endpoint - authentication required',
    user: {
      username: req.user.username,
      sub: req.user.sub,
      email: req.user.email
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    profile: {
      username: req.user.username,
      email: req.user.email,
      sub: req.user.sub,
      groups: req.user['cognito:groups'] || [],
    }
  });
});

app.post('/api/data', authenticateToken, (req, res) => {
  const { data } = req.body;
  res.json({
    message: 'Data received successfully',
    receivedData: data,
    processedBy: req.user.username,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`User Pool ID: ${process.env.COGNITO_USER_POOL_ID}`);
  console.log(`Client ID: ${process.env.COGNITO_CLIENT_ID}`);
});
