# Prometheus Monitoring Stack for EKS

This directory contains Helm chart configuration for deploying the **kube-prometheus-stack** to your existing Amazon EKS cluster.

## 📦 What's Included

The kube-prometheus-stack includes:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Alertmanager** - Alert routing and management
- **Node Exporter** - Node-level metrics
- **Kube State Metrics** - Kubernetes object metrics
- **Prometheus Operator** - Manages Prometheus instances

## 📋 Prerequisites

1. **EKS Cluster Running** - Your cluster should be deployed and accessible
2. **kubectl configured** - Connected to your EKS cluster
   ```bash
   aws eks update-kubeconfig --region us-east-1 --name student-eks-cluster
   ```
3. **Helm installed** - Version 3.x
   ```bash
   brew install helm
   ```
4. **AWS Load Balancer Controller** (recommended) - For LoadBalancer services

## 🚀 Quick Start

### 1. Deploy Prometheus Stack

```bash
cd /Users/rwnhdd/Downloads/cloudformation/eks-v1.34/prometheus

# Deploy using the script
./deploy.sh
```

### 2. Access Services

After deployment, you'll get LoadBalancer URLs for:

**Prometheus UI:**
```bash
# Get the URL
kubectl get svc -n monitoring prometheus-kube-prometheus-prometheus

# Or port-forward locally
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Visit: http://localhost:9090
```

**Grafana Dashboard:**
```bash
# Get the URL
kubectl get svc -n monitoring prometheus-grafana

# Or port-forward locally
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Visit: http://localhost:3000
# Username: admin
# Password: admin123
```

**Alertmanager:**
```bash
# Get the URL
kubectl get svc -n monitoring prometheus-kube-prometheus-alertmanager

# Or port-forward locally
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-alertmanager 9093:9093
# Visit: http://localhost:9093
```

## 📝 Configuration

### values.yaml Structure

```yaml
prometheus:
  prometheusSpec:
    retention: 30d              # Data retention period
    storageSpec:                # Persistent storage
      volumeClaimTemplate:
        spec:
          resources:
            requests:
              storage: 50Gi
    resources:                  # Resource limits
      requests:
        cpu: 500m
        memory: 2Gi

grafana:
  enabled: true
  adminPassword: "admin123"     # Change in production!
  persistence:
    enabled: true
    size: 10Gi

alertmanager:
  enabled: true
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          resources:
            requests:
              storage: 10Gi
```

### Customizing the Deployment

Edit `values.yaml` to customize:

1. **Storage sizes** - Adjust based on your metrics volume
2. **Resource limits** - Scale up/down based on cluster size
3. **Service types** - Change from LoadBalancer to ClusterIP or NodePort
4. **Retention period** - How long to keep metrics
5. **Grafana password** - Set a secure password

## 🔧 Management Commands

### Check Deployment Status

```bash
# View all pods in monitoring namespace
kubectl get pods -n monitoring

# Check pod details
kubectl describe pod -n monitoring <pod-name>

# View logs
kubectl logs -n monitoring -l app.kubernetes.io/name=prometheus -f
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana -f
```

### Upgrade Prometheus Stack

```bash
# Update Helm repository
helm repo update

# Upgrade with new values
helm upgrade prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values values.yaml
```

### Uninstall Prometheus Stack

```bash
# Remove Helm release
helm uninstall prometheus -n monitoring

# Delete namespace (optional)
kubectl delete namespace monitoring
```

## 📊 Using Prometheus

### 1. Explore Metrics

Visit Prometheus UI and try these queries:

```promql
# CPU usage by pod
sum(rate(container_cpu_usage_seconds_total[5m])) by (pod)

# Memory usage by namespace
sum(container_memory_usage_bytes) by (namespace)

# Pod restart count
kube_pod_container_status_restarts_total

# Node CPU usage
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### 2. Create Alerts

Edit `values.yaml` to add custom alerts:

```yaml
additionalPrometheusRulesMap:
  custom-alerts:
    groups:
    - name: custom
      rules:
      - alert: HighPodMemory
        expr: container_memory_usage_bytes > 1000000000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ $labels.pod }} using high memory"
```

### 3. Grafana Dashboards

Pre-installed dashboards:
- **Kubernetes / Compute Resources / Cluster** - Overall cluster metrics
- **Kubernetes / Compute Resources / Namespace** - Per-namespace view
- **Kubernetes / Compute Resources / Pod** - Per-pod metrics
- **Node Exporter / Nodes** - Node-level system metrics

Import additional dashboards from [Grafana.com](https://grafana.com/grafana/dashboards/)

## 🎯 Common Use Cases

### Monitor Application Performance

1. Add ServiceMonitor for your app:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
  - port: metrics
    interval: 30s
```

2. Expose metrics endpoint in your app (port 9090 or custom)

### Set Up Alerting

1. Configure Alertmanager in `values.yaml`:
```yaml
alertmanager:
  config:
    global:
      slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    route:
      receiver: 'slack-notifications'
    receivers:
    - name: 'slack-notifications'
      slack_configs:
      - channel: '#alerts'
```

### Scale Based on Metrics

Use Prometheus metrics with HPA:
```bash
kubectl autoscale deployment my-app \
  --cpu-percent=50 \
  --min=2 \
  --max=10
```

## 🔍 Troubleshooting

### Pods Not Starting

```bash
# Check pod events
kubectl describe pod -n monitoring <pod-name>

# Check PVC status
kubectl get pvc -n monitoring

# Verify EBS CSI driver is installed
kubectl get pods -n kube-system | grep ebs-csi
```

### LoadBalancer Pending

```bash
# Check if AWS Load Balancer Controller is installed
kubectl get pods -n kube-system | grep aws-load-balancer-controller

# If not, install it (see ../aws-load-balancer-controller/)
```

### High Memory Usage

Reduce retention or storage:
```yaml
prometheus:
  prometheusSpec:
    retention: 15d  # Reduce from 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          resources:
            requests:
              storage: 20Gi  # Reduce from 50Gi
```

### Cannot Access Grafana

```bash
# Reset admin password
kubectl exec -it -n monitoring \
  $(kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}') \
  -- grafana-cli admin reset-admin-password newpassword
```

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [kube-prometheus-stack Chart](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Gallery](https://grafana.com/grafana/dashboards/)

## 🎓 Learning Path

1. **Deploy** - Use `./deploy.sh` to install
2. **Explore** - Browse Prometheus UI and Grafana dashboards
3. **Query** - Learn PromQL by running sample queries
4. **Visualize** - Create custom Grafana dashboards
5. **Alert** - Set up Alertmanager notifications
6. **Integrate** - Add ServiceMonitors for your applications

## 💡 Best Practices

1. **Change default passwords** in production
2. **Use persistent storage** for production workloads
3. **Set resource limits** appropriate for your cluster size
4. **Configure retention** based on your compliance needs
5. **Use ServiceMonitors** instead of manual scrape configs
6. **Back up Grafana dashboards** regularly
7. **Test alerts** before relying on them
8. **Monitor the monitoring** - Set alerts for Prometheus itself

---

**Note**: This setup uses LoadBalancer services which will create AWS ELBs. Consider using Ingress with authentication for production environments.
