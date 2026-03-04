# OpenZiti Zero Trust Networking Lab

## Scenario: SecureVault Corp

**SecureVault Corp** manages sensitive credentials and secrets for enterprise clients. After a security audit revealed that their internal portal was accessible to anyone on the corporate network, the CISO mandated:

- **Zero trust access** — no implicit trust based on network location
- **Identity-based authentication** — every connection must be authenticated with X.509 certificates
- **No open inbound ports** — the app server must have zero listening ports on the underlay network
- **Encrypted overlay** — all traffic must traverse an encrypted overlay network

Your job is to deploy an **OpenZiti** zero trust overlay network and prove that a private application (with no public IP and no open firewall ports to the internet) can be securely accessed only through the Ziti network.

**⚠️ This is a training environment. No real secrets are stored.**

---

## Learning Objectives

By the end of this lab, you will be able to:

- ✅ Explain the difference between **underlay** and **overlay** networks
- ✅ Deploy an OpenZiti **Controller** and **Edge Router**
- ✅ Create **Identities** with X.509 certificates
- ✅ Define **Services** that map to private resources
- ✅ Configure **Policies** (Service Policies, Edge Router Policies)
- ✅ Install and use the **Ziti Tunneler** on a client machine
- ✅ Access a private application through the zero trust overlay
- ✅ Compare traditional VPN vs zero trust networking

---

## Zero Trust vs Traditional VPN

| Aspect | Traditional VPN | OpenZiti (Zero Trust) |
|--------|----------------|----------------------|
| **Trust model** | Trust the network — once connected, access everything | Trust nothing — verify every connection |
| **Authentication** | Username/password at the gateway | Mutual TLS (mTLS) with X.509 certificates per identity |
| **Network exposure** | VPN gateway has open ports on the internet | Controller/router ports open, but services are invisible |
| **Lateral movement** | Easy — attacker on VPN can scan the network | Impossible — each service requires explicit policy |
| **Access granularity** | Network-level (IP ranges) | Application-level (specific services) |
| **Attack surface** | Large — all VPN users share the same network | Minimal — each identity can only see authorized services |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS VPC (10.0.0.0/16)                    │
│                                                             │
│  PUBLIC SUBNET (10.0.1.0/24)    PRIVATE SUBNET (10.0.2.0/24)│
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │ Ziti Controller  │           │ App Server       │        │
│  │ + Edge Router    │◄──Ziti───►│ (SecureVault)    │        │
│  │ (t3.medium)      │  Overlay  │ (t3.micro)       │        │
│  │                  │           │ NO public IP     │        │
│  │ Ports:           │           │ HTTP on :80      │        │
│  │  8440-8443       │           │ (VPC only)       │        │
│  └──────────────────┘           └──────────────────┘        │
│                                                             │
│  ┌──────────────────┐                                       │
│  │ Client Instance  │                                       │
│  │ (t3.micro)       │                                       │
│  │ Ziti Tunneler    │───── Ziti Overlay ─────► App Server   │
│  └──────────────────┘       (encrypted)                     │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** The App Server has **no public IP** and its security group only allows HTTP from the **private subnet** (10.0.2.0/24). The Client Instance in the public subnet **cannot** reach the App Server directly. With OpenZiti, the client connects through the encrypted overlay.

---

## Prerequisites

- AWS account with admin access
- AWS CLI configured
- SSH key pair in your target region

---

## Phase 1: Deploy Infrastructure (10 minutes)

### Step 1.1: Set Environment Variables

```bash
export AWS_REGION=eu-central-1
export AWS_PROFILE=<your-profile>
```

### Step 1.2: Create a Key Pair (if needed)

```bash
aws ec2 create-key-pair \
  --key-name ziti-lab-key \
  --query 'KeyMaterial' --output text > ziti-lab-key.pem
chmod 400 ziti-lab-key.pem
```

### Step 1.3: Deploy the Stack

