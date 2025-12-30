# Prometheus Pod Metrics - Quick Reference Guide

## Access Prometheus UI

**External URL:**
```
http://a04857573f02f4dbfacdaa14fd022dcb-659295707.us-east-1.elb.amazonaws.com:9090
```

**Or port-forward locally:**
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Then visit: http://localhost:9090
```

---

## ✅ Working Queries for Pod Metrics

Copy and paste these queries into the Prometheus UI query box:

### 1. **Pod CPU Usage (by namespace and pod)**
```promql
sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) by (namespace, pod)
```
This shows CPU usage rate for each pod over the last 5 minutes.

### 2. **Pod Memory Usage (by namespace and pod)**
```promql
sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (namespace, pod)
```
This shows current memory usage in bytes for each pod.

### 3. **Pod Memory Usage in GB**
```promql
sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (namespace, pod) / 1024 / 1024 / 1024
```

### 4. **All Running Pods**
```promql
kube_pod_status_phase{phase="Running"}
```

### 5. **Pod Restart Count**
```promql
kube_pod_container_status_restarts_total
```

### 6. **Pods by Phase (Running, Pending, Failed, etc.)**
```promql
count(kube_pod_status_phase) by (phase)
```

### 7. **Top 10 Pods by CPU Usage**
```promql
topk(10, sum(rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[5m])) by (namespace, pod))
```

### 8. **Top 10 Pods by Memory Usage**
```promql
topk(10, sum(container_memory_working_set_bytes{container!="",container!="POD"}) by (namespace, pod))
```

### 9. **Pod Network Received Bytes**
```promql
sum(rate(container_network_receive_bytes_total[5m])) by (namespace, pod)
```

### 10. **Pod Network Transmitted Bytes**
```promql
sum(rate(container_network_transmit_bytes_total[5m])) by (namespace, pod)
```

### 11. **Pods in Specific Namespace (e.g., monitoring)**
```promql
kube_pod_info{namespace="monitoring"}
```

### 12. **Container Restarts in Last Hour**
```promql
increase(kube_pod_container_status_restarts_total[1h])
```

---

## 📊 How to Use These Queries

### In Prometheus UI:
1. Go to **Graph** tab
2. Paste a query in the expression box
3. Click **Execute**
4. Switch between **Table** and **Graph** views
5. Adjust time range using the time picker

### View Targets Status:
- Go to **Status → Targets** to see all scrape targets
- Look for `kubelet`, `kube-state-metrics`, and `pod-metrics-all-namespaces`
- All should show status "UP"

### View Service Discovery:
- Go to **Status → Service Discovery**
- See all discovered pods and services

---

## 🎯 Quick Verification

Run this simple query first to confirm metrics are working:
```promql
up
```
This should show all targets that are being scraped (value=1 means UP).

Then try:
```promql
kube_pod_info
```
This should list all pods in your cluster with their metadata.

---

## 🔍 Troubleshooting

### If you see "No data":
1. Make sure you're looking at the right time range (last 5m, 15m, 1h, etc.)
2. Check that targets are UP: **Status → Targets**
3. Verify the metric name exists: **Status → TSDB Status**

### If queries return empty:
- Some metrics need a time range like `[5m]` for rate calculations
- Container metrics filter out POD and empty containers with `{container!="",container!="POD"}`
- Make sure pods are actually running in your cluster

---

## 📈 Pre-built Dashboards in Grafana

Instead of writing queries, use Grafana dashboards:

**Access Grafana:**
```
http://ae3d4e0dc770146f3ba3407ec811b176-611384634.us-east-1.elb.amazonaws.com
Username: admin
Password: admin123
```

**Navigate to:**
- **Dashboards → Kubernetes / Compute Resources / Pod**
- **Dashboards → Kubernetes / Compute Resources / Namespace**
- **Dashboards → Kubernetes / Compute Resources / Cluster**

These dashboards already have all pod metrics visualized beautifully!

---

## 🚨 Active Alerts

Check configured alerts at: **Alerts** tab in Prometheus UI

Current pod-related alerts:
- PodHighCPUUsage (>80% CPU)
- PodHighMemoryUsage (>90% memory limit)
- PodFrequentRestarts
- PodNotReady (not Running/Succeeded for 10m)
