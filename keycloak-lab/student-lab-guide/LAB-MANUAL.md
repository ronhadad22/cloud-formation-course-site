# Keycloak Identity & Access Management Lab

## Scenario: TechCorp HR Portal

**TechCorp** is migrating their internal HR portal to a modern identity management system. The current setup uses hardcoded usernames and passwords in the application code — a major security risk. The CISO has mandated:

- **Centralized identity management** — one identity provider for all applications
- **Role-Based Access Control (RBAC)** — employees see their dashboard, managers see salary data, admins see system panels
- **Standard protocols** — use OpenID Connect (OIDC) instead of custom auth
- **Single Sign-On (SSO)** — one login for all company applications

Your job is to deploy **Keycloak** as the identity provider, configure realms, users, roles, and clients, then protect a sample HR Portal web application using OIDC.

---

## Learning Objectives

By the end of this lab, you will be able to:

- ✅ Deploy **Keycloak** on AWS with Docker and PostgreSQL
- ✅ Create and configure **Realms** (multi-tenancy)
- ✅ Create **Users** and manage credentials
- ✅ Define **Roles** (realm roles and client roles)
- ✅ Register an **OIDC Client** (the HR Portal application)
- ✅ Understand the **OIDC Authorization Code Flow**
- ✅ Implement **Role-Based Access Control (RBAC)** in a web application
- ✅ Test **access control** by assigning/removing roles
- ✅ Compare Keycloak to AWS Cognito and other IdPs

---

## Key Concepts

### What is Keycloak?

Keycloak is an **open-source Identity and Access Management (IAM)** solution maintained by the CNCF (Cloud Native Computing Foundation). It provides:

| Feature | Description |
|---------|-------------|
| **SSO** | Single Sign-On across multiple applications |
| **Identity Brokering** | Connect to external IdPs (Google, GitHub, Azure AD) |
| **User Federation** | Sync users from LDAP/Active Directory |
| **OIDC / SAML** | Standard authentication protocols |
| **RBAC** | Role-based access control with fine-grained permissions |
| **Admin Console** | Web UI for managing everything |

### OIDC Authorization Code Flow

```
┌──────────┐     1. Click "Login"      ┌──────────────┐
│          │ ──────────────────────────►│              │
│  User's  │     2. Redirect to        │   Keycloak   │
│ Browser  │        Keycloak login     │   (IdP)      │
│          │ ◄──────────────────────── │              │
│          │     3. User enters        │              │
│          │        credentials        │              │
│          │ ──────────────────────────►│              │
│          │     4. Redirect back      │              │
│          │        with AUTH CODE     │              │
│          │ ◄──────────────────────── │              │
└──────┬───┘                           └──────┬───────┘
       │                                      │
       │  5. Send auth code                   │
       ▼                                      │
┌──────────┐     6. Exchange code     ┌───────┘
│  HR      │        for tokens        │
│  Portal  │ ─────────────────────────┘
│  (App)   │     7. Receive:
│          │        - ID Token (who you are)
│          │        - Access Token (what you can do)
│          │        - Refresh Token
└──────────┘
```

### Keycloak Hierarchy

```
Keycloak Server
└── Realm (tenant boundary)
    ├── Users (people who can log in)
    ├── Roles (permissions)
    │   ├── Realm Roles (global to the realm)
    │   └── Client Roles (specific to an application)
    ├── Clients (applications that use Keycloak)
    │   ├── demo-app (our HR Portal)
    │   └── another-app (future apps)
    └── Identity Providers (Google, GitHub, etc.)
```

---

## Architecture Overview

