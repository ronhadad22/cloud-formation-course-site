# Hybrid Setup: React App + ALB Backend

Keep your beautiful React login UI while using ALB for backend routing and security.

## Architecture

```
┌─────────────────┐
│   React App     │ (Custom UI - Port 3000)
│  (localhost)    │
└────────┬────────┘
         │ JWT Token in Authorization header
         ▼
┌─────────────────┐
│      ALB        │ (Port 80)
│  (AWS Cloud)    │
└────────┬────────┘
         │ Forwards request
         ▼
┌─────────────────┐
│    Backend      │ (Port 3001)
│  Verifies JWT   │
└─────────────────┘
```

## How It Works

1. **React app** authenticates with Cognito (your current setup)
2. **React app** gets JWT access token
3. **React app** calls ALB with `Authorization: Bearer <token>`
4. **ALB** forwards to backend (no auth at ALB level)
5. **Backend** verifies JWT (your current server.js)

## Benefits

✅ Keep your custom React UI  
✅ ALB provides load balancing & SSL termination  
✅ Backend still validates JWT (secure)  
✅ No Cognito Hosted UI needed  
✅ Works with your existing code  

## Setup

### 1. Deploy ALB (No Cognito Auth)

```bash
aws cloudformation create-stack \
  --stack-name cognito-alb-hybrid-stack \
  --template-body file://alb-hybrid-stack.yaml \
  --parameters \
    ParameterKey=VpcId,ParameterValue=vpc-xxxxx \
    ParameterKey=SubnetIds,ParameterValue="subnet-xxxxx,subnet-yyyyy" \
  --region us-east-1
```

### 2. Update React App API URL

Change frontend to call ALB instead of localhost:

```javascript
// frontend/src/config.js
export const apiConfig = {
  baseURL: 'http://YOUR-ALB-DNS',  // Instead of localhost:3001
};
```

### 3. Keep Current Backend

Your existing `server.js` works perfectly - it already verifies JWT:

```javascript
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID,
});
```

### 4. CORS Configuration

Update backend CORS to allow ALB:

```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'http://YOUR-ALB-DNS'],
  credentials: true
}));
```

## Request Flow

### React App Makes API Call

```javascript
// Dashboard.jsx
const token = await getAccessToken();
const response = await axios.get(`${apiConfig.baseURL}/api/protected`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

### ALB Receives Request

```
GET /api/protected HTTP/1.1
Host: your-alb-dns
Authorization: Bearer eyJraWQiOiJ...
```

### ALB Forwards to Backend

```
GET /api/protected HTTP/1.1
Host: 10.0.1.50:3001
Authorization: Bearer eyJraWQiOiJ...
X-Forwarded-For: 203.0.113.1
```

### Backend Verifies JWT

```javascript
const payload = await verifier.verify(token);
// Returns user data if valid
```

## Comparison

### Option 1: React → Backend (Current)
```
React (localhost:3000) → Backend (localhost:3001)
```
- ✅ Simple for development
- ❌ No load balancing
- ❌ No SSL termination
- ❌ Direct backend exposure

### Option 2: React → ALB → Backend (Hybrid)
```
React (localhost:3000) → ALB (AWS) → Backend (EC2)
```
- ✅ Production-ready
- ✅ Load balancing
- ✅ SSL termination
- ✅ Backend protected
- ✅ Keep React UI

### Option 3: ALB Auth (Hosted UI)
```
Browser → ALB (Cognito Auth) → Backend
```
- ✅ Simplest backend
- ❌ Lose React UI
- ❌ Use Cognito Hosted UI

## Production Deployment

### 1. Add HTTPS Listener

```yaml
HTTPSListener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    LoadBalancerArn: !Ref ApplicationLoadBalancer
    Port: 443
    Protocol: HTTPS
    Certificates:
      - CertificateArn: arn:aws:acm:...
    DefaultActions:
      - Type: forward
        TargetGroupArn: !Ref TargetGroup
```

### 2. Deploy React to S3 + CloudFront

```bash
# Build React app
cd frontend
npm run build

# Deploy to S3
aws s3 sync dist/ s3://your-bucket/

# Update API URL to ALB
VITE_API_URL=https://api.yourdomain.com
```

### 3. Update CORS

```javascript
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ],
  credentials: true
}));
```

## When to Use This Hybrid Approach

✅ You want to keep your custom React UI  
✅ You need production-grade infrastructure (ALB)  
✅ You want SSL termination at ALB  
✅ You need load balancing across multiple backends  
✅ You want to protect backend from direct access  

## Summary

**You don't have to choose!**

- **Frontend**: Keep your React app with custom login UI
- **ALB**: Use for routing, load balancing, SSL
- **Backend**: Keep JWT verification (secure)

The ALB just acts as a **reverse proxy** - it doesn't do authentication, your backend still does. This gives you the best of both worlds: custom UI + production infrastructure.
