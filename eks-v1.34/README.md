# Amazon EKS v1.34 Training Stack

This folder contains a generic Amazon EKS cluster template intended for classroom labs. Every student can deploy it in their own AWS account and preferred region with only a few parameter changes.

## Files

- `eks-cluster.yaml` – CloudFormation template that provisions:
  - A dedicated VPC with public and private subnets across two Availability Zones
  - Amazon EKS control plane (default Kubernetes version 1.34)
  - Managed node group with configurable instance type and size
  - Core addons (VPC CNI, CoreDNS, kube-proxy, EBS CSI driver)

## Prerequisites

1. AWS CLI v2 configured with credentials for the student account
2. IAM permissions to create IAM roles, VPC networking, and EKS resources (`CAPABILITY_IAM` is required)
3. Stack now creates an IAM OIDC identity provider and IAM role for the Amazon EBS CSI driver add-on
4. Optional: existing EC2 key pair if SSH access to worker nodes is desired
5. Make sure the selected region offers **at least two Availability Zones** and supports the chosen instance types

## Parameter Quick Reference

| Parameter | Default | Notes |
|-----------|---------|-------|
| `ClusterName` | `student-eks-cluster` | Any unique name per account/region |
| `KubernetesVersion` | `1.34` | Only versions 1.32–1.34 allowed |
| `AuthenticationMode` | `API_AND_CONFIG_MAP` | Enables both EKS Access API and legacy aws-auth ConfigMap |
| `NodeGroupName` | `student-nodes` | Node group logical name |
| `NodeInstanceType` | `t3.medium` | Must be available in the region |
| `NodeAmiType` | `AL2023_x86_64_STANDARD` | Use AL2023 for Kubernetes ≥ 1.33; choose *_ARM_* only with Graviton instance types |
| `NodeGroupDesiredSize` | `2` | Desired worker count |
| `NodeGroupMinSize` | `1` | Minimum worker count |
| `NodeGroupMaxSize` | `4` | Maximum worker count |
| `KeyPairName` | *(blank)* | Provide existing KeyPair name to enable SSH |
| `OidcThumbprint` | `9e99a48a9960b14926bb7f3b3b4d0872168d4e7d` | Root CA thumbprint for the EKS OIDC issuer (validate per region) |
| `VpcCidr` | `10.0.0.0/16` | Adjust if it conflicts with existing CIDRs |
| `PublicSubnet1Cidr` | `10.0.1.0/24` | Must be within the VPC CIDR |
| `PublicSubnet2Cidr` | `10.0.2.0/24` | Must be within the VPC CIDR |
| `PrivateSubnet1Cidr` | `10.0.10.0/24` | Must be within the VPC CIDR |
| `PrivateSubnet2Cidr` | `10.0.20.0/24` | Must be within the VPC CIDR |

Students typically only change `ClusterName`, `NodeInstanceType`, and optionally the subnet CIDRs if they collide with existing networks.

## Deploying the Stack

```bash
# Replace <region> and parameter values as needed
aws cloudformation deploy \
  --region <region> \
  --template-file eks-cluster.yaml \
  --stack-name eks-training-stack \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      ClusterName=student-eks-cluster \
      KubernetesVersion=1.34 \
      AuthenticationMode=API_AND_CONFIG_MAP \
      NodeGroupName=student-nodes \
      NodeInstanceType=t3.medium \
      NodeAmiType=AL2023_x86_64_STANDARD \
      NodeGroupDesiredSize=2 \
      NodeGroupMinSize=1 \
      NodeGroupMaxSize=4 \
      KeyPairName="" \
      OidcThumbprint=9e99a48a9960b14926bb7f3b3b4d0872168d4e7d \
      VpcCidr=10.0.0.0/16 \
      PublicSubnet1Cidr=10.0.1.0/24 \
      PublicSubnet2Cidr=10.0.2.0/24 \
      PrivateSubnet1Cidr=10.0.10.0/24 \
      PrivateSubnet2Cidr=10.0.20.0/24
```

### After Deployment

1. Update kubeconfig to connect kubectl:
   ```bash
   aws eks update-kubeconfig --region <region> --name <ClusterName>
   ```
2. Verify nodes:
   ```bash
   kubectl get nodes
   ```
3. Confirm that the `aws-ebs-csi-driver` add-on is active:
   ```bash
   aws eks describe-addon --cluster-name <ClusterName> --addon-name aws-ebs-csi-driver --region <region>
   ```
4. (Optional) Install common add-ons via Helm (e.g., metrics-server, ingress controllers).

### Deleting the Stack

Delete the CloudFormation stack when finished:

```bash
aws cloudformation delete-stack \
  --region <region> \
  --stack-name eks-training-stack
```

Wait for the delete operation to finish (`DELETE_COMPLETE`) before reusing the same subnet CIDRs.

## Tips for Students

- Keep VPC CIDR ranges consistent with other lab templates to avoid overlaps.
- If `t3.medium` is unavailable, choose another allowed type (for example, `m5.large`).
- Leaving `KeyPairName` empty blocks SSH access, which is fine for most labs since SSM Agent is installed.
- Confirm the `OidcThumbprint` matches AWS docs for the target region before launching (SHA-1 of the root CA issuing `oidc.eks.<region>.amazonaws.com`).
- Use `AuthenticationMode=API_AND_CONFIG_MAP` to keep compatibility with the new EKS Access API and existing `aws-auth` ConfigMap flows; switch to `API` once all workloads migrate to IAM Identity Center or `CONFIG_MAP` for legacy-only labs.
- CloudFormation stack events provide the best troubleshooting information if deployment fails.