```bash
aws cloudformation create-stack \
  --stack-name ziti-lab \
  --template-body file://cloudformation/01-infrastructure.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=ziti-lab-key \
  --capabilities CAPABILITY_NAMED_IAM

aws cloudformation wait stack-create-complete --stack-name ziti-lab
```

### Step 1.4: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name ziti-lab \
  --query 'Stacks[0].Outputs' --output table
```

Save the values:

```bash
ZITI_IP=$(aws cloudformation describe-stacks --stack-name ziti-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`ZitiControllerPublicIP`].OutputValue' --output text)

APP_PRIVATE_IP=$(aws cloudformation describe-stacks --stack-name ziti-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`AppServerPrivateIP`].OutputValue' --output text)

CLIENT_IP=$(aws cloudformation describe-stacks --stack-name ziti-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`ClientPublicIP`].OutputValue' --output text)

echo "Ziti Controller: $ZITI_IP"
echo "App Server (private): $APP_PRIVATE_IP"
echo "Client Instance: $CLIENT_IP"
```

### Step 1.5: Prove the App Is Unreachable

Try to access the private app server from the client:

```bash
ssh -i ziti-lab-key.pem ec2-user@$CLIENT_IP

# From the client instance — try to reach the app server
curl --connect-timeout 5 http://<APP_PRIVATE_IP> || echo "CANNOT REACH — app server is private!"

exit
```

> **Q1:** Why can't the client reach the app server? They are in the same VPC — what is blocking the connection?

> **Q2:** In a traditional setup, how would you solve this? What are the security downsides?

---

## Phase 2: Deploy OpenZiti Controller & Router (20 minutes)

### Step 2.1: SSH into the Ziti Controller Instance

```bash
ssh -i ziti-lab-key.pem ec2-user@$ZITI_IP
```

### Step 2.2: Set Up Environment Variables

```bash
export EXTERNAL_IP="$(curl -s http://checkip.amazonaws.com)"
export EXTERNAL_DNS="${EXTERNAL_IP}"

export ZITI_CTRL_EDGE_IP_OVERRIDE="${EXTERNAL_IP}"
export ZITI_CTRL_ADVERTISED_ADDRESS="${EXTERNAL_DNS}"
export ZITI_CTRL_ADVERTISED_PORT=8440
export ZITI_CTRL_EDGE_ADVERTISED_ADDRESS="${EXTERNAL_DNS}"
export ZITI_CTRL_EDGE_ADVERTISED_PORT=8441
export ZITI_ROUTER_ADVERTISED_ADDRESS="${EXTERNAL_DNS}"
export ZITI_ROUTER_IP_OVERRIDE="${EXTERNAL_IP}"
export ZITI_ROUTER_PORT=8442
```

### Step 2.3: Run the Express Install

```bash
source /dev/stdin <<< "$(wget -qO- https://get.openziti.io/ziti-cli-functions.sh)"; expressInstall
```

This will:
1. Download the Ziti binaries
2. Generate a PKI (certificates)
3. Start the Controller
4. Start an Edge Router
5. Configure everything automatically

Wait for it to complete (~2-3 minutes).

> **Q3:** What PKI components did the expressInstall create? Why is PKI critical for zero trust?

### Step 2.4: Verify the Installation

```bash
# Check that the controller is running
ziti edge login "${ZITI_CTRL_EDGE_ADVERTISED_ADDRESS}:${ZITI_CTRL_EDGE_ADVERTISED_PORT}" \
  --username admin --password "${ZITI_PWD}" --yes

# List edge routers
ziti edge list edge-routers

# Check controller version
ziti edge version
```

> **Q4:** What is the admin password? Where is it stored? (Hint: check the `ZITI_PWD` variable in your env file) Why is this a security concern in production?

### Step 2.5: Set Up systemd (Persistence)

The helper functions (`startController`, `stopController`, etc.) are defined in the `ziti-cli-functions.sh` script. Source it first, then set up systemd:

```bash
# Source the helper functions
source /dev/stdin <<< "$(wget -qO- https://get.openziti.io/ziti-cli-functions.sh)"

