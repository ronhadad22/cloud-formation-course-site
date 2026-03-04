# Fluentd Log Collection for Elasticsearch

This directory contains Fluentd DaemonSet configuration to collect Kubernetes logs and send them to Elasticsearch.

## What It Does

- **Collects** all container logs from Kubernetes pods
- **Enriches** logs with Kubernetes metadata (pod name, namespace, labels, etc.)
- **Sends** logs to Elasticsearch in Logstash format
- **Creates** daily indices: `kubernetes-YYYY.MM.DD`

## Deployment

### Deploy Fluentd

```bash
# Apply all Fluentd resources
kubectl apply -f fluentd-serviceaccount.yaml
kubectl apply -f fluentd-configmap.yaml
kubectl apply -f fluentd-daemonset.yaml
```

Or apply all at once:
```bash
kubectl apply -f fluentd-*.yaml
```

### Verify Deployment

```bash
# Check Fluentd pods (one per node)
kubectl get pods -n elasticsearch -l app=fluentd

# Check logs
kubectl logs -n elasticsearch -l app=fluentd --tail=50

# Verify logs are being sent to Elasticsearch
kubectl port-forward -n elasticsearch svc/elasticsearch-master 9200:9200
curl http://localhost:9200/_cat/indices?v | grep kubernetes
```

## View Logs in Kibana

1. **Access Kibana** at your LoadBalancer URL
2. **Create Index Pattern**:
   - Go to **Management** → **Stack Management** → **Index Patterns**
   - Click **Create index pattern**
   - Enter pattern: `kubernetes-*`
   - Select time field: `@timestamp`
   - Click **Create index pattern**

3. **View Logs**:
   - Go to **Discover**
   - Select the `kubernetes-*` index pattern
   - You'll see all Kubernetes logs with metadata

## Log Format

Logs include:
- `kubernetes.pod_name` - Pod name
- `kubernetes.namespace_name` - Namespace
- `kubernetes.container_name` - Container name
- `kubernetes.labels` - Pod labels
- `log` - Actual log message
- `@timestamp` - Log timestamp

## Configuration

### Fluentd ConfigMap (`fluentd-configmap.yaml`)

- **Source**: Tails `/var/log/containers/*.log`
- **Filter**: Adds Kubernetes metadata
- **Output**: Sends to Elasticsearch with Logstash format

### Resource Limits

- CPU: 100m request
- Memory: 200Mi request/limit

### Customization

Edit `fluentd-configmap.yaml` to:
- Change log parsing format
- Add custom filters
- Modify buffer settings
- Change index naming

## Troubleshooting

### Fluentd pods not starting

Check pod status:
```bash
kubectl describe pod -n elasticsearch -l app=fluentd
```

### No logs in Elasticsearch

Check Fluentd logs:
```bash
kubectl logs -n elasticsearch -l app=fluentd | grep -i error
```

Check Elasticsearch connectivity:
```bash
kubectl exec -n elasticsearch deployment/fluentd -- curl -s http://elasticsearch-master:9200
```

### Permission issues

Verify ServiceAccount and RBAC:
```bash
kubectl get serviceaccount fluentd -n elasticsearch
kubectl get clusterrole fluentd
kubectl get clusterrolebinding fluentd
```

## Uninstall

```bash
kubectl delete -f fluentd-daemonset.yaml
kubectl delete -f fluentd-configmap.yaml
kubectl delete -f fluentd-serviceaccount.yaml
```

## Performance Tuning

For high-volume logging:
- Increase buffer size in ConfigMap
- Adjust `flush_interval` for faster/slower flushing
- Increase resource limits
- Use multiple flush threads

## Index Management

Elasticsearch will create daily indices. To manage old indices:
- Set up Index Lifecycle Management (ILM) policies
- Configure retention periods
- Use Curator for automated cleanup
