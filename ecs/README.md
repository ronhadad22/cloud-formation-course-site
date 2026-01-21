# ECS Cluster with Service Discovery

This directory contains CloudFormation templates to deploy an ECS cluster with service discovery.

## Architecture

- **VPC**: Public and private subnets across 2 AZs with NAT Gateways
- **ECS Cluster**: EC2-based cluster with Auto Scaling Group
- **Service Discovery**: AWS Cloud Map private DNS namespace
- **ECS Service**: Nginx service with 2 tasks registered in service discovery

## Files

1. `01-vpc.yaml` - VPC with public/private subnets and NAT gateways
2. `02-ecs-cluster.yaml` - ECS cluster with EC2 instances
3. `03-service-discovery.yaml` - Service Discovery namespace
4. `04-ecs-service.yaml` - ECS service with service discovery integration
5. `deploy.sh` - Automated deployment script

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- AWS profile set to `int-profile` (or modify in deploy.sh)

### Deploy All Resources

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will deploy in order:
1. VPC (takes ~3-4 minutes)
2. ECS Cluster (takes ~3-4 minutes)
3. Service Discovery Namespace (takes ~1 minute)
4. Wait for ECS instances to register
5. ECS Service (takes ~2-3 minutes)

Total deployment time: ~15 minutes

### Deploy Individual Stacks

```bash
# Set environment variables
export AWS_PROFILE=int-profile
REGION="us-east-1"
ENV_NAME="ecs-demo"

# Deploy VPC
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-vpc \
  --template-body file://01-vpc.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME

# Deploy ECS Cluster
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-cluster \
  --template-body file://02-ecs-cluster.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME \
  --capabilities CAPABILITY_IAM

# Deploy Service Discovery
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-service-discovery \
  --template-body file://03-service-discovery.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME

# Deploy ECS Service
aws cloudformation create-stack \
  --stack-name ${ENV_NAME}-service \
  --template-body file://04-ecs-service.yaml \
  --region $REGION \
  --parameters ParameterKey=EnvironmentName,ParameterValue=$ENV_NAME
```

## Verification

### Check ECS Service Status

```bash
aws ecs describe-services \
  --cluster ecs-demo-cluster \
  --services ecs-demo-nginx-service \
  --region us-east-1 \
  --query 'services[0].[serviceName,status,runningCount,desiredCount]' \
  --output table
```

### Check Service Discovery

```bash
# List namespaces
aws servicediscovery list-namespaces --region us-east-1

# List services in namespace
NAMESPACE_ID=$(aws servicediscovery list-namespaces \
  --region us-east-1 \
  --filters Name=TYPE,Values=DNS_PRIVATE \
  --query "Namespaces[?Name=='ecs-demo.local'].Id" \
  --output text)

aws servicediscovery list-services \
  --region us-east-1 \
  --filters Name=NAMESPACE_ID,Values=$NAMESPACE_ID
```

### Check ECS Instances

```bash
aws ecs list-container-instances \
  --cluster ecs-demo-cluster \
  --region us-east-1
```

## Service Discovery

Tasks are automatically registered in service discovery at:
- **Endpoint**: `nginx.ecs-demo.local`
- **Port**: 80
- **Protocol**: TCP

Other services in the same VPC can reach the nginx service using this DNS name.

## Cleanup

Delete stacks in reverse order:

```bash
export AWS_PROFILE=int-profile
REGION="us-east-1"
ENV_NAME="ecs-demo"

# Delete ECS Service
aws cloudformation delete-stack --stack-name ${ENV_NAME}-service --region $REGION
aws cloudformation wait stack-delete-complete --stack-name ${ENV_NAME}-service --region $REGION

# Delete Service Discovery
aws cloudformation delete-stack --stack-name ${ENV_NAME}-service-discovery --region $REGION
aws cloudformation wait stack-delete-complete --stack-name ${ENV_NAME}-service-discovery --region $REGION

# Delete ECS Cluster (this will terminate EC2 instances)
aws cloudformation delete-stack --stack-name ${ENV_NAME}-cluster --region $REGION
aws cloudformation wait stack-delete-complete --stack-name ${ENV_NAME}-cluster --region $REGION

# Delete VPC
aws cloudformation delete-stack --stack-name ${ENV_NAME}-vpc --region $REGION
aws cloudformation wait stack-delete-complete --stack-name ${ENV_NAME}-vpc --region $REGION
```

## Troubleshooting

### ECS Instances Not Registering

Check Auto Scaling Group:
```bash
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names ecs-demo-asg \
  --region us-east-1
```

Check EC2 instances:
```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=ecs-demo-ecs-instance" \
  --region us-east-1 \
  --query 'Reservations[].Instances[].[InstanceId,State.Name]'
```

### Service Tasks Not Starting

Check service events:
```bash
aws ecs describe-services \
  --cluster ecs-demo-cluster \
  --services ecs-demo-nginx-service \
  --region us-east-1 \
  --query 'services[0].events[0:5]'
```

Check task logs:
```bash
aws logs tail /ecs/ecs-demo --follow --region us-east-1
```

## Cost Estimate

Approximate monthly costs (us-east-1):
- 2x t3.small EC2 instances: ~$30
- 2x NAT Gateways: ~$65
- Data transfer: Variable
- CloudWatch Logs: Minimal

**Total**: ~$95-100/month
