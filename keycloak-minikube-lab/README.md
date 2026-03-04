# Keycloak on Minikube with Terraform

## Overview

This lab deploys **Keycloak** on a local **Minikube** Kubernetes cluster using **Terraform**. The entire stack — cluster, Keycloak, realm configuration, users, roles, OIDC client, and a sample HR Portal app — is provisioned as Infrastructure as Code.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                Minikube Cluster                      │
│                                                      │
│  Namespace: keycloak          Namespace: hr-portal   │
│  ┌─────────────────────┐     ┌────────────────────┐  │
│  │ Keycloak (Helm)     │     │ HR Portal (Node.js)│  │
│  │  - Keycloak Pod     │◄───►│  - OIDC protected  │  │
│  │  - PostgreSQL Pod   │     │  - RBAC enforced   │  │
│  │  NodePort: 30080    │     │  NodePort: 30300   │  │
│  └─────────────────────┘     └────────────────────┘  │
│                                                      │
│  Keycloak Config (Terraform keycloak provider):      │
│  - Realm: demo-realm                                 │
│  - Users: alice, bob, carol                          │
│  - Roles: employee, manager, admin                   │
│  - Client: demo-app (OIDC)                           │
└─────────────────────────────────────────────────────┘

Terraform provisions everything:
  minikube provider → cluster
  helm provider     → Keycloak + PostgreSQL
  kubernetes provider → app deployment
  keycloak provider → realm, users, roles, client
```

## Prerequisites

- **Docker Desktop** running
- **Minikube** (`brew install minikube`)
- **Terraform** >= 1.5 (`brew install terraform`)
- **kubectl** (`brew install kubectl`)

## Quick Start

```bash
cd terraform

# 1. Initialize Terraform
terraform init

# 2. Deploy everything (takes ~5 minutes)
terraform apply -auto-approve

# 3. Start minikube tunnel (in a separate terminal)
minikube tunnel -p keycloak-lab

# 4. Access the services
echo "Keycloak Admin: http://localhost:30080/admin"
echo "HR Portal:      http://localhost:30300"
```

## Terraform Resources Created

| Provider | Resource | Purpose |
|----------|----------|---------|
| `minikube` | `minikube_cluster` | Local K8s cluster |
| `kubernetes` | `namespace` x2 | `keycloak` and `hr-portal` namespaces |
| `helm` | `helm_release` | Keycloak + PostgreSQL via Bitnami chart |
| `keycloak` | `keycloak_realm` | `demo-realm` |
| `keycloak` | `keycloak_role` x3 | employee, manager, admin |
| `keycloak` | `keycloak_user` x3 | alice, bob, carol |
| `keycloak` | `keycloak_user_roles` x3 | Role assignments |
| `keycloak` | `keycloak_openid_client` | `demo-app` OIDC client |
| `kubernetes` | `deployment` + `service` | HR Portal app |

## Lab Users

| User | Password | Roles | Access |
|------|----------|-------|--------|
| alice | alice123 | employee | `/dashboard` |
| bob | bob123 | employee, manager | `/dashboard`, `/salary` |
| carol | carol123 | employee, manager, admin | Everything |

## Project Structure

```
keycloak-minikube-lab/
├── terraform/
│   ├── providers.tf          # Provider configuration
│   ├── variables.tf          # Input variables
│   ├── main.tf               # Minikube cluster + namespaces
│   ├── keycloak.tf           # Keycloak Helm deployment
│   ├── keycloak-config.tf    # Realm, users, roles, client
│   ├── app.tf                # HR Portal K8s deployment
│   ├── outputs.tf            # Output URLs and credentials
│   └── app/
│       └── server.js         # HR Portal application code
├── scripts/
│   └── validate.sh           # Validation script
├── student-lab-guide/
│   └── LAB-MANUAL.md         # Step-by-step lab instructions
├── README.md
└── .gitignore
```

## Cleanup

```bash
cd terraform
terraform destroy -auto-approve
minikube delete -p keycloak-lab
```

## Troubleshooting

- **Keycloak pod not ready:** It takes 2-3 minutes to start. Check with `kubectl get pods -n keycloak`
- **Terraform keycloak provider fails:** Keycloak must be fully running first. Run `terraform apply` again after Keycloak is ready.
- **Port already in use:** Change `keycloak_node_port` or `app_node_port` in `variables.tf`
- **Minikube tunnel required:** NodePort services need `minikube tunnel` or use `minikube service` to access them
