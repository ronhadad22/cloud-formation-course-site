# Jenkins on EKS Auto Mode

Quick guide to deploy Jenkins with persistent storage on EKS Auto Mode clusters.

## Prerequisites

- EKS Auto Mode cluster
- kubectl configured
- Helm installed

## Deployment

### 1. Create StorageClass
```bash
kubectl apply -f sc.yaml
```

### 2. Install Jenkins
```bash
helm repo add jenkinsci https://charts.jenkins.io
helm repo update
helm install jenkins jenkinsci/jenkins -n jenkins -f jenkins-values.yaml --create-namespace
```

### 3. Access Jenkins
```bash
# Port forward
kubectl port-forward svc/jenkins 8080:8080 -n jenkins

# Get admin password
kubectl exec --namespace jenkins -it svc/jenkins -c jenkins -- /bin/cat /run/secrets/additional/chart-admin-password && echo
```

### 4. Login
- **URL**: http://localhost:8080
- **Username**: `admin`
- **Password**: (from step 3)

## Key Files

- `sc.yaml` - StorageClass with EKS Auto Mode provisioner
- `jenkins-values.yaml` - Helm values with storage configuration

## Important Notes

- Uses `ebs.csi.eks.amazonaws.com` provisioner (required for EKS Auto Mode)
- Storage class uses `WaitForFirstConsumer` binding mode
- Karpenter automatically provisions nodes as needed

## Troubleshooting

If PVC is stuck pending:
```bash
kubectl describe pvc jenkins -n jenkins
kubectl get events -n jenkins --sort-by='.lastTimestamp'
```
