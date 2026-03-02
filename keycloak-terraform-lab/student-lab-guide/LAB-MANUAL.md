# Keycloak + Terraform Lab — Student Manual

## Lab Overview

In this lab you will:
1. Deploy AWS infrastructure using **CloudFormation** (VPC, ALB, ACM, Route53, EC2)
2. Run **Keycloak** (Identity Provider) on EC2 via Docker Compose
3. Use the **Terraform Keycloak Provider** to programmatically configure:
   - A realm, roles, users, and an OIDC client
4. Connect a **Node.js HR Portal** app to Keycloak using OpenID Connect
5. Test **role-based access control** (RBAC) with different users

### Architecture

```
Internet
   │
   ▼
Route53 DNS (*.iitc-course.com)
   │
   ▼
┌──────────────────────────────────────────────┐
│  ALB (HTTPS via ACM wildcard certificate)    │
│  Host-based routing:                         │
│    keycloak-tf.iitc-course.com → EC2:8080    │
│    hr-portal-tf.iitc-course.com → EC2:3000   │
└──────────┬───────────────┬───────────────────┘
           │               │
    ┌──────▼──────┐  ┌─────▼──────┐
    │  Keycloak   │  │  HR Portal │
    │  EC2        │  │  EC2       │
    │  (Docker    │  │  (Node.js) │
    │   Compose)  │  │            │
    └─────────────┘  └────────────┘

Your laptop runs Terraform to configure Keycloak remotely.
```

### Test Users (created by Terraform)

| User  | Password  | Roles                    | App Access                |
|-------|-----------|--------------------------|---------------------------|
| alice | alice123  | employee                 | Dashboard only            |
| bob   | bob123    | employee, manager        | Dashboard + Salary        |
| carol | carol123  | employee, manager, admin | Dashboard + Salary + Admin|

---

## Prerequisites

- AWS account with console access
- AWS CLI installed and configured (`aws configure`)
- Terraform >= 1.5.0 installed
- An EC2 Key Pair in your region
- Route53 hosted zone for your domain
- `jq` installed (`brew install jq` on macOS)

---

## Phase 1: Deploy AWS Infrastructure

### Step 1.1 — Clone the Repository

```bash
git clone <repo-url>
cd keycloak-terraform-lab
```

### Step 1.2 — Review the CloudFormation Template

Open `cloudformation/01-infrastructure.yaml` and study:

- **VPC** with 2 public subnets (required for ALB)
- **ALB** with HTTPS listener (ACM certificate)
- **Route53** DNS records pointing to the ALB
- **Security Groups** restricting traffic (ALB → EC2 only)
- **Keycloak EC2** with Docker Compose in UserData
- **App Server EC2** with Node.js in UserData

> **Discussion**: Why do we need 2 subnets for the ALB? Why does Keycloak need `KC_PROXY_HEADERS: xforwarded`?

### Step 1.3 — Deploy the Stack

```bash
aws cloudformation deploy \
  --stack-name keycloak-tf-lab \
  --template-file cloudformation/01-infrastructure.yaml \
  --parameter-overrides KeyPairName=<YOUR_KEY_PAIR_NAME> \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

This takes **5–10 minutes** (ACM DNS validation + EC2 setup).

### Step 1.4 — Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name keycloak-tf-lab \
  --query 'Stacks[0].Outputs' \
  --output table
```

Note down:
- **KeycloakURL** — Keycloak admin console
- **AppURL** — HR Portal URL
- **KeycloakServerIP** — For SSH debugging
- **AppServerIP** — For SSH and app configuration

### Step 1.5 — Verify Keycloak is Running

Wait 3–5 minutes after stack creation, then:

```bash
curl -s https://keycloak-tf.iitc-course.com/realms/master | jq .realm
```

Expected output: `"master"`

If it fails, SSH into the Keycloak server and check logs:

```bash
ssh -i <key>.pem ec2-user@<KeycloakServerIP>
cat /var/log/keycloak-setup.log
docker ps
docker logs keycloak
```

### Step 1.6 — Access Keycloak Admin Console

Open https://keycloak-tf.iitc-course.com/admin in your browser.

