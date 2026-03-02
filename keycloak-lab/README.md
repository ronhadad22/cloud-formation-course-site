# Keycloak Identity & Access Management Lab

## Overview

This hands-on lab teaches students how to deploy and configure **Keycloak** as a centralized Identity Provider (IdP) on AWS. Students will protect a sample **HR Portal** web application using **OpenID Connect (OIDC)** and implement **Role-Based Access Control (RBAC)**.

## Architecture

```
        Browser (HTTPS)
             │
    ┌────────▼──────────────────────────────────────┐
    │  Route53 DNS  →  ALB (HTTPS, ACM cert)   │
    │  keycloak.iitc-course.com                 │
    │  hr-portal.iitc-course.com                │
    └───────┬───────────────────┬──────────────────┘
            │ Host-based routing  │
    ┌───────▼───────────┐ ┌───▼──────────────┐
    │ Keycloak Server   │ │ App Server        │
    │ (t3.medium)       │ │ (t3.micro)        │
    │ Docker:           │ │ Node.js:          │
    │  - Keycloak :8080 │ │  - HR Portal :3000│
    │  - PostgreSQL     │ │  - OIDC protected │
    └───────────────────┘ └──────────────────┘
```

## Learning Objectives

- Deploy Keycloak with Docker and PostgreSQL on AWS
- Create Realms, Users, Roles, and OIDC Clients
- Understand the OIDC Authorization Code Flow
- Implement RBAC in a web application
- Test dynamic role assignment and revocation
- Explore OIDC discovery endpoints and JWT tokens

## Prerequisites

- AWS account with admin access
- AWS CLI configured with appropriate profile
- SSH key pair in your target region
- Route53 hosted zone (default: `iitc-course.com`)

## Quick Start

```bash
# 1. Deploy infrastructure
aws cloudformation create-stack \
  --stack-name keycloak-lab \
  --template-body file://cloudformation/01-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=keycloak-lab-key \
  --capabilities CAPABILITY_NAMED_IAM

# 2. Wait for stack creation
aws cloudformation wait stack-create-complete --stack-name keycloak-lab

# 3. Get outputs
aws cloudformation describe-stacks --stack-name keycloak-lab \
  --query 'Stacks[0].Outputs' --output table

# 4. Follow the lab manual in student-lab-guide/LAB-MANUAL.md
```

## Project Structure

```
keycloak-lab/
├── cloudformation/
│   └── 01-infrastructure.yaml    # VPC, EC2 instances, security groups
├── student-lab-guide/
│   └── LAB-MANUAL.md             # Step-by-step lab instructions
├── scripts/
│   └── validate-keycloak.sh      # Validation script
├── README.md
└── .gitignore
```

## Estimated Cost

| Resource | Cost |
|----------|------|
| Keycloak Server (t3.medium) | ~$0.04/hr |
| App Server (t3.micro) | ~$0.01/hr |
| Application Load Balancer | ~$0.02/hr |
| **Total for 2-hour lab** | **~$0.14** |

**⚠️ Clean up after the lab! Delete the CloudFormation stack when done.**

## Troubleshooting

- **Keycloak not starting:** Wait 3-5 minutes for Docker to pull images. Check with `docker ps` on the Keycloak instance.
- **"Invalid redirect URI" error:** Ensure the redirect URI in the Keycloak client matches `https://hr-portal.iitc-course.com/*` exactly.
- **Roles not appearing in token:** Configure the "User Realm Role" mapper in the client's dedicated scope (see Phase 5.3 in the lab manual).
- **App can't connect to Keycloak:** Verify the `.env` file uses `https://keycloak.iitc-course.com` and the correct client secret.
- **502/503 errors:** Keycloak may still be starting. Wait a minute and try again.
- **ACM cert pending:** The wildcard certificate validates via DNS automatically. If stuck, check the ACM console for CNAME validation records.
