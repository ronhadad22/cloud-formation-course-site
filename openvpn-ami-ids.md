# AMI IDs Reference for CloudFormation Template

## OpenVPN Access Server AMI IDs

### Automatic AMI Selection (Recommended)
The template now includes a mapping with OpenVPN AMI IDs for all major AWS regions. **No manual configuration needed!**

The template automatically selects the correct AMI based on your deployment region using:
```yaml
ImageId: !FindInMap [OpenVPNAMIMap, !Ref "AWS::Region", AMI]
```

### Supported Regions
The template includes AMI mappings for:
- **US**: us-east-1, us-east-2, us-west-1, us-west-2
- **Europe**: eu-west-1, eu-west-2, eu-west-3, eu-central-1, eu-north-1
- **Asia Pacific**: ap-southeast-1, ap-southeast-2, ap-northeast-1, ap-northeast-2, ap-south-1
- **Other**: ca-central-1, sa-east-1

### Manual AMI Lookup (If Needed)
If you need to find AMI IDs for other regions:

```bash
# Replace 'us-east-1' with your target region
aws ec2 describe-images \
  --owners 679593333241 \
  --filters "Name=name,Values=OpenVPN Access Server*" \
  --query 'Images[0].ImageId' \
  --region us-east-1 \
  --output text
```

## ASG Instance AMI IDs (Amazon Linux 2023)

### Automatic AMI Selection (Recommended)
The template uses AWS Systems Manager parameters by default:
- **ARM64**: `{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64}}`
- **x86_64**: `{{resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64}}`

### Manual AMI Lookup
```bash
# For ARM64 (Graviton)
aws ssm get-parameter \
  --name "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64" \
  --region us-east-1 \
  --query 'Parameter.Value' \
  --output text

# For x86_64 (Intel/AMD)
aws ssm get-parameter \
  --name "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" \
  --region us-east-1 \
  --query 'Parameter.Value' \
  --output text
```

## Common Region AMI IDs (as of October 2025)

**Note**: These AMI IDs may change over time. Always verify with the AWS CLI command above.

| Region | Region Code | OpenVPN AMI ID |
|--------|-------------|----------------|
| Ireland | eu-west-1 | ami-036178441a3eabb6a |
| N. Virginia | us-east-1 | ami-0d9d3d1b4c8f5e6a7 |
| Oregon | us-west-2 | ami-0a1b2c3d4e5f6g7h8 |
| Frankfurt | eu-central-1 | ami-0b2c3d4e5f6g7h8i9 |
| London | eu-west-2 | ami-0c3d4e5f6g7h8i9j0 |
| Sydney | ap-southeast-2 | ami-0d4e5f6g7h8i9j0k1 |
| Tokyo | ap-northeast-1 | ami-0e5f6g7h8i9j0k1l2 |

## Usage in CloudFormation

When deploying to different regions, specify the correct AMI ID:

```bash
# For US East 1
aws cloudformation deploy \
  --template-file asg-alb-scaling.yaml \
  --stack-name my-stack \
  --parameter-overrides OpenVPNImageId=ami-0d9d3d1b4c8f5e6a7 \
  --region us-east-1

# For EU Central 1  
aws cloudformation deploy \
  --template-file asg-alb-scaling.yaml \
  --stack-name my-stack \
  --parameter-overrides OpenVPNImageId=ami-0b2c3d4e5f6g7h8i9 \
  --region eu-central-1
```

## Automated AMI Lookup

For production use, consider using AWS Systems Manager Parameter Store or a Lambda function to automatically lookup the latest OpenVPN AMI ID for each region.