Login with:
- **Username**: `admin`
- **Password**: `KeycloakLab2024!`

> **Explore**: Look around the admin console. Notice there's only the `master` realm. We'll create everything else with Terraform!

---

## Phase 2: Configure Keycloak with Terraform

### Step 2.1 — Review the Terraform Files

```bash
cd terraform
```

Study these files:

| File | Purpose |
|------|---------|
| `providers.tf` | Configures the `mrparkers/keycloak` Terraform provider |
| `variables.tf` | Input variables (Keycloak URL, credentials, app URL) |
| `keycloak-config.tf` | Realm, roles, users, OIDC client, protocol mapper |
| `outputs.tf` | Client secret and .env configuration for the app |

> **Discussion**: What is the Keycloak Terraform provider? How does it communicate with Keycloak? (Answer: It uses the Keycloak Admin REST API)

### Step 2.2 — Create terraform.tfvars

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
keycloak_url            = "https://keycloak-tf.iitc-course.com"
keycloak_admin_user     = "admin"
keycloak_admin_password = "KeycloakLab2024!"
app_url                 = "https://hr-portal-tf.iitc-course.com"
```

### Step 2.3 — Initialize Terraform

```bash
terraform init
```

This downloads the Keycloak provider plugin.

### Step 2.4 — Plan

```bash
terraform plan
```

Review the plan. You should see **~14 resources** to create:
- 1 realm
- 3 roles
- 3 users
- 3 role assignments
- 1 OIDC client
- 1 protocol mapper

> **Discussion**: Why is the OIDC client type `CONFIDENTIAL`? What's the difference from `PUBLIC`?

### Step 2.5 — Apply

```bash
terraform apply
```

Type `yes` to confirm.

### Step 2.6 — Verify in Keycloak Admin Console

Go back to https://keycloak-tf.iitc-course.com/admin and:

1. Switch to **demo-realm** (dropdown in the top-left)
2. Go to **Users** → You should see alice, bob, carol
3. Go to **Realm roles** → You should see employee, manager, admin
4. Go to **Clients** → You should see `demo-app`
5. Click `demo-app` → **Credentials** tab → Note the client secret

> **Key Insight**: Everything you see in the admin console was created by Terraform, not manually!

### Step 2.7 — Get the Client Secret

```bash
terraform output -raw client_secret
```

Save this value — you'll need it for the app.

---

## Phase 3: Configure and Start the HR Portal

### Step 3.1 — SSH to the App Server

```bash
ssh -i <key>.pem ec2-user@<AppServerIP>
```

### Step 3.2 — Verify Setup Completed

```bash
cat /home/ec2-user/setup-complete.txt
# Should say: "App server setup complete"

ls /home/ec2-user/app/
# Should show: node_modules/  package.json  server.js  .env.template
```

### Step 3.3 — Create the .env File

```bash
cd /home/ec2-user/app

