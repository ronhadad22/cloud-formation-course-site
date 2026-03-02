# VPC Peering Demo

## Overview

This module covers VPC networking and DNS in AWS:

1. **VPC Peering + Private Hosted Zones** - Connect two isolated VPCs with peering and DNS
2. **Route 53 Resolvers** - Hybrid DNS between AWS and on-premises using inbound/outbound resolver endpoints

## Architecture

- **VPC A (Production):** 10.0.0.0/16 - Public + Private subnets, EC2 with web server
- **VPC B (Development):** 10.1.0.0/16 - Public + Private subnets, EC2 with web server
- **VPC Peering Connection:** Bidirectional link between VPC A and VPC B
- **Route 53 Private Hosted Zone:** `internal.company.local` - DNS resolution across both VPCs

## Files

```
vpc-peering/
├── README.md                  # This file
├── STUDENT-EXERCISE.md        # Exercise 1: VPC Peering + Private Hosted Zones
├── RESOLVER-EXERCISE.md       # Exercise 2: Route 53 Inbound/Outbound Resolvers
└── cloudformation/
    ├── vpc-peering.yaml       # Template 1: 2 VPCs + peering + DNS + EC2s
    └── route53-resolvers.yaml # Template 2: Hybrid DNS with resolver endpoints
```

## Quick Deploy

### Exercise 1: VPC Peering
```bash
aws cloudformation create-stack \
  --stack-name vpc-peering-demo \
  --template-body file://cloudformation/vpc-peering.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=YOUR_KEY_NAME \
  --region us-east-1
```

### Exercise 2: Route 53 Resolvers
```bash
aws cloudformation create-stack \
  --stack-name r53-resolver-demo \
  --template-body file://cloudformation/route53-resolvers.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=YOUR_KEY_NAME \
  --region us-east-1
```

## Quick Cleanup

```bash
aws cloudformation delete-stack --stack-name vpc-peering-demo --region us-east-1
aws cloudformation delete-stack --stack-name r53-resolver-demo --region us-east-1
```

## Key Concepts Covered

### Exercise 1: VPC Peering
- VPC isolation and why peering is needed
- VPC Peering connection setup
- Route table configuration for cross-VPC traffic
- Security group rules for peering
- Non-transitive nature of VPC peering
- Private IP vs Public IP in peering context
- Route 53 Private Hosted Zones for cross-VPC DNS
- A records vs CNAME records

### Exercise 2: Route 53 Resolvers
- Hybrid DNS architecture (AWS ↔ on-premises)
- Route 53 Inbound Resolver (on-prem → AWS DNS)
- Route 53 Outbound Resolver (AWS → on-prem DNS)
- Forwarding rules for domain-based DNS routing
- BIND DNS server configuration
- DNS resolution vs network connectivity

## Cost

### Exercise 1: VPC Peering
- VPC Peering: **FREE**
- Route 53 Private Hosted Zone: $0.50/month (prorated)
- EC2 (2x t3.micro): ~$0.02/hour
- Total for 1-hour demo: **< $0.10**

### Exercise 2: Route 53 Resolvers
- Resolver endpoints (2 × 2 ENIs): ~$0.25/hour
- EC2 (2x t3.micro): ~$0.02/hour
- Total for 1-hour demo: **~$0.30**
- **⚠️ Delete resolver stack promptly - endpoints cost ~$6/day!**