```
                        ┌──────────────────┐
                        │   Route53 DNS    │
                        │  *.iitc-course.com│
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   ALB (HTTPS)    │
                        │   ACM Cert       │
                        │   Port 443       │
                        └──┬───────────┬───┘
              Host-based   │           │   Host-based
              routing      │           │   routing
    keycloak.iitc-course.com    hr-portal.iitc-course.com
                           │           │
┌──────────────────────────┼───────────┼──────────────────┐
│          AWS VPC (10.0.0.0/16)       │                  │
│                          │           │                  │
│  ┌───────────────────────▼──┐  ┌─────▼────────────────┐ │
│  │ Keycloak Server          │  │ App Server           │ │
│  │ (t3.medium)              │  │ (t3.micro)           │ │
│  │                          │  │                      │ │
│  │ Docker:                  │  │ Node.js:             │ │
│  │  - Keycloak :8080        │  │  - HR Portal :3000   │ │
│  │  - PostgreSQL :5432      │  │  - OIDC protected    │ │
│  │                          │  │                      │ │
│  │ Admin Console:           │  │ Routes:              │ │
│  │  /admin                  │  │  / (public)          │ │
│  │                          │  │  /dashboard (auth)   │ │
│  │ OIDC Endpoints:          │  │  /salary (manager)   │ │
│  │  /realms/demo-realm/     │  │  /admin (admin)      │ │
│  └──────────────────────────┘  └──────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘

Browser ──HTTPS──► ALB ──► App Server ──► Keycloak (OIDC) ──► Back
```

---

## Prerequisites

- AWS account with admin access
- AWS CLI configured
- SSH key pair in your target region
- Route53 hosted zone (the template uses `iitc-course.com` by default)

---

## Phase 1: Deploy Infrastructure (10 minutes)

### Step 1.1: Set Environment Variables

```bash
export AWS_REGION=eu-central-1
export AWS_PROFILE=<your-profile>
```

### Step 1.2: Create a Key Pair (if needed)

```bash
aws ec2 create-key-pair \
  --key-name keycloak-lab-key \
  --query 'KeyMaterial' --output text > keycloak-lab-key.pem
chmod 400 keycloak-lab-key.pem
```

### Step 1.3: Deploy the Stack

```bash
aws cloudformation create-stack \
  --stack-name keycloak-lab \
  --template-body file://cloudformation/01-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=keycloak-lab-key \
  --capabilities CAPABILITY_NAMED_IAM

aws cloudformation wait stack-create-complete --stack-name keycloak-lab
```

### Step 1.4: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name keycloak-lab \
  --query 'Stacks[0].Outputs' --output table
```

The stack creates HTTPS URLs via ALB + ACM + Route53:

```bash
echo "Keycloak Admin Console: https://keycloak.iitc-course.com/admin"
echo "HR Portal App:          https://hr-portal.iitc-course.com"
```

Save the SSH IPs for later:

```bash
KEYCLOAK_SSH=$(aws cloudformation describe-stacks --stack-name keycloak-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`KeycloakServerSSH`].OutputValue' --output text)

