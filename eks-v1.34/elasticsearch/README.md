# Elasticsearch on EKS

This directory contains Kubernetes manifests to deploy a 3-node Elasticsearch cluster with Kibana on your EKS cluster.

## Architecture

- **Elasticsearch**: 3-node cluster using StatefulSet with persistent storage (EBS gp3)
- **Kibana**: Single instance for visualization and management
- **Storage**: 30Gi EBS gp3 volumes per Elasticsearch node
- **Security**: Disabled for simplicity (enable in production)

## Prerequisites

1. EKS cluster is running: `arn:aws:eks:us-east-1:950555670656:cluster/student-eks-cluster`
2. kubectl configured to access the cluster
3. EBS CSI driver installed (for persistent volumes)
4. Sufficient node capacity (recommended: 3 nodes with at least 2 vCPU and 4GB RAM each)

## Deployment Steps

### 1. Configure kubectl for your EKS cluster

```bash
aws eks update-kubeconfig --region us-east-1 --name student-eks-cluster
```

### 2. Verify EBS CSI driver is installed

```bash
kubectl get pods -n kube-system | grep ebs-csi
```

If not installed, you need to install the EBS CSI driver first.

### 3. Deploy Elasticsearch

Apply the manifests in order:

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create storage class
kubectl apply -f storageclass.yaml

# Deploy Elasticsearch StatefulSet
kubectl apply -f elasticsearch-statefulset.yaml

# Create Elasticsearch services
kubectl apply -f elasticsearch-service.yaml

# Deploy Kibana
kubectl apply -f kibana-deployment.yaml
kubectl apply -f kibana-service.yaml
```

Or apply all at once:

```bash
kubectl apply -f .
```

### 4. Monitor the deployment

```bash
# Watch Elasticsearch pods
kubectl get pods -n elasticsearch -w

# Check StatefulSet status
kubectl get statefulset -n elasticsearch

# Check PersistentVolumeClaims
kubectl get pvc -n elasticsearch

# View logs
kubectl logs -n elasticsearch elasticsearch-0 -f
```

### 5. Access Kibana

Get the LoadBalancer URL:

```bash
kubectl get svc -n elasticsearch kibana
```

Wait for the EXTERNAL-IP to be assigned, then access Kibana at:
```
http://<EXTERNAL-IP>:5601
```

### 6. Test Elasticsearch

Port-forward to test Elasticsearch directly:

```bash
kubectl port-forward -n elasticsearch svc/elasticsearch-client 9200:9200
```

Then test in another terminal:

```bash
curl http://localhost:9200
curl http://localhost:9200/_cluster/health?pretty
```

## Scaling

To scale the Elasticsearch cluster:

```bash
kubectl scale statefulset elasticsearch -n elasticsearch --replicas=5
```

## Resource Configuration

Current configuration per Elasticsearch pod:
- CPU: 500m request, 1000m limit
- Memory: 1Gi request, 2Gi limit
- Storage: 30Gi EBS gp3 volume
- Java Heap: 1GB (-Xms1g -Xmx1g)

Adjust these values in `elasticsearch-statefulset.yaml` based on your workload.

## Security Considerations

**⚠️ WARNING**: This deployment has security disabled for simplicity.

For production environments:
1. Enable xpack.security
2. Configure TLS/SSL
3. Set up authentication and authorization
4. Use Kubernetes secrets for credentials
5. Configure network policies
6. Enable encryption at rest for EBS volumes

## Troubleshooting

### Pods stuck in Pending
- Check if nodes have sufficient resources
- Verify EBS CSI driver is working: `kubectl get csidriver`
- Check PVC status: `kubectl describe pvc -n elasticsearch`

### Pods CrashLoopBackOff
- Check logs: `kubectl logs -n elasticsearch <pod-name>`
- Common issues:
  - Insufficient memory (increase limits)
  - vm.max_map_count not set (handled by init container)
  - Permission issues (handled by init container)

### Cluster not forming
- Verify all pods can communicate
- Check discovery.seed_hosts configuration
- Ensure DNS resolution works between pods

## Cleanup

To remove the Elasticsearch deployment:

```bash
kubectl delete -f .
```

To also remove PersistentVolumes:

```bash
kubectl delete pvc -n elasticsearch --all
```

## Additional Resources

- [Elasticsearch on Kubernetes](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html)
- [EBS CSI Driver Documentation](https://github.com/kubernetes-sigs/aws-ebs-csi-driver)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
