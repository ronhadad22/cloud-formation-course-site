const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const extractUserFromALB = (req, res, next) => {
  const encodedHeader = req.headers['x-amzn-oidc-data'];
  
  if (!encodedHeader) {
    return res.status(401).json({ error: 'No authentication data from ALB' });
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedHeader.split('.')[1], 'base64').toString('utf8')
    );
    
    req.user = {
      username: payload.username || payload['cognito:username'],
      email: payload.email,
      sub: payload.sub,
      groups: payload['cognito:groups'] || [],
    };
    
    next();
  } catch (err) {
    console.error('Failed to parse ALB auth header:', err);
    return res.status(403).json({ error: 'Invalid authentication data' });
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

app.get('/api/protected', extractUserFromALB, (req, res) => {
  res.json({ 
    message: 'This is a protected endpoint - authenticated via ALB',
    user: {
      username: req.user.username,
      sub: req.user.sub,
      email: req.user.email
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/user/profile', extractUserFromALB, (req, res) => {
  res.json({
    profile: {
      username: req.user.username,
      email: req.user.email,
      sub: req.user.sub,
      groups: req.user.groups,
    }
  });
});

app.post('/api/data', extractUserFromALB, (req, res) => {
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
  console.log('Using ALB authentication mode');
  console.log('ALB will handle Cognito authentication');
});