createControllerSystemdFile
createRouterSystemdFile "${ZITI_ROUTER_NAME}"

sudo cp "${ZITI_HOME}/${ZITI_CTRL_NAME}.service" /etc/systemd/system/ziti-controller.service
sudo cp "${ZITI_HOME}/${ZITI_ROUTER_NAME}.service" /etc/systemd/system/ziti-router.service
sudo systemctl daemon-reload
sudo systemctl enable --now ziti-controller
sudo systemctl enable --now ziti-router

# Stop the shell-started processes (systemd will manage them now)
stopRouter
stopController

# Verify systemd is running them
sudo systemctl status ziti-controller --no-pager -l
sudo systemctl status ziti-router --no-pager -l
```

### Step 2.6: Re-source Environment After systemd Switch

> **Note:** The quickstart directory uses the full hostname (FQDN), not the short name.

```bash
# Find your ZITI_HOME directory
ZITI_DIR=$(ls ~/.ziti/quickstart/)
source ~/.ziti/quickstart/$ZITI_DIR/$ZITI_DIR.env

# Re-login
ziti edge login "${ZITI_CTRL_EDGE_ADVERTISED_ADDRESS}:${ZITI_CTRL_EDGE_ADVERTISED_PORT}" \
  --username admin --password "${ZITI_PWD}" --yes
```

---

## Phase 3: Create Identities (15 minutes)

Identities represent endpoints that can connect to the Ziti network. Each identity gets a unique X.509 certificate.

### Step 3.1: Create the App Server Identity

This identity will be used by the tunneler on the app server to **host** (bind) the service.

```bash
ziti edge create identity device app-server \
  -o /tmp/app-server.jwt \
  -a "app-servers"
```

The `-a "app-servers"` flag adds a **role attribute** — we'll use this in policies later.

### Step 3.2: Create the Client Identity

This identity will be used by the tunneler on the client to **access** (dial) the service.

```bash
ziti edge create identity device client-workstation \
  -o /tmp/client-workstation.jwt \
  -a "clients"
```

### Step 3.3: Verify Identities

```bash
ziti edge list identities
```

You should see: `admin`, `app-server`, `client-workstation`, and the router identity.

> **Q5:** What is a JWT enrollment token? What happens after an identity enrolls with it?

> **Q6:** What are role attributes and why are they useful instead of referencing identities by name?

---

## Phase 4: Create a Service (10 minutes)

A **Service** defines a resource that can be accessed through the Ziti network. We'll create a service for the private web app.

### Step 4.1: Create an Intercept Config

This tells the client-side tunneler what traffic to intercept and redirect through Ziti:

```bash
ziti edge create config securevault-intercept-config intercept.v1 \
  '{"protocols":["tcp"],"addresses":["securevault.ziti"],"portRanges":[{"low":80,"high":80}]}'
```

This means: when the client tries to reach `securevault.ziti:80`, the tunneler will intercept it and send it through the Ziti network.

### Step 4.2: Create a Host Config

This tells the server-side tunneler where to forward the traffic:

```bash
ziti edge create config securevault-host-config host.v1 \
  '{"protocol":"tcp","address":"localhost","port":80}'
```

This means: on the app server, forward the Ziti traffic to `localhost:80` (the httpd web server).

### Step 4.3: Create the Service

```bash
ziti edge create service securevault-web \
  --configs securevault-intercept-config,securevault-host-config \
  -a "web-services"
```

### Step 4.4: Verify

```bash
ziti edge list services
ziti edge list configs
```

> **Q7:** What is the difference between an intercept config and a host config? Which side uses which?

---

## Phase 5: Create Policies (10 minutes)

Policies control **who** can access **what** through **which routers**.

### Step 5.1: Create a Bind Service Policy

Allow the `app-server` identity to **host** (bind) the service:

```bash
ziti edge create service-policy securevault-bind Bind \
  --service-roles "@securevault-web" \
  --identity-roles "#app-servers"
