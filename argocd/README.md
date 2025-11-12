# ArgoCD on EKS Auto Mode

Quick guide to deploy ArgoCD on EKS Auto Mode clusters.

## Prerequisites

- EKS Auto Mode cluster
- kubectl configured
- Helm installed

## Deployment

### 1. Add Helm Repository
```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
```

### 2. Install ArgoCD
```bash
helm install argocd argo/argo-cd -n argocd -f argocd-values.yaml --create-namespace
```

### 3. Access ArgoCD
```bash
# Port forward (HTTP - insecure mode)
kubectl port-forward service/argocd-server -n argocd 8081:80

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
```

### 4. Login
- **URL**: http://localhost:8081 (HTTP, not HTTPS)
- **Username**: `admin`
- **Password**: (from step 3)

## Current Access Info
- **URL**: http://localhost:8081
- **Username**: `admin`
- **Password**: `EBiZ-PcyqoSjsjfp`

## Key Features
- Insecure mode enabled for easier setup
- LoadBalancer service type
- Resource limits optimized for EKS Auto Mode
- Separate namespace: `argocd`

## Security Note
Delete the initial admin secret after first login:
```bash
kubectl -n argocd delete secret argocd-initial-admin-secret
```
