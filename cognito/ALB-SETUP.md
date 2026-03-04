# ALB with Cognito Authentication Setup

This guide shows how to use an Application Load Balancer (ALB) to handle Cognito authentication instead of doing JWT verification in your backend.

## Architecture

```
┌──────────┐      ┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Client  │─────▶│     ALB     │─────▶│   Cognito    │      │   Backend   │
│          │      │ (Port 80)   │      │  User Pool   │      │ (Port 3001) │
└──────────┘      └─────────────┘      └──────────────┘      └─────────────┘
                        │                                            ▲
                        │                                            │
                        └────────────────────────────────────────────┘
                          Forwards authenticated requests with
                          x-amzn-oidc-data header
```

## How It Works

1. **User accesses ALB** → ALB redirects to Cognito for authentication
2. **User logs in** → Cognito redirects back to ALB with auth code
3. **ALB validates** → ALB exchanges code for tokens with Cognito
4. **ALB forwards request** → Adds `x-amzn-oidc-data` header with user info
5. **Backend extracts user** → Parses header to get authenticated user data

## Benefits

✅ **No JWT verification in backend** - ALB handles it  
✅ **Automatic token refresh** - ALB manages sessions  
✅ **Built-in session management** - Via cookies  
✅ **Simplified backend code** - Just parse headers  
✅ **Centralized auth** - One place for all auth logic  

## Prerequisites

Before deploying the ALB stack, you need:

1. **Cognito User Pool Domain** - Create one first:
   ```bash
   aws cognito-idp create-user-pool-domain \
     --domain myapp-12345 \
     --user-pool-id us-east-1_ZWzVtGG7c \
     --region us-east-1
   ```

2. **Update Cognito Client Callback URLs**:
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id us-east-1_ZWzVtGG7c \
     --client-id 13thtsksprs588ud2sqelcfkp6 \
     --callback-urls "http://YOUR-ALB-DNS/oauth2/idpresponse" \
     --allowed-o-auth-flows code \
     --allowed-o-auth-scopes openid \
     --allowed-o-auth-flows-user-pool-client \
     --region us-east-1
   ```

## Deployment Steps

### 1. Create Cognito User Pool Domain

```bash
# Choose a unique domain prefix
DOMAIN_PREFIX="myauthapp-$(date +%s)"

aws cognito-idp create-user-pool-domain \
  --domain $DOMAIN_PREFIX \
  --user-pool-id us-east-1_ZWzVtGG7c \
  --region us-east-1

echo "Domain created: $DOMAIN_PREFIX"
```

### 2. Deploy ALB Stack

```bash
aws cloudformation create-stack \
  --stack-name cognito-alb-stack \
  --template-body file://alb-cognito-stack.yaml \
  --parameters \
    ParameterKey=VpcId,ParameterValue=vpc-xxxxx \
    ParameterKey=SubnetIds,ParameterValue="subnet-xxxxx,subnet-yyyyy" \
    ParameterKey=UserPoolId,ParameterValue=us-east-1_ZWzVtGG7c \
    ParameterKey=UserPoolClientId,ParameterValue=13thtsksprs588ud2sqelcfkp6 \
    ParameterKey=UserPoolDomain,ParameterValue=$DOMAIN_PREFIX \
  --region us-east-1

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name cognito-alb-stack \
  --region us-east-1

# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name cognito-alb-stack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

echo "ALB URL: http://$ALB_DNS"
```

### 3. Update Cognito Callback URLs

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_ZWzVtGG7c \
  --client-id 13thtsksprs588ud2sqelcfkp6 \
  --callback-urls "http://$ALB_DNS/oauth2/idpresponse" \
  --logout-urls "http://$ALB_DNS" \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --supported-identity-providers COGNITO \
  --region us-east-1
```

### 4. Deploy Backend with ALB Mode

Use the simplified backend that reads ALB headers:

```bash
cd backend

# Use the ALB-compatible server
cp server-alb.js server.js

# Or run it separately
node server-alb.js
```

## Backend Code Changes

### Original (JWT Verification)
```javascript
const verifier = CognitoJwtVerifier.create({...});
const token = authHeader.split(' ')[1];
const payload = await verifier.verify(token);
```

### With ALB (Header Parsing)
```javascript
const encodedHeader = req.headers['x-amzn-oidc-data'];
const payload = JSON.parse(
  Buffer.from(encodedHeader.split('.')[1], 'base64').toString('utf8')
);
req.user = {
  username: payload['cognito:username'],
  email: payload.email,
  sub: payload.sub
};
```

## Testing

1. **Access ALB URL**: `http://YOUR-ALB-DNS/api/protected`
2. **ALB redirects to Cognito** login page
3. **Sign in** with your Cognito credentials
4. **ALB redirects back** and forwards to backend
5. **Backend receives** authenticated user info in headers

## Public Endpoints

To allow unauthenticated access to certain endpoints, add listener rules:

```yaml
PublicEndpointRule:
  Type: AWS::ElasticLoadBalancingV2::ListenerRule
  Properties:
    Priority: 1
    Conditions:
      - Field: path-pattern
        Values:
          - '/api/public'
          - '/api/health'
    Actions:
      - Type: forward  # Skip authentication
        TargetGroupArn: !Ref TargetGroup
```

## Security Considerations

1. **ALB validates JWT** - Backend trusts ALB headers
2. **Use HTTPS in production** - Add ACM certificate
3. **Restrict backend SG** - Only allow traffic from ALB
4. **Session timeout** - Configure in ALB listener (default 3600s)
5. **Verify x-amzn-oidc-data** - In production, verify JWT signature

## Cleanup

```bash
aws cloudformation delete-stack \
  --stack-name cognito-alb-stack \
  --region us-east-1

aws cognito-idp delete-user-pool-domain \
  --domain $DOMAIN_PREFIX \
  --user-pool-id us-east-1_ZWzVtGG7c \
  --region us-east-1
```

## Comparison: ALB Auth vs Backend JWT

| Feature | ALB Auth | Backend JWT |
|---------|----------|-------------|
| Token verification | ALB | Backend |
| Session management | ALB (cookies) | Frontend (localStorage) |
| Backend complexity | Low | Medium |
| Frontend changes | None | Needs token handling |
| Cost | ALB + data transfer | Just compute |
| Scalability | High | Depends on backend |
| Use case | Traditional web apps | SPAs, mobile apps |

## When to Use ALB Auth

✅ Server-side rendered apps  
✅ Want centralized authentication  
✅ Already using ALB  
✅ Prefer cookie-based sessions  
✅ Simplify backend code  

## When to Use Backend JWT

✅ Single Page Applications (SPAs)  
✅ Mobile apps  
✅ Microservices  
✅ Need fine-grained control  
✅ Cross-origin requests  
