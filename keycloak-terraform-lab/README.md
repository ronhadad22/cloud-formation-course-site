# Keycloak + Terraform Lab

Deploy Keycloak on AWS with CloudFormation, then configure it programmatically using the **Terraform Keycloak Provider**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                            │
│                                                             │
│  Route53 (*.iitc-course.com)                                │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐   ACM Cert (HTTPS)                             │
│  │   ALB   │◄──────────────────                             │
│  └────┬────┘                                                │
│       │  Host-based routing                                 │
│       ├──────────────────────────────────┐                  │
│       ▼                                  ▼                  │
│  keycloak-tf.iitc-course.com    hr-portal-tf.iitc-course.com│
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │  EC2 (t3.medium)  │           │  EC2 (t3.micro)  │        │
│  │  Docker Compose   │           │  Node.js App     │        │
│  │  ┌──────────────┐│           │  (HR Portal)     │        │
│  │  │  Keycloak    ││           └──────────────────┘        │
│  │  │  26.0        ││                                       │
│  │  ├──────────────┤│                                       │
│  │  │  PostgreSQL  ││                                       │
│  │  │  16-alpine   ││                                       │
│  │  └──────────────┘│                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘

Terraform Keycloak Provider (runs from your laptop):
  → Creates realm, roles, users, OIDC client
  → Outputs client_secret for the app
```

## What Students Learn

1. **CloudFormation** — VPC, ALB, ACM, Route53, EC2 infrastructure
2. **Docker Compose** — Running Keycloak + PostgreSQL on EC2
3. **Terraform Keycloak Provider** — Programmatic IdP configuration
4. **OIDC/OAuth2** — Authentication flow with a real web app
5. **RBAC** — Role-based access control via Keycloak roles

## Prerequisites

- AWS account with Route53 hosted zone
- AWS CLI configured (`aws configure`)
- Terraform >= 1.5.0
- EC2 Key Pair
- jq

## Quick Start

### Option A: Automated (deploy script)

```bash
cd keycloak-terraform-lab
./scripts/deploy.sh
```

### Option B: Manual (step by step)

**Phase 1 — Deploy Infrastructure (CloudFormation)**

```bash
aws cloudformation deploy \
  --stack-name keycloak-tf-lab \
  --template-file cloudformation/01-infrastructure.yaml \
  --parameter-overrides KeyPairName=<your-key> \
  --capabilities CAPABILITY_NAMED_IAM
```

Wait 5–10 minutes for Keycloak to start. Verify:

```bash
curl -s https://keycloak-tf.iitc-course.com/realms/master | jq .realm
```

**Phase 2 — Configure Keycloak (Terraform)**

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars if needed

terraform init
terraform apply
```

This creates:
- **Realm**: `demo-realm`
- **Roles**: `employee`, `manager`, `admin`
- **Users**: `alice` (employee), `bob` (employee+manager), `carol` (all roles)
- **OIDC Client**: `demo-app` with client secret

**Phase 3 — Configure & Start the App**

```bash
# Get the client secret
CLIENT_SECRET=$(terraform output -raw client_secret)

# SSH to app server and create .env
ssh -i <key>.pem ec2-user@<app-server-ip>

cat > /home/ec2-user/app/.env <<EOF
KEYCLOAK_URL=https://keycloak-tf.iitc-course.com
KEYCLOAK_REALM=demo-realm
KEYCLOAK_CLIENT_ID=demo-app
KEYCLOAK_CLIENT_SECRET=$CLIENT_SECRET
APP_URL=https://hr-portal-tf.iitc-course.com
EOF

cd /home/ec2-user/app
node server.js &
```

**Phase 4 — Test**

Open https://hr-portal-tf.iitc-course.com and sign in:

| User  | Password  | Roles                      | Access                    |
|-------|-----------|----------------------------|---------------------------|
| alice | alice123  | employee                   | Dashboard only            |
| bob   | bob123    | employee, manager          | Dashboard + Salary        |
| carol | carol123  | employee, manager, admin   | Dashboard + Salary + Admin|

## Validation

```bash
./scripts/validate.sh
```

## Cleanup

```bash
./scripts/cleanup.sh
```

Or manually:

```bash
cd terraform && terraform destroy
aws cloudformation delete-stack --stack-name keycloak-tf-lab
```

## Project Structure

```
keycloak-terraform-lab/
├── cloudformation/
│   └── 01-infrastructure.yaml    # VPC, ALB, ACM, Route53, EC2s
├── terraform/
│   ├── providers.tf              # Keycloak provider config
│   ├── variables.tf              # Input variables
│   ├── keycloak-config.tf        # Realm, roles, users, client
│   ├── outputs.tf                # Client secret, .env output
│   └── terraform.tfvars.example  # Example variable values
├── scripts/
│   ├── deploy.sh                 # Automated full deployment
│   ├── validate.sh               # Validation checks
│   └── cleanup.sh                # Tear down everything
├── student-lab-guide/
│   └── LAB-MANUAL.md             # Step-by-step student guide
├── .gitignore
└── README.md
```

## Estimated Cost

| Resource       | Type        | ~Cost/hour |
|----------------|-------------|------------|
| EC2 Keycloak   | t3.medium   | $0.042     |
| EC2 App Server | t3.micro    | $0.010     |
| ALB            | Application | $0.023     |
| Route53        | Hosted Zone | negligible |
| ACM            | Certificate | Free       |
| **Total**      |             | **~$0.08/hr** |

## Troubleshooting

- **ACM cert pending**: Wait 5–10 min for DNS validation
- **Keycloak not ready**: Check `ssh ec2-user@<ip> 'cat /var/log/keycloak-setup.log'`
- **Terraform can't connect**: Ensure Keycloak is reachable at the URL
- **App login fails**: Verify `.env` has correct `KEYCLOAK_CLIENT_SECRET`
- **Redirect URI mismatch**: Ensure `APP_URL` in `.env` matches Terraform `app_url`
