# AWS Load Balancer Controller - Quick Start

## Installation Steps

### 1. Setup IRSA
```bash
cd irsa
./setup-irsa.sh
cd ..
```

### 2. Install Controller
```bash
./install-alb-controller.sh
```

### 3. Verify Installation
```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
kubectl get ingressclass
```

## Deploy Sample Application

### HTTP Application
```bash
kubectl apply -f examples/sample-app.yaml
```

### Get ALB DNS
```bash
kubectl get ingress -n sample-app
```

### Test Application
```bash
ALB_DNS=$(kubectl get ingress nginx-ingress -n sample-app -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_DNS"
curl http://$ALB_DNS
```

## View Logs
```bash
kubectl logs -f deployment/aws-load-balancer-controller -n kube-system
```

## Cleanup
```bash
kubectl delete -f examples/sample-app.yaml
```

## Next Steps

1. Check `README.md` for detailed documentation
2. Review annotation options for advanced features
3. Deploy HTTPS application with ACM certificate
4. Configure WAF, Shield, or other AWS services
