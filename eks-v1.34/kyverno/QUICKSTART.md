# Kyverno Quick Start Guide

## Installation

### 1. Install Kyverno
```bash
cd kyverno
./install-kyverno.sh
```

### 2. Verify Installation
```bash
kubectl get pods -n kyverno
kubectl get deployments -n kyverno
```

Expected output:
```
NAME                                        READY   STATUS    RESTARTS   AGE
kyverno-admission-controller-xxx-xxx        1/1     Running   0          2m
kyverno-background-controller-xxx-xxx       1/1     Running   0          2m
kyverno-cleanup-controller-xxx-xxx          1/1     Running   0          2m
kyverno-reports-controller-xxx-xxx          1/1     Running   0          2m
```

## Apply Sample Policies

### Apply All Sample Policies
```bash
kubectl apply -f policies/
```

### Apply Individual Policies
```bash
# Require labels on pods
kubectl apply -f policies/require-labels.yaml

# Disallow latest tag
kubectl apply -f policies/disallow-latest-tag.yaml

# Require resource limits
kubectl apply -f policies/require-resource-limits.yaml

# Disallow privileged containers
kubectl apply -f policies/disallow-privileged-containers.yaml
```

## View Policies

```bash
# List all cluster policies
kubectl get clusterpolicies

# View policy details
kubectl describe clusterpolicy require-labels
```

## Test Policies

### Test 1: Create a pod without required labels (should fail in Audit mode)
```bash
kubectl run test-pod --image=nginx:1.21
```

Check the policy report:
```bash
kubectl get policyreport -n default
kubectl describe policyreport -n default
```

### Test 2: Create a pod with latest tag (should fail in Audit mode)
```bash
kubectl run test-latest --image=nginx:latest
```

### Test 3: Create a privileged pod (should be blocked)
```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    securityContext:
      privileged: true
EOF
```

This should be blocked with the message: "Privileged mode is not allowed"

## View Policy Reports

```bash
# List all policy reports
kubectl get policyreports -A

# View detailed report for a namespace
kubectl describe policyreport -n default

# View cluster-wide policy reports
kubectl get clusterpolicyreports
```

## Cleanup Test Resources

```bash
kubectl delete pod test-pod test-latest privileged-pod --ignore-not-found
```

## Change Policy Mode

To change a policy from Audit to Enforce mode:

```bash
kubectl patch clusterpolicy require-labels --type=merge -p '{"spec":{"validationFailureAction":"Enforce"}}'
```

To change back to Audit mode:

```bash
kubectl patch clusterpolicy require-labels --type=merge -p '{"spec":{"validationFailureAction":"Audit"}}'
```

## Useful Commands

```bash
# View Kyverno logs
kubectl logs -f deployment/kyverno-admission-controller -n kyverno

# Check Kyverno health
kubectl get validatingwebhookconfigurations | grep kyverno
kubectl get mutatingwebhookconfigurations | grep kyverno

# View policy violations
kubectl get policyreports -A -o wide
```

## Next Steps

1. Review the sample policies in `policies/` directory
2. Customize policies for your use case
3. Gradually change policies from Audit to Enforce mode
4. Create custom policies based on your requirements
5. Check the [Kyverno Policy Library](https://kyverno.io/policies/) for more examples
