# Elasticsearch on EKS - Helm Deployment

This directory contains Helm-based deployment for Elasticsearch and Kibana using the official Elastic Helm charts.

## Prerequisites

1. **Helm 3** installed:
   ```bash
   brew install helm
   ```

2. **kubectl** configured for your EKS cluster:
   ```bash
   aws configure  # Set up AWS credentials first
   aws eks update-kubeconfig --region us-east-1 --name student-eks-cluster
   ```

3. **EBS CSI Driver** installed on your EKS cluster (for persistent volumes)

4. **Sufficient cluster capacity**: 3 nodes with at least 2 vCPU and 4GB RAM each

## Quick Deployment

### Option 1: Automated Script (Recommended)

```bash
chmod +x deploy.sh
./deploy.sh
```

This script will:
- Add the Elastic Helm repository
- Create the namespace
- Create the gp3 StorageClass
- Deploy Elasticsearch (3 nodes)
- Deploy Kibana with LoadBalancer

### Option 2: Manual Deployment

```bash
# Add Elastic Helm repository
helm repo add elastic https://helm.elastic.co
helm repo update

# Create namespace
kubectl create namespace elasticsearch

# Create StorageClass
kubectl apply -f storageclass.yaml

# Deploy Elasticsearch
helm install elasticsearch elastic/elasticsearch \
  --namespace elasticsearch \
  --values values.yaml

# Deploy Kibana
helm install kibana elastic/kibana \
  --namespace elasticsearch \
  --values kibana-values.yaml
```

## Configuration

### Elasticsearch (`values.yaml`)

Key configurations:
- **Replicas**: 3 nodes for high availability
- **Storage**: 30Gi EBS gp3 per node
- **Resources**: 500m CPU / 1Gi RAM (request), 1000m CPU / 2Gi RAM (limit)
- **JVM Heap**: 1GB
- **Security**: Disabled (enable for production)

### Kibana (`kibana-values.yaml`)

Key configurations:
- **Service Type**: LoadBalancer (for external access)
- **Resources**: 500m CPU / 512Mi RAM (request)
- **Replicas**: 1

## Verify Deployment

```bash
# Check all resources
kubectl get all -n elasticsearch

# Check pods
kubectl get pods -n elasticsearch

# Check PersistentVolumeClaims
kubectl get pvc -n elasticsearch

# Check services
kubectl get svc -n elasticsearch

# View Elasticsearch logs
kubectl logs -n elasticsearch elasticsearch-master-0 -f

# View Kibana logs
kubectl logs -n elasticsearch -l app=kibana -f
```

## Access Kibana

Get the LoadBalancer URL:

```bash
kubectl get svc -n elasticsearch kibana-kibana
```

Wait for `EXTERNAL-IP` to be assigned (may take 2-3 minutes), then access:
```
http://<EXTERNAL-IP>:5601
```

## Test Elasticsearch

### Port-forward method:

```bash
kubectl port-forward -n elasticsearch svc/elasticsearch-master 9200:9200
```

In another terminal:
```bash
# Check cluster health
curl http://localhost:9200
curl http://localhost:9200/_cluster/health?pretty

# List indices
curl http://localhost:9200/_cat/indices?v

# Create a test index
curl -X PUT http://localhost:9200/test-index

# Add a document
curl -X POST http://localhost:9200/test-index/_doc/1 \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello from EKS!"}'

# Search
curl http://localhost:9200/test-index/_search?pretty
```

## Upgrade Configuration

To update Elasticsearch or Kibana configuration:

```bash
# Edit values.yaml or kibana-values.yaml, then:

helm upgrade elasticsearch elastic/elasticsearch \
  --namespace elasticsearch \
  --values values.yaml

helm upgrade kibana elastic/kibana \
  --namespace elasticsearch \
  --values kibana-values.yaml
```

## Scaling

Scale the Elasticsearch cluster:

```bash
# Edit values.yaml and change replicas, then:
helm upgrade elasticsearch elastic/elasticsearch \
  --namespace elasticsearch \
  --values values.yaml
```

Or use kubectl:
```bash
kubectl scale statefulset elasticsearch-master -n elasticsearch --replicas=5
```

## Monitoring

```bash
# Watch pods
kubectl get pods -n elasticsearch -w

# Describe a pod
kubectl describe pod -n elasticsearch elasticsearch-master-0

# Check events
kubectl get events -n elasticsearch --sort-by='.lastTimestamp'

# Check cluster health via API
kubectl exec -n elasticsearch elasticsearch-master-0 -- \
  curl -s http://localhost:9200/_cluster/health?pretty
```

## Troubleshooting

### Pods stuck in Pending

Check PVC status:
```bash
kubectl describe pvc -n elasticsearch
```

Verify EBS CSI driver:
```bash
kubectl get pods -n kube-system | grep ebs-csi
```

### Pods CrashLoopBackOff

Check logs:
```bash
kubectl logs -n elasticsearch elasticsearch-master-0
```

Common issues:
- Insufficient memory (increase in values.yaml)
- Node affinity issues (check node labels)
- Storage provisioning issues (verify StorageClass)

### LoadBalancer not getting External IP

Check service:
```bash
kubectl describe svc -n elasticsearch kibana-kibana
```

Verify AWS Load Balancer Controller is installed:
```bash
kubectl get pods -n kube-system | grep aws-load-balancer-controller
```

### Cluster not forming

Check discovery:
```bash
kubectl logs -n elasticsearch elasticsearch-master-0 | grep -i discovery
```

Verify network connectivity between pods:
```bash
kubectl exec -n elasticsearch elasticsearch-master-0 -- \
  curl -s http://elasticsearch-master-1.elasticsearch-master:9200
```

## Uninstall

```bash
# Remove Helm releases
helm uninstall elasticsearch -n elasticsearch
helm uninstall kibana -n elasticsearch

# Delete PVCs (this will delete data!)
kubectl delete pvc -n elasticsearch --all

# Delete namespace
kubectl delete namespace elasticsearch
```

## Production Considerations

For production deployments, modify `values.yaml`:

1. **Enable Security**:
   ```yaml
   esConfig:
     elasticsearch.yml: |
       xpack.security.enabled: true
       xpack.security.transport.ssl.enabled: true
   ```

2. **Use TLS**:
   ```yaml
   protocol: https
   ```

3. **Configure Ingress** instead of LoadBalancer:
   ```yaml
   service:
     type: ClusterIP
   ```
   Then use AWS Load Balancer Controller with Ingress

4. **Increase Resources** based on workload

5. **Enable Monitoring** with Prometheus/Grafana

6. **Configure Backups** using snapshots

7. **Set Resource Quotas** and Limits

## Helm Chart Documentation

- [Elasticsearch Helm Chart](https://github.com/elastic/helm-charts/tree/main/elasticsearch)
- [Kibana Helm Chart](https://github.com/elastic/helm-charts/tree/main/kibana)
- [Elastic Cloud on Kubernetes](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html)

## Cost Optimization

- Use gp3 volumes (cheaper than gp2)
- Right-size resources based on actual usage
- Consider using Spot instances for non-production
- Enable volume expansion for future growth
- Use lifecycle policies for old indices
