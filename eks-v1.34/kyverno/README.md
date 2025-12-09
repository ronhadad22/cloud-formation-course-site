# Kyverno - Kubernetes Policy Engine

Kyverno is a policy engine designed for Kubernetes. It can validate, mutate, and generate configurations using admission controls and background scans.

## Prerequisites

- EKS cluster running
- kubectl configured
- Helm 3.x installed

## Installation

### Quick Start

```bash
./install-kyverno.sh
```

### Manual Installation

1. Add Helm repository:
```bash
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
```

2. Install Kyverno:
```bash
helm install kyverno kyverno/kyverno \
    --namespace kyverno \
    --create-namespace \
    --values kyverno-values.yaml
```

## Configuration

The `kyverno-values.yaml` file includes:

- **High Availability**: 2 replicas for admission controller
- **Resource Limits**: Optimized for production use
- **Features Enabled**:
  - Admission reports
  - Background scanning
  - Policy exceptions
  - ConfigMap caching

## Verify Installation

Check Kyverno components:
```bash
kubectl get pods -n kyverno
kubectl get deployments -n kyverno
```

Check Kyverno version:
```bash
kubectl get deployment kyverno-admission-controller -n kyverno -o jsonpath='{.spec.template.spec.containers[0].image}'
```

## Sample Policies

### Example 1: Require Labels

Create a policy that requires all pods to have specific labels:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-labels
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-for-labels
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Labels 'app' and 'env' are required"
        pattern:
          metadata:
            labels:
              app: "?*"
              env: "?*"
```

### Example 2: Disallow Latest Tag

Prevent using the `latest` tag in container images:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce
  rules:
    - name: require-image-tag
      match:
        any:
          - resources:
              kinds:
                - Pod
      validate:
        message: "Using 'latest' tag is not allowed"
        pattern:
          spec:
            containers:
              - image: "!*:latest"
```

### Example 3: Add Default Network Policy

Automatically generate a default network policy for new namespaces:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-network-policy
spec:
  rules:
    - name: default-deny-ingress
      match:
        any:
          - resources:
              kinds:
                - Namespace
      generate:
        kind: NetworkPolicy
        name: default-deny-ingress
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
```

## Apply Sample Policies

Sample policies are available in the `policies/` directory:

```bash
kubectl apply -f policies/
```

## Useful Commands

### View Policies
```bash
# List all cluster policies
kubectl get clusterpolicies

# List namespaced policies
kubectl get policies -A

# Describe a specific policy
kubectl describe clusterpolicy <policy-name>
```

### View Policy Reports
```bash
# List policy reports
kubectl get policyreports -A

# List cluster policy reports
kubectl get clusterpolicyreports

# View detailed report
kubectl describe policyreport <report-name> -n <namespace>
```

### View Kyverno Logs
```bash
# Admission controller logs
kubectl logs -f deployment/kyverno-admission-controller -n kyverno

# Background controller logs
kubectl logs -f deployment/kyverno-background-controller -n kyverno

# Reports controller logs
kubectl logs -f deployment/kyverno-reports-controller -n kyverno
```

### Test Policies
```bash
# Dry-run mode - test without enforcing
kubectl create deployment nginx --image=nginx:latest --dry-run=server
```

## Uninstall

```bash
helm uninstall kyverno -n kyverno
kubectl delete namespace kyverno
```

## Resources

- [Official Documentation](https://kyverno.io/docs/)
- [Policy Library](https://kyverno.io/policies/)
- [GitHub Repository](https://github.com/kyverno/kyverno)