```

### Step 5.2: Create a Dial Service Policy

Allow `client` identities to **access** (dial) the service:

```bash
ziti edge create service-policy securevault-dial Dial \
  --service-roles "@securevault-web" \
  --identity-roles "#clients"
```

### Step 5.3: Verify Policies

```bash
ziti edge list service-policies

# Check what the client identity can access
ziti edge policy-advisor identities -q client-workstation
```

> **Q8:** What is the difference between `@` and `#` in policy roles? (Hint: one is by name, one is by attribute)

> **Q9:** What happens if you create a service but forget to create a Bind policy? Can clients access it?

> **Q10:** How does this compare to traditional firewall rules? What are the advantages?

---

## Phase 6: Enroll and Connect (20 minutes)

### Step 6.1: Copy JWT Tokens to the Instances

**Open a new terminal** on your local machine. First, add your key to the SSH agent so it can be forwarded through jump hosts:

```bash
ssh-add ziti-lab-key.pem
```

Copy the JWTs from the Ziti controller to your local machine, then to the target instances:

```bash
# Download both JWTs from the Ziti controller
scp -i ziti-lab-key.pem -o StrictHostKeyChecking=no \
  ec2-user@$ZITI_IP:/tmp/app-server.jwt /tmp/app-server.jwt

scp -i ziti-lab-key.pem -o StrictHostKeyChecking=no \
  ec2-user@$ZITI_IP:/tmp/client-workstation.jwt /tmp/client-workstation.jwt

# Copy app-server JWT via the Ziti controller (jump host with agent forwarding)
ssh -A -i ziti-lab-key.pem -o StrictHostKeyChecking=no ec2-user@$ZITI_IP \
  "scp -o StrictHostKeyChecking=no /tmp/app-server.jwt ec2-user@$APP_PRIVATE_IP:/tmp/app-server.jwt"

# Copy client JWT directly to the client instance
scp -i ziti-lab-key.pem -o StrictHostKeyChecking=no \
  /tmp/client-workstation.jwt ec2-user@$CLIENT_IP:/tmp/client-workstation.jwt
```

### Step 6.2: Install and Enroll the Tunneler on the App Server

SSH to the app server through the Ziti controller (jump host with agent forwarding):

```bash
ssh -A -i ziti-lab-key.pem -o StrictHostKeyChecking=no \
  -J ec2-user@$ZITI_IP ec2-user@$APP_PRIVATE_IP
```

On the app server:

```bash
# Create the OpenZiti RPM repo (Amazon Linux 2023 uses the redhat9 repo)
sudo tee /etc/yum.repos.d/openziti.repo > /dev/null <<'EOF'
[OpenZiti]
name=OpenZiti
baseurl=https://packages.openziti.org/zitipax-openziti-rpm-stable/redhat9/$basearch
enabled=1
gpgcheck=0
gpgkey=https://packages.openziti.org/zitipax-openziti-rpm-stable/redhat9/$basearch/repodata/repomd.xml.key
repo_gpgcheck=1
EOF

# Install the Ziti Edge Tunnel
sudo yum install -y ziti-edge-tunnel

# Enroll: copy the JWT to the identities directory and restart
# The service auto-enrolls any .jwt files it finds on startup
sudo cp /tmp/app-server.jwt /opt/openziti/etc/identities/app-server.jwt
sudo chown -R :ziti /opt/openziti/etc/identities
sudo chmod -R ug=rwX,o-rwx /opt/openziti/etc/identities
sudo systemctl restart ziti-edge-tunnel

# Wait a moment, then check status
sleep 5
sudo systemctl status ziti-edge-tunnel --no-pager

exit
```

### Step 6.3: Install and Enroll the Tunneler on the Client

```bash
ssh -i ziti-lab-key.pem -o StrictHostKeyChecking=no ec2-user@$CLIENT_IP
```

On the client:

```bash
# Create the OpenZiti RPM repo (Amazon Linux 2023 uses the redhat9 repo)
sudo tee /etc/yum.repos.d/openziti.repo > /dev/null <<'EOF'
[OpenZiti]
name=OpenZiti
baseurl=https://packages.openziti.org/zitipax-openziti-rpm-stable/redhat9/$basearch
enabled=1
gpgcheck=0
gpgkey=https://packages.openziti.org/zitipax-openziti-rpm-stable/redhat9/$basearch/repodata/repomd.xml.key
repo_gpgcheck=1
EOF

# Install the Ziti Edge Tunnel
sudo yum install -y ziti-edge-tunnel

# Enroll: copy the JWT to the identities directory and restart
sudo cp /tmp/client-workstation.jwt /opt/openziti/etc/identities/client-workstation.jwt
sudo chown -R :ziti /opt/openziti/etc/identities
sudo chmod -R ug=rwX,o-rwx /opt/openziti/etc/identities
sudo systemctl restart ziti-edge-tunnel

# Wait a moment, then check status
sleep 5
sudo systemctl status ziti-edge-tunnel --no-pager
```

### Step 6.4: Test Zero Trust Access!

Still on the client instance:

```bash
# This should NOW work through the Ziti overlay!
curl http://securevault.ziti

# Test the API endpoints
curl http://securevault.ziti/api/health | jq .
curl http://securevault.ziti/api/secrets | jq .
```

🎉 **If you see the SecureVault page, you have successfully accessed a private server through a zero trust overlay network!**

> **Q11:** The app server has no public IP. How is the client reaching it? Trace the full path of the request.

> **Q12:** What DNS resolution is happening when you curl `securevault.ziti`? Who resolves this name?

---

## Phase 7: Security Verification (10 minutes)

### Step 7.1: Prove Direct Access Still Fails

From the client instance:

```bash
# Try direct HTTP to the private IP — should FAIL
curl --connect-timeout 5 http://$APP_PRIVATE_IP || echo "BLOCKED — as expected!"

# Try to ping — should FAIL
ping -c 2 -W 2 $APP_PRIVATE_IP || echo "BLOCKED — as expected!"
```

### Step 7.2: Revoke Access

Go back to the Ziti controller and remove the client's dial policy:

```bash
# On the Ziti controller
ziti edge delete service-policy securevault-dial
```

Now try from the client:

```bash
# On the client — this should STOP working immediately
curl --connect-timeout 10 http://securevault.ziti || echo "ACCESS REVOKED!"
```

### Step 7.3: Restore Access

```bash
# On the Ziti controller — recreate the policy
ziti edge create service-policy securevault-dial Dial \
  --service-roles "@securevault-web" \
  --identity-roles "#clients"
```

Wait ~10 seconds, then test from the client:

```bash
# Should work again
curl http://securevault.ziti
```

> **Q13:** How quickly was access revoked after deleting the policy? Compare this to revoking a VPN user's access.

> **Q14:** An attacker compromises the client machine. Can they scan the network to discover other services? Why or why not?

---

## Bonus Phase: Connect From Your Own Laptop! (15 minutes)

The most impressive demo of zero trust is accessing the private app server **directly from your laptop** — across the internet, without a VPN, without opening any ports on the app server.

### Option A: macOS