cat > .env <<EOF
KEYCLOAK_URL=https://keycloak-tf.iitc-course.com
KEYCLOAK_REALM=demo-realm
KEYCLOAK_CLIENT_ID=demo-app
KEYCLOAK_CLIENT_SECRET=<PASTE_CLIENT_SECRET_HERE>
APP_URL=https://hr-portal-tf.iitc-course.com
EOF
```

Replace `<PASTE_CLIENT_SECRET_HERE>` with the value from Step 2.7.

### Step 3.4 — Start the Application

```bash
cd /home/ec2-user/app
nohup node server.js > app.log 2>&1 &
```

Verify it's running:

```bash
curl -s http://localhost:3000 | head -20
```

---

## Phase 4: Test the Application

### Step 4.1 — Open the HR Portal

Open https://hr-portal-tf.iitc-course.com in your browser.

You should see the HR Portal home page with a "Sign In with Keycloak" button.

### Step 4.2 — Test as Alice (Employee)

1. Click **Sign In with Keycloak**
2. You'll be redirected to the Keycloak login page
3. Login: `alice` / `alice123`
4. You'll be redirected back to the **Dashboard**
5. Note Alice's roles: `employee`
6. Try clicking **Salary** → You should see **Access Denied**
7. Try clicking **Admin** → You should see **Access Denied**
8. Click **Logout**

### Step 4.3 — Test as Bob (Manager)

1. Click **Sign In with Keycloak**
2. Login: `bob` / `bob123`
3. Note Bob's roles: `employee`, `manager`
4. Click **Salary** → You should see the salary table ✓
5. Click **Admin** → You should see **Access Denied**
6. Click **Logout**

### Step 4.4 — Test as Carol (Admin)

1. Click **Sign In with Keycloak**
2. Login: `carol` / `carol123`
3. Note Carol's roles: `employee`, `manager`, `admin`
4. Click **Salary** → You should see the salary table ✓
5. Click **Admin** → You should see the admin panel ✓
6. Click **Logout**

### Step 4.5 — Inspect the Token

While logged in as any user, visit:

```
https://hr-portal-tf.iitc-course.com/api/tokeninfo
```

This shows the raw OIDC token claims including:
- `realm_access.roles` — The user's realm roles
- `iss` — The token issuer (Keycloak URL)
- `sub` — The user's unique ID
- `preferred_username` — The username

> **Discussion**: What is the difference between an ID token and an access token? Which one contains the roles?

---

## Phase 5: Explore Terraform State

### Step 5.1 — View Terraform State

```bash
cd terraform
terraform state list
```

This shows all Keycloak resources managed by Terraform.

### Step 5.2 — Inspect a Resource

```bash
terraform state show keycloak_openid_client.hr_portal
```

### Step 5.3 — Make a Change

Try adding a new user via Terraform. Add to `keycloak-config.tf`:

```hcl
resource "keycloak_user" "dave" {
  realm_id       = keycloak_realm.demo.id
  username       = "dave"
  enabled        = true
  email          = "dave@techcorp.com"
  email_verified = true
  first_name     = "Dave"
  last_name      = "Wilson"

  initial_password {
    value     = "dave123"
    temporary = false
  }
}

resource "keycloak_user_roles" "dave_roles" {
  realm_id = keycloak_realm.demo.id
  user_id  = keycloak_user.dave.id
  role_ids = [keycloak_role.employee.id, keycloak_role.manager.id]
}
```

Then:

```bash
terraform plan   # See what will change
terraform apply  # Apply the change
```

Now login as `dave` / `dave123` in the HR Portal!

> **Key Insight**: Infrastructure as Code means you can version-control your IdP configuration, review changes in PRs, and reproduce environments consistently.

---

## Phase 6: Validation

Run the validation script from your laptop:

```bash
cd keycloak-terraform-lab
./scripts/validate.sh
```

Expected output: All checks pass ✓

---

## Phase 7: Cleanup

```bash
# Option A: Automated
./scripts/cleanup.sh

# Option B: Manual
cd terraform && terraform destroy
aws cloudformation delete-stack --stack-name keycloak-tf-lab
```

---

## Challenge Exercises

1. **Enable self-registration**: In Terraform, set `registration_allowed = true` on the realm. Test signing up a new user.

2. **Add client roles**: Create client-specific roles (not realm roles) and assign them to users.

3. **Add a second app**: Create another OIDC client in Terraform for a "Finance Portal" and deploy it.

4. **Import existing config**: If you manually created a user in the Keycloak admin console, use `terraform import` to bring it under Terraform management.

5. **Token inspection**: Use https://jwt.io to decode the access token and understand all the claims.

---

## Key Concepts Summary

| Concept | Description |
|---------|-------------|
| **Realm** | A tenant in Keycloak — isolated set of users, roles, clients |
| **OIDC Client** | An application registered with Keycloak for authentication |
| **Confidential Client** | Client that has a secret (server-side apps) |
| **Realm Role** | A role defined at the realm level, shared across clients |
| **Protocol Mapper** | Maps user attributes/roles into token claims |
| **Terraform Provider** | Plugin that lets Terraform manage external resources (Keycloak) |
| **ALB + ACM** | AWS load balancer with managed TLS certificate |
| **RBAC** | Role-Based Access Control — permissions based on roles |
