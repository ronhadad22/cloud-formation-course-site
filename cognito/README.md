# AWS Cognito Authentication App

Full-stack application demonstrating AWS Cognito authentication with a React frontend and Node.js backend.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  React Frontend │────────▶│  AWS Cognito    │◀────────│  Node.js API    │
│  (Port 3000)    │         │  User Pool      │         │  (Port 3001)    │
│                 │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## Features

### Frontend
- ✅ User sign up with email verification
- ✅ User sign in with username/password
- ✅ Email confirmation flow
- ✅ Protected routes with JWT tokens
- ✅ Modern UI with gradient design
- ✅ API testing dashboard

### Backend
- ✅ JWT token verification
- ✅ Protected API endpoints
- ✅ Public endpoints (no auth required)
- ✅ User profile retrieval
- ✅ CORS enabled

### AWS Infrastructure
- ✅ Cognito User Pool
- ✅ User Pool Client
- ✅ User Groups (Admins, Users)
- ✅ Email verification
- ✅ Password policies

## Prerequisites

- Node.js 16+ and npm
- AWS Account
- AWS CLI configured with credentials

## Setup Instructions

### 1. Deploy AWS Infrastructure

Deploy the CloudFormation stack to create Cognito resources:

```bash
cd cognito

# Deploy the stack
aws cloudformation create-stack \
  --stack-name cognito-auth-stack \
  --template-body file://cognito-stack.yaml \
  --parameters ParameterKey=AppName,ParameterValue=MyAuthApp \
  --region us-east-1

# Wait for stack creation to complete
aws cloudformation wait stack-create-complete \
  --stack-name cognito-auth-stack \
  --region us-east-1

# Get the outputs
aws cloudformation describe-stacks \
  --stack-name cognito-auth-stack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

### 2. Configure Backend

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Cognito details from CloudFormation outputs
# COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
# COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
# AWS_REGION=us-east-1
# PORT=3001
```

### 3. Configure Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Cognito details
# VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
# VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
# VITE_AWS_REGION=us-east-1
# VITE_API_URL=http://localhost:3001
```

### 4. Run the Applications

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

### Sign Up Flow
1. Click "Don't have an account? Sign up"
2. Enter username, email, and password
3. Check your email for the confirmation code
4. Enter the confirmation code to verify your account
5. Sign in with your credentials

### Testing API Endpoints

Once logged in, you can test three endpoints from the dashboard:

- **Public Endpoint** - No authentication required
- **Protected Endpoint** - Requires valid JWT token
- **User Profile** - Returns authenticated user information

## API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/public` - Public data (no auth)

### Protected Endpoints (Requires JWT)
- `GET /api/protected` - Protected data
- `GET /api/user/profile` - User profile
- `POST /api/data` - Submit data

## CloudFormation Resources

The stack creates:

- **UserPool** - Cognito User Pool with email verification
- **UserPoolClient** - App client for authentication
- **UserPoolDomain** - Hosted UI domain
- **AdminGroup** - Admin user group
- **UsersGroup** - Regular user group

## Environment Variables

### Backend (.env)
```
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-client-id
PORT=3001
```

### Frontend (.env)
```
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_API_URL=http://localhost:3001
```

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Troubleshooting

### "User pool does not exist"
- Verify the User Pool ID in your .env files
- Check that the CloudFormation stack deployed successfully

### "Invalid client id"
- Verify the Client ID matches the User Pool Client
- Ensure you're using the correct region

### Email not received
- Check spam folder
- Verify email in Cognito console
- For production, configure SES for email sending

### CORS errors
- Ensure backend is running on port 3001
- Check VITE_API_URL in frontend .env

## Cleanup

To delete all AWS resources:

```bash
aws cloudformation delete-stack \
  --stack-name cognito-auth-stack \
  --region us-east-1
```

## Tech Stack

**Frontend:**
- React 18
- Vite
- amazon-cognito-identity-js
- Axios

**Backend:**
- Node.js
- Express
- aws-jwt-verify
- AWS SDK

**Infrastructure:**
- AWS Cognito
- CloudFormation

## Security Notes

- Never commit `.env` files to version control
- Use HTTPS in production
- Implement rate limiting for production APIs
- Enable MFA for sensitive applications
- Rotate credentials regularly

## License

MIT
