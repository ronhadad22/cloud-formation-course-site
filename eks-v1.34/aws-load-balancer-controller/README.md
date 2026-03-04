# AWS Load Balancer Controller

The AWS Load Balancer Controller manages AWS Elastic Load Balancers for a Kubernetes cluster. It provisions:
- **Application Load Balancers (ALB)** for Kubernetes Ingress resources
- **Network Load Balancers (NLB)** for Kubernetes Service resources

## Prerequisites

- EKS cluster running
- kubectl configured
- Helm 3.x installed
- AWS CLI configured with appropriate permissions

## Installation

### Step 1: Setup IRSA (IAM Role for Service Account)

```bash
cd irsa
./setup-irsa.sh
```

This creates:
- IAM role with necessary permissions
- Trust relationship with EKS OIDC provider
- CloudFormation stack for infrastructure as code

### Step 2: Install AWS Load Balancer Controller

```bash
cd ..
./install-alb-controller.sh
```

This will:
- Get VPC ID automatically
- Install CRDs (Custom Resource Definitions)
- Install the controller using Helm
- Wait for deployment to be ready

## Configuration

The `alb-controller-values.yaml` file includes:

- **High Availability**: 2 replicas
- **Resource Limits**: Optimized for production
- **IRSA**: Service account with IAM role annotation
- **Ingress Class**: `alb` (default)
- **Backend Security Groups**: Enabled for pod-to-pod communication

## Verify Installation

Check the controller pods:
```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

Check the deployment:
```bash
kubectl get deployment aws-load-balancer-controller -n kube-system
```

View logs:
```bash
kubectl logs -f deployment/aws-load-balancer-controller -n kube-system
```

Check ingress class:
```bash
kubectl get ingressclass
```

## Usage Examples

### Example 1: Simple HTTP Application

Deploy a sample nginx application with ALB:

```bash
kubectl apply -f examples/sample-app.yaml
```

Get the ALB DNS name:
```bash
kubectl get ingress -n sample-app
```

Access the application:
```bash
ALB_DNS=$(kubectl get ingress nginx-ingress -n sample-app -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl http://$ALB_DNS
```

### Example 2: HTTPS Application with ACM Certificate

1. First, create or import a certificate in AWS Certificate Manager (ACM)
2. Update the certificate ARN in `examples/sample-app-https.yaml`
3. Deploy:

```bash
kubectl apply -f examples/sample-app-https.yaml
```

### Example 3: Internal Load Balancer

For internal-only applications, use the `internal` scheme:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: internal-app
  annotations:
    alb.ingress.kubernetes.io/scheme: internal
    alb.ingress.kubernetes.io/target-type: ip
spec:
  ingressClassName: alb
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

## Common Annotations

### ALB Configuration

```yaml
# Scheme (internet-facing or internal)
alb.ingress.kubernetes.io/scheme: internet-facing

# Target type (ip or instance)
alb.ingress.kubernetes.io/target-type: ip

# Listen ports
alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'

# SSL Certificate
alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/xxxxx

# SSL Redirect
alb.ingress.kubernetes.io/ssl-redirect: '443'

# Subnets (optional - auto-discovered by default)
alb.ingress.kubernetes.io/subnets: subnet-xxxxx,subnet-yyyyy

# Security groups (optional)
alb.ingress.kubernetes.io/security-groups: sg-xxxxx,sg-yyyyy
```

### Health Check Configuration

```yaml
alb.ingress.kubernetes.io/healthcheck-path: /health
alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
alb.ingress.kubernetes.io/healthy-threshold-count: '2'
alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'
alb.ingress.kubernetes.io/healthcheck-protocol: HTTP
```

### Advanced Features

```yaml
# WAFv2 Web ACL
alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:region:account:regional/webacl/xxxxx

# AWS Shield Advanced
alb.ingress.kubernetes.io/shield-advanced-protection: 'true'

# Sticky sessions
alb.ingress.kubernetes.io/target-group-attributes: stickiness.enabled=true,stickiness.lb_cookie.duration_seconds=60

# Custom tags
alb.ingress.kubernetes.io/tags: Environment=prod,Team=platform

# Load balancer attributes
alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=60
```

## Troubleshooting

### Check Controller Logs

```bash
kubectl logs -f deployment/aws-load-balancer-controller -n kube-system
```

### Check Ingress Events

```bash
kubectl describe ingress <ingress-name> -n <namespace>
```

### Verify IAM Permissions

```bash
kubectl describe sa aws-load-balancer-controller -n kube-system
```

### Common Issues

1. **ALB not created**: Check controller logs for permission errors
2. **503 errors**: Check target health in AWS Console
3. **Certificate errors**: Verify ACM certificate ARN and region
4. **Subnet discovery fails**: Add explicit subnet annotations

### View AWS Resources

Check created ALBs in AWS Console:
```bash
aws elbv2 describe-load-balancers --region us-east-1 --profile int-profile
```

Check target groups:
```bash
aws elbv2 describe-target-groups --region us-east-1 --profile int-profile
```

## Cleanup

Delete sample applications:
```bash
kubectl delete -f examples/sample-app.yaml
kubectl delete -f examples/sample-app-https.yaml
```

Uninstall controller:
```bash
helm uninstall aws-load-balancer-controller -n kube-system
kubectl delete -f https://raw.githubusercontent.com/aws/eks-charts/master/stable/aws-load-balancer-controller/crds/crds.yaml
```

Delete IRSA stack:
```bash
aws cloudformation delete-stack --stack-name alb-controller-irsa-stack --region us-east-1 --profile int-profile
```

## Resources

- [Official Documentation](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [GitHub Repository](https://github.com/kubernetes-sigs/aws-load-balancer-controller)
- [Annotation Reference](https://kubernetes-sigs.github.io/aws-load-balancer-controller/v2.7/guide/ingress/annotations/)