1. Install **Ziti Desktop Edge for macOS** from the [App Store](https://apps.apple.com/app/ziti-desktop-edge/id1460484572)
2. Download the `client-workstation.jwt` file to your laptop (you already have it from Step 6.1)
3. Open the Ziti Desktop Edge app
4. Click the **+** button to add an identity
5. Select the `.jwt` file — it will enroll automatically
6. Toggle **Ziti On**
7. Open your browser and go to `http://securevault.ziti`

### Option B: Windows

1. Download **Ziti Desktop Edge for Windows** from [GitHub Releases](https://github.com/openziti/desktop-edge-win/releases)
2. Install and run the app
3. Add the `client-workstation.jwt` identity
4. Toggle the connection on
5. Open your browser and go to `http://securevault.ziti`

### Option C: Linux

Use the same RPM/DEB install from Phase 6.3 on your local Linux machine.

### What's Happening

```
YOUR LAPTOP                          AWS
┌──────────────┐                     ┌─────────────────────────┐
│ Ziti Desktop │──── outbound ──────►│ Edge Router :8442       │
│ Edge app     │     (encrypted)     │         │               │
│              │                     │         ▼ (overlay)     │
│ browser:     │                     │ App Server (private)    │
│ securevault  │◄── response ───────│ localhost:80 → httpd    │
│ .ziti        │     (encrypted)     │                         │
└──────────────┘                     └─────────────────────────┘
```

Your laptop's Ziti tunneler connects **outbound** to the Edge Router on port 8442. No inbound ports are needed on your machine. The app server remains completely private — no public IP, no open ports to the internet.

> **Q19:** You just accessed a server with no public IP from your home network. How is this different from a traditional VPN? What are the security implications?

> **Q20:** If you create a second identity for a colleague, can they also access `securevault.ziti`? What policy changes would be needed?

> **Important:** If you enrolled the `client-workstation` JWT on the EC2 client instance already, you'll need to create a **new identity** for your laptop (JWTs are one-time use):
>
> ```bash
> # On the Ziti controller
> ziti edge create identity laptop-user \
>   -o /tmp/laptop-user.jwt \
>   -a "clients"
> ```
> Then download `/tmp/laptop-user.jwt` and use it in the desktop app.

---

## Phase 8: Investigation Questions

> **Q15:** Draw a diagram showing the full path of a request from the client to the app server through the Ziti overlay. Label each component.

> **Q16:** Your company has 200 microservices. How would you use role attributes and policies to manage access at scale?

> **Q17:** Compare OpenZiti to AWS PrivateLink. When would you use each?

> **Q18:** What would happen if the Ziti Controller goes down? Can existing connections continue? Can new connections be established?

---

## Phase 9: Cleanup ⚠️

```bash
# 1. Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name ziti-lab

aws cloudformation wait stack-delete-complete --stack-name ziti-lab

# 2. Delete the key pair
aws ec2 delete-key-pair --key-name ziti-lab-key
rm -f ziti-lab-key.pem

echo "✅ Cleanup complete!"
```

---

## Answer Key

<details>
<summary>Click to reveal answers (try on your own first!)</summary>

**Q1:** The client is in the public subnet (10.0.1.0/24) and the app server is in the private subnet (10.0.2.0/24). The app server's security group only allows HTTP from the private subnet CIDR (10.0.2.0/24), and SSH only from the Ziti controller's security group. The client in 10.0.1.0/24 is blocked by the security group — the connection times out.

**Q2:** Traditional solutions: open the security group wider, set up a VPN, or use a bastion host. Downsides: VPN gives broad network access (lateral movement risk), bastion hosts are single points of failure, and wider security groups increase the attack surface.

**Q3:** The expressInstall creates a full PKI: a root CA, intermediate CAs, and certificates for the controller and router. PKI is critical because every connection in OpenZiti is mutually authenticated (mTLS) — both sides prove their identity with certificates. Without PKI, there's no way to establish trust.

**Q4:** The admin password is stored in the `ZITI_PWD` environment variable, defined in the env file at `${ZITI_HOME}/<hostname>.env`. It's stored as plain text. In production, this is a security concern — you should change it immediately, use a secrets manager, and configure external identity providers (OIDC) instead of local passwords.

**Q5:** A JWT enrollment token is a one-time-use token that allows an identity to register with the controller and receive its X.509 certificate. After enrollment, the JWT is invalidated — it cannot be reused. The identity now authenticates using its certificate.

**Q6:** Role attributes are tags (like `app-servers`, `clients`) that group identities logically. Instead of referencing each identity by name in every policy, you tag identities with attributes and write policies against attributes. This scales much better — adding a new server just requires giving it the right attribute.

**Q7:** The **intercept config** is used by the client-side tunneler — it defines what traffic to capture (e.g., `securevault.ziti:80`). The **host config** is used by the server-side tunneler — it defines where to forward the traffic locally (e.g., `localhost:80`). The client intercepts, the server hosts.

**Q8:** `@` references an entity by **name** (e.g., `@securevault-web` = the service named "securevault-web"). `#` references entities by **role attribute** (e.g., `#clients` = all identities with the "clients" attribute). Using `#` is more scalable.

**Q9:** Without a Bind policy, no identity is authorized to host the service. Even if clients have Dial access, the service has no backend — connections will fail because no one is listening on the Ziti side.

**Q10:** Traditional firewall rules are IP-based and static. OpenZiti policies are identity-based and dynamic. Advantages: no IP management, instant revocation, granular per-service access, works across networks/clouds, and every connection is authenticated.

**Q11:** Path: Client tunneler intercepts `securevault.ziti:80` → encrypts and sends to the Edge Router via the Ziti overlay → Edge Router routes to the app server's tunneler → app server tunneler decrypts and forwards to `localhost:80` → httpd responds → reverse path back to client. The app server's private IP is never exposed.

**Q12:** The Ziti tunneler acts as a local DNS resolver. When the client resolves `securevault.ziti`, the tunneler intercepts the DNS query and resolves it to a local IP (e.g., 100.64.x.x) that it manages. No external DNS is involved — the name only exists within the Ziti overlay.

**Q13:** Access is revoked almost immediately (within seconds) because the controller pushes policy updates to connected edge routers and tunnelers. Compare this to VPN: you'd need to revoke the user's VPN credentials, wait for their session to expire, and possibly restart the VPN server.

**Q14:** No. In OpenZiti, the client can only see services it has been explicitly granted Dial access to. There is no network to scan — the overlay is application-level, not network-level. The attacker cannot discover other services, other identities, or other IP addresses.

**Q15:** Diagram should show: Client App → Ziti Tunneler (intercept) → Ziti Edge Router → Ziti Edge Router (or same router) → Ziti Tunneler (host) → App Server httpd. All connections between tunnelers and routers use mTLS.

**Q16:** Use role attributes like `team:payments`, `env:production`, `tier:critical`. Create policies like "payments team can dial payment services in production". When a new microservice is added, just tag it with the right attributes — no policy changes needed.

**Q17:** AWS PrivateLink: managed by AWS, works within AWS ecosystem, simpler setup, but limited to AWS and costs per endpoint. OpenZiti: works across any cloud/on-prem, more flexible policies, open source, but requires managing the overlay infrastructure. Use PrivateLink for simple AWS-to-AWS private connectivity. Use OpenZiti for multi-cloud, on-prem, or when you need fine-grained identity-based access control.

**Q18:** If the controller goes down: existing connections continue working (data plane is independent). However, no new connections can be established because the controller handles authentication and policy distribution. In production, you'd run a controller cluster for high availability.

</details>

---

## What You Learned

- ✅ Zero trust means **verify every connection** — no implicit trust based on network location
- ✅ OpenZiti creates an **encrypted overlay** network on top of the existing underlay
- ✅ **Identities** authenticate with X.509 certificates (mTLS)
- ✅ **Services** define what can be accessed, not where it is
- ✅ **Policies** control who can dial (access) or bind (host) each service
- ✅ The **tunneler** intercepts traffic and routes it through the overlay
- ✅ Access can be **instantly revoked** by changing policies
- ✅ Zero trust eliminates **lateral movement** — attackers can't scan the network

---

## Cost Breakdown

| Resource | Cost | Duration |
|----------|------|----------|
| Ziti Controller (t3.medium) | ~$0.04/hr | Lab duration |
| App Server (t3.micro) | ~$0.01/hr | Lab duration |
| Client Instance (t3.micro) | ~$0.01/hr | Lab duration |
| NAT Gateway | ~$0.045/hr | Lab duration |
| **Estimated total for 2-hour lab** | **~$0.25** | |

**⚠️ Remember to clean up! The NAT Gateway charges ~$0.045/hr even when idle.**