APP_SSH=$(aws cloudformation describe-stacks --stack-name keycloak-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerSSH`].OutputValue' --output text)

echo "Keycloak SSH: $KEYCLOAK_SSH"
echo "App SSH: $APP_SSH"
```

### Step 1.5: Wait for Setup to Complete

The UserData scripts need a few minutes to install Docker, pull images, and start services.

```bash
# SSH to the Keycloak server (use the IP from the stack outputs)
ssh -i keycloak-lab-key.pem -o StrictHostKeyChecking=no ec2-user@<KEYCLOAK_IP> \
  'cat /home/ec2-user/setup-complete.txt 2>/dev/null || echo "Still setting up..."'

# Check Docker containers are running
ssh -i keycloak-lab-key.pem -o StrictHostKeyChecking=no ec2-user@<KEYCLOAK_IP> \
  'docker ps'
```

You should see two containers: `keycloak` and `keycloak-db`.

### Step 1.6: Verify Keycloak is Running

Open your browser and go to:

```
https://keycloak.iitc-course.com/admin
```

Login with:
- **Username:** `admin`
- **Password:** `KeycloakLab2024!`

> **Q1:** What is the "master" realm? Why should you NOT use it for your applications?

---

## Phase 2: Create a Realm (10 minutes)

A **Realm** is a tenant boundary in Keycloak. Each realm has its own users, roles, clients, and settings. Think of it as a completely isolated identity namespace.

### Step 2.1: Create the Demo Realm

1. In the Keycloak Admin Console, click the dropdown that says **"master"** (top-left)
2. Click **"Create Realm"**
3. Enter:
   - **Realm name:** `demo-realm`
4. Click **"Create"**

You should now see `demo-realm` as the active realm.

### Step 2.2: Explore the Realm Settings

Click **Realm Settings** in the left menu. Note:

- **General** — realm name, display name, HTML display name
- **Login** — user registration, forgot password, remember me
- **Email** — SMTP settings for email verification
- **Themes** — customize the login page appearance
- **Sessions** — SSO session timeouts
- **Tokens** — token lifespans (access token, refresh token)

> **Q2:** What is the default access token lifespan? Why would you want to keep it short?

> **Q3:** If you enable "User Registration", what security implications does that have?

---

## Phase 3: Create Roles (10 minutes)

Roles define **what users can do**. Keycloak supports two types:

| Type | Scope | Example |
|------|-------|---------|
| **Realm Roles** | Global across all clients in the realm | `admin`, `manager`, `employee` |
| **Client Roles** | Specific to one application | `demo-app:report-viewer` |

### Step 3.1: Create Realm Roles

1. In the left menu, click **Realm Roles**
2. Click **"Create role"**
3. Create these roles (one at a time):

| Role Name | Description |
|-----------|-------------|
| `employee` | Basic employee access — can view dashboard |
| `manager` | Manager access — can view salary data |
| `admin` | Admin access — can view system admin panel |

For each role:
- Enter the **Role name**
- Enter a **Description**
- Click **"Save"**

### Step 3.2: Verify Roles

Click **Realm Roles** again. You should see your 3 custom roles plus the default Keycloak roles (`default-roles-demo-realm`, `offline_access`, `uma_authorization`).

> **Q4:** What is the difference between realm roles and client roles? When would you use each?

---

## Phase 4: Create Users (15 minutes)

### Step 4.1: Create an Employee User

1. Click **Users** in the left menu
2. Click **"Create new user"**
3. Fill in:
   - **Username:** `alice`
   - **Email:** `alice@techcorp.com`
   - **First name:** `Alice`
   - **Last name:** `Johnson`
   - **Email verified:** toggle ON
4. Click **"Create"**

Set the password:
1. Click the **"Credentials"** tab
2. Click **"Set password"**
3. Enter password: `alice123`
4. Toggle **"Temporary"** to **OFF**
5. Click **"Save"** → **"Save password"**

Assign the role:
1. Click the **"Role mapping"** tab
2. Click **"Assign role"**
3. Select **"employee"**
4. Click **"Assign"**

### Step 4.2: Create a Manager User

Repeat the process:
- **Username:** `bob`
- **Email:** `bob@techcorp.com`
- **First name:** `Bob`
- **Last name:** `Smith`
- **Password:** `bob123` (Temporary: OFF)
- **Roles:** `employee` AND `manager`

### Step 4.3: Create an Admin User

- **Username:** `carol`
- **Email:** `carol@techcorp.com`
- **First name:** `Carol`
- **Last name:** `Williams`
- **Password:** `carol123` (Temporary: OFF)
- **Roles:** `employee`, `manager`, AND `admin`

### Step 4.4: Verify Users

Click **Users** → you should see 3 users: `alice`, `bob`, `carol`.

> **Q5:** Why did we give Carol all three roles? What would happen if she only had the `admin` role?

> **Q6:** In production, would you create users manually like this? What alternatives does Keycloak offer?

---

## Phase 5: Register the OIDC Client (15 minutes)

A **Client** in Keycloak represents an application that delegates authentication to Keycloak. Our HR Portal is an OIDC client.

### Step 5.1: Create the Client

1. Click **Clients** in the left menu
2. Click **"Create client"**
3. **General Settings:**
   - **Client type:** OpenID Connect
   - **Client ID:** `demo-app`
   - **Name:** `HR Portal`
4. Click **"Next"**
5. **Capability config:**
   - **Client authentication:** ON (this makes it a confidential client)
   - **Standard flow:** ON (Authorization Code Flow)
   - **Direct access grants:** ON (for testing with curl)
6. Click **"Next"**
7. **Login settings:**
   - **Root URL:** `https://hr-portal.iitc-course.com`
   - **Valid redirect URIs:** `https://hr-portal.iitc-course.com/*`
   - **Valid post logout redirect URIs:** `https://hr-portal.iitc-course.com/*`
   - **Web origins:** `https://hr-portal.iitc-course.com`
8. Click **"Save"**

### Step 5.2: Get the Client Secret

1. Click the **"Credentials"** tab
2. Copy the **Client secret** — you'll need this for the app configuration

Save it:
```bash
CLIENT_SECRET="<paste-the-secret-here>"
echo "Client Secret: $CLIENT_SECRET"
```

### Step 5.3: Configure Client Roles Mapping

To include roles in the ID token (so the app can read them):

1. Click the **"Client scopes"** tab
2. Click **"demo-app-dedicated"**
3. Click **"Configure a new mapper"**
4. Select **"User Realm Role"**
5. Configure:
   - **Name:** `realm-roles`
   - **Token Claim Name:** `realm_access.roles`
   - **Add to ID token:** ON
   - **Add to access token:** ON
   - **Add to userinfo:** ON
6. Click **"Save"**

> **Q7:** What is the difference between a "public" and "confidential" client? Which is more secure and why?

> **Q8:** What is a "redirect URI" and why is it important for security?

---

## Phase 6: Configure and Start the Application (10 minutes)

### Step 6.1: SSH to the App Server

```bash
# Use the App Server IP from the stack outputs
ssh -i keycloak-lab-key.pem -o StrictHostKeyChecking=no ec2-user@<APP_SERVER_IP>
```

### Step 6.2: Configure the Environment

```bash
cd /home/ec2-user/app

# Create the .env file
cat > .env <<EOF
KEYCLOAK_URL=https://keycloak.iitc-course.com
KEYCLOAK_REALM=demo-realm
KEYCLOAK_CLIENT_ID=demo-app
KEYCLOAK_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
APP_URL=https://hr-portal.iitc-course.com
EOF
```

Replace `<YOUR_CLIENT_SECRET>` with the client secret from Step 5.2.

### Step 6.3: Start the Application

```bash
# Start the app
node server.js &

# Verify it's running
curl -s http://localhost:3000 | head -5
```

You should see HTML output from the HR Portal.

> **Tip:** To run the app in the background persistently:
> ```bash
> nohup node server.js > app.log 2>&1 &
> ```

---

## Phase 7: Test Authentication & RBAC (20 minutes)

### Step 7.1: Access the HR Portal

Open your browser and go to:

```
https://hr-portal.iitc-course.com
```

You should see the HR Portal home page with a **"Sign In with Keycloak"** button.

### Step 7.2: Login as Alice (Employee)

1. Click **"Sign In with Keycloak"**
2. You'll be redirected to the Keycloak login page
3. Login with: `alice` / `alice123`
4. You'll be redirected back to the **Dashboard**

**Test access:**
- ✅ `/dashboard` — should work (Alice is an employee)
- ❌ `/salary` — should show **"Access Denied"** (Alice is not a manager)
- ❌ `/admin` — should show **"Access Denied"** (Alice is not an admin)

Click **Logout** when done.

### Step 7.3: Login as Bob (Manager)

1. Click **"Sign In with Keycloak"**
2. Login with: `bob` / `bob123`

**Test access:**
- ✅ `/dashboard` — should work
- ✅ `/salary` — should work (Bob is a manager)
- ❌ `/admin` — should show **"Access Denied"** (Bob is not an admin)

Click **Logout** when done.

### Step 7.4: Login as Carol (Admin)

1. Click **"Sign In with Keycloak"**
2. Login with: `carol` / `carol123`

**Test access:**
- ✅ `/dashboard` — should work
- ✅ `/salary` — should work (Carol is a manager AND admin)
- ✅ `/admin` — should work (Carol is an admin)

### Step 7.5: Examine the Token

While logged in as Carol, go to:

```
https://hr-portal.iitc-course.com/api/tokeninfo
```

This shows the raw ID token claims. Look for:
- `realm_access.roles` — the roles assigned to Carol
- `preferred_username` — the username
- `email` — the email address
- `iss` — the issuer (Keycloak URL)

> **Q9:** Look at the token. What is the `iss` (issuer) claim? Why is it important?

> **Q10:** What is the `exp` claim? What happens when the token expires?

> **Q11:** Compare the tokens for Alice, Bob, and Carol. What is different?

---

## Phase 8: Dynamic Role Changes (10 minutes)

This phase demonstrates that access control is **dynamic** — changing roles in Keycloak immediately affects what users can do.

### Step 8.1: Promote Alice to Manager

1. Go to the Keycloak Admin Console
2. Click **Users** → click **alice**
3. Click **"Role mapping"** tab
4. Click **"Assign role"**
5. Select **"manager"**
6. Click **"Assign"**

### Step 8.2: Test Alice's New Access

1. Go back to the HR Portal
2. Login as Alice (`alice` / `alice123`)
3. Try `/salary` — it should now **work**!

### Step 8.3: Revoke Bob's Manager Role

1. Go to the Keycloak Admin Console
2. Click **Users** → click **bob**
3. Click **"Role mapping"** tab
4. Select the **"manager"** role
5. Click **"Unassign"**

### Step 8.4: Test Bob's Reduced Access

1. Login as Bob in the HR Portal
2. Try `/salary` — it should now show **"Access Denied"**!

> **Q12:** How quickly did the role change take effect? Did Bob need to log out and back in?

> **Q13:** In a traditional application with hardcoded roles, how would you make this change? What are the risks?

---

## Phase 9: Explore OIDC Endpoints (10 minutes)

Keycloak exposes standard OIDC endpoints. Understanding these is key to integrating any application.

### Step 9.1: Discovery Endpoint

```bash
curl -s https://keycloak.iitc-course.com/realms/demo-realm/.well-known/openid-configuration | jq .
```

This returns all the OIDC endpoints. Key ones:

| Endpoint | Purpose |
|----------|---------|
| `authorization_endpoint` | Where users are redirected to login |
| `token_endpoint` | Where the app exchanges the auth code for tokens |
| `userinfo_endpoint` | Where the app gets user profile info |
| `jwks_uri` | Public keys for verifying token signatures |
| `end_session_endpoint` | Logout URL |

### Step 9.2: Get a Token via Direct Access (API)

```bash
# Get an access token for Alice using the password grant
TOKEN=$(curl -s -X POST "https://keycloak.iitc-course.com/realms/demo-realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=demo-app" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "username=alice" \
  -d "password=alice123" | jq -r '.access_token')

echo "Token: ${TOKEN:0:50}..."
```

### Step 9.3: Decode the Token

```bash
# Decode the JWT payload (middle part)
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

Look at the claims — you'll see Alice's roles, email, and other profile information embedded in the token.

### Step 9.4: Call the UserInfo Endpoint

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://keycloak.iitc-course.com/realms/demo-realm/protocol/openid-connect/userinfo" | jq .
```

> **Q14:** What is the difference between getting user info from the ID token vs. calling the userinfo endpoint?

> **Q15:** What is a JWKS (JSON Web Key Set)? How does the application verify that a token is legitimate?

---

## Phase 10: Investigation Questions

> **Q16:** Compare Keycloak to AWS Cognito. When would you use each? What are the trade-offs?

> **Q17:** Your company acquires another company. How would you use Keycloak realms to manage both sets of users while keeping them isolated?

> **Q18:** A developer asks you to add Google login to the HR Portal. What Keycloak feature would you use? What configuration is needed?

> **Q19:** An auditor asks: "How do you know who accessed the salary page last Tuesday?" How would you answer using Keycloak's features?

> **Q20:** What is the security risk of using `start-dev` mode in production? What should you do instead?

---

## Phase 11: Cleanup ⚠️

```bash
# 1. Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name keycloak-lab

aws cloudformation wait stack-delete-complete --stack-name keycloak-lab

# 2. Delete the key pair
aws ec2 delete-key-pair --key-name keycloak-lab-key
rm -f keycloak-lab-key.pem

echo "Cleanup complete!"
```

---

## Answer Key

<details>
<summary>Click to reveal answers (try on your own first!)</summary>

**Q1:** The `master` realm is the default administrative realm. It should only be used for managing Keycloak itself (creating other realms, managing global settings). Application users should always be in their own realm to maintain isolation and security boundaries.

**Q2:** The default access token lifespan is 5 minutes. Short lifespans limit the window of exposure if a token is stolen. The application uses refresh tokens to get new access tokens without requiring the user to log in again.

**Q3:** Enabling user registration allows anyone to create an account in your realm. This is fine for public-facing apps but dangerous for internal corporate apps — you'd want to control who can create accounts. In production, you might enable it but add email verification and admin approval.

**Q4:** Realm roles are global — they apply across all clients in the realm (e.g., `admin` means admin everywhere). Client roles are scoped to a specific application (e.g., `demo-app:report-viewer` only applies to the HR Portal). Use client roles when different apps need different permission models.

**Q5:** We gave Carol all three roles because our app checks for specific roles. If she only had `admin`, she could access `/admin` but not `/salary` (which requires `manager`). However, our app code also grants admin users access to manager pages — this is a design choice. The principle of least privilege suggests giving only the roles needed.

**Q6:** In production, you would NOT create users manually. Keycloak supports: User Federation (sync from LDAP/Active Directory), Identity Brokering (login with Google/GitHub/Azure AD), Self-Registration with approval workflows, and SCIM provisioning from HR systems.

**Q7:** A **public** client cannot keep a secret (e.g., a browser SPA — the code is visible). A **confidential** client can securely store a secret (e.g., a server-side app). Confidential clients are more secure because the token exchange requires the client secret, preventing stolen authorization codes from being used.

**Q8:** A redirect URI is where Keycloak sends the user after authentication. It's critical for security — without strict validation, an attacker could register a malicious redirect URI and steal the authorization code. Always use exact URIs, never wildcards in production.

**Q9:** The `iss` (issuer) claim identifies which Keycloak realm issued the token. The application MUST verify this matches the expected issuer to prevent tokens from other realms or IdPs from being accepted.

**Q10:** The `exp` claim is the token expiration timestamp (Unix epoch). When expired, the application must reject the token. The user needs to re-authenticate or use a refresh token to get a new access token.

**Q11:** The tokens differ in the `realm_access.roles` claim: Alice has `[employee]`, Bob has `[employee, manager]`, Carol has `[employee, manager, admin]`. The `sub` (subject), `preferred_username`, and `email` claims are also different.

**Q12:** The role change takes effect on the **next login** or when the token is refreshed. If Bob has an active session with a valid token, he keeps access until the token expires. This is why short token lifespans are important.

**Q13:** In a traditional app with hardcoded roles (e.g., in a database), you'd need to: modify the database, possibly restart the app, and hope the change propagates correctly. With Keycloak, the change is centralized and applies to all applications that use the realm.

**Q14:** The ID token is received during login and may become stale. The userinfo endpoint always returns the latest data from Keycloak. However, calling the endpoint adds latency. Best practice: use the ID token for initial authentication, call userinfo only when you need fresh data.

**Q15:** JWKS is a set of public keys published by Keycloak. The application downloads these keys and uses them to verify the digital signature on JWT tokens. This proves the token was issued by Keycloak and hasn't been tampered with — without needing to call Keycloak for every request.

**Q16:** **Keycloak:** Open source, self-hosted, full control, supports SAML + OIDC, user federation, customizable themes. Best for: on-prem, multi-cloud, complex requirements. **AWS Cognito:** Managed service, pay-per-use, integrates with AWS services, less customizable. Best for: AWS-native apps, simpler requirements, no infrastructure management. Trade-off: control vs. convenience.

**Q17:** Create a separate realm for each company. Each realm has its own users, roles, and clients. If you need cross-realm access, use Identity Brokering — one realm trusts the other as an external IdP. This maintains isolation while enabling collaboration.

**Q18:** Use Keycloak's **Identity Brokering** feature. In the realm settings, add Google as an Identity Provider (under "Identity Providers" → "Google"). You'll need a Google OAuth client ID and secret from the Google Cloud Console. Users will see a "Login with Google" button on the Keycloak login page.

**Q19:** Keycloak has built-in **Events** logging. Go to Realm Settings → Events → enable Login Events and Admin Events. You can then query events by user, type (LOGIN, LOGOUT, etc.), date range, and client. For the salary page specifically, the application should also log access attempts.

**Q20:** `start-dev` mode disables HTTPS, uses an H2 in-memory database, enables hot-reload, and relaxes security settings. In production, you must: use `start` (production mode), configure a proper database (PostgreSQL), enable HTTPS with real certificates, set proper hostnames, and configure reverse proxy headers.

</details>

---
