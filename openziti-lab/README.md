# OpenZiti Zero Trust Networking Lab

A hands-on lab where students deploy an OpenZiti overlay network on AWS, create identities/services/policies, and access a private application through a zero trust tunnel.

## Architecture

```
PUBLIC SUBNET                    PRIVATE SUBNET
┌──────────────────┐             ┌──────────────────┐
│ Ziti Controller  │             │ App Server       │
│ + Edge Router    │◄──overlay──►│ (no public IP)   │
│ (t3.medium)      │             │ HTTP on :80      │
└──────────────────┘             └──────────────────┘

┌──────────────────┐
│ Client Instance  │──── Ziti Overlay ────► App Server
│ + Ziti Tunneler  │     (encrypted)
└──────────────────┘
```

The App Server has **no public IP**. It is only reachable through the OpenZiti overlay.

## Lab Duration

~2 hours

## What Students Learn

- Underlay vs overlay networks
- Deploy OpenZiti Controller + Edge Router
- Create Identities with X.509 certificates
- Define Services and map them to private resources
- Configure Policies (Bind/Dial, Edge Router)
- Install and use the Ziti Edge Tunnel
- Access a private app through zero trust overlay
- Compare VPN vs zero trust networking
- Instant access revocation via policy changes

## Prerequisites

- AWS account with admin access
- AWS CLI configured
- SSH key pair in target region

## Quick Start

```bash
export AWS_REGION=eu-central-1

aws cloudformation create-stack \
  --stack-name ziti-lab \
  --template-body file://cloudformation/01-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=ziti-lab-key \
  --capabilities CAPABILITY_NAMED_IAM

# Follow student-lab-guide/LAB-MANUAL.md
```

## Project Structure

```
openziti-lab/
├── README.md
├── cloudformation/
│   └── 01-infrastructure.yaml       # VPC, Ziti controller, app server, client
├── scripts/
│   └── validate-ziti-access.sh       # Validate overlay connectivity
└── student-lab-guide/
    └── LAB-MANUAL.md                 # Full step-by-step lab manual
```

## Estimated Cost

| Resource | Cost |
|----------|------|
| Ziti Controller (t3.medium) | ~$0.04/hr |
| App Server (t3.micro) | ~$0.01/hr |
| Client Instance (t3.micro) | ~$0.01/hr |
| NAT Gateway | ~$0.045/hr |
| **Total for 2-hour lab** | **~$0.25** |

**⚠️ Clean up after the lab! NAT Gateway charges ~$0.045/hr even when idle.**

## Troubleshooting

- **expressInstall fails:** Ensure `wget`, `jq`, `tar` are installed. Check outbound internet access.
- **Tunneler install fails with "No match for argument":** The `install.bash` script doesn't work on Amazon Linux 2023. Create the RPM repo manually using the `redhat9` repo (see lab manual Phase 6).
- **Tunneler can't enroll:** JWT tokens are one-time use. If enrollment fails, delete the identity and recreate it.
- **`securevault.ziti` not resolving:** The tunneler must be running. Check `sudo systemctl status ziti-edge-tunnel`.
- **Service unreachable after policy creation:** Wait ~10 seconds for policy propagation. Check `ziti edge policy-advisor identities -q client-workstation`.
- **Can't SSH to app server:** Use the Ziti controller as a jump host with agent forwarding: `ssh -A -i key.pem -J ec2-user@$ZITI_IP ec2-user@$APP_PRIVATE_IP`.
- **`hostname -s` doesn't match ZITI_HOME:** The quickstart uses the FQDN. Use `ls ~/.ziti/quickstart/` to find the correct directory name.
