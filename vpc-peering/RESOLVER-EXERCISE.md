# Route 53 Resolver - Student Exercise

## What You'll Learn

- How DNS works in hybrid cloud environments
- What Route 53 Inbound Resolver does (on-premises → AWS DNS)
- What Route 53 Outbound Resolver does (AWS → on-premises DNS)
- How forwarding rules route DNS queries between environments
- How to configure and test hybrid DNS resolution

**Time:** 30-45 minutes  
**Cost:** ~$0.30/hour (resolver endpoints)

---

## Architecture

```
                    ┌─────────────────────────────────┐
                    │   Route 53 Private Hosted Zone   │
                    │   cloud.internal                 │
                    │                                  │
                    │   app.cloud.internal → A record  │
                    │   db.cloud.internal  → A record  │
                    │   api.cloud.internal → CNAME     │
                    └──────────┬──────────────────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │   VPC A - AWS Cloud (10.0.0.0/16)                   │
    │                          │                          │
    │   ┌──────────────────────┴───────────────────┐      │
    │   │         Route 53 Resolver                │      │
    │   │                                          │      │
    │   │  ┌─────────────┐    ┌──────────────┐     │      │
    │   │  │  INBOUND    │    │  OUTBOUND     │     │      │
    │   │  │  Endpoint   │    │  Endpoint     │     │      │
    │   │  │             │    │               │     │      │
    │   │  │ On-prem can │    │ AWS forwards  │     │      │
    │   │  │ resolve     │    │ onprem.local  │     │      │
    │   │  │ cloud.      │    │ queries to    │     │      │
    │   │  │ internal    │    │ on-prem DNS   │     │      │
    │   │  └──────▲──────┘    └──────┬────────┘     │      │
    │   └─────────┼──────────────────┼─────────────┘      │
    │             │                  │                     │
    │   ┌─────────┴──────────────────┴──────────┐         │
    │   │          EC2 - Cloud Server            │         │
    │   │          app.cloud.internal            │         │
    │   └───────────────────────────────────────┘         │
    └──────────────────────┬──────────────────────────────┘
                           │ VPC Peering
                           │ (simulates VPN/Direct Connect)
    ┌──────────────────────┼──────────────────────────────┐
    │   VPC B - "On-Premises" (10.1.0.0/16)               │
    │                      │                              │
    │   ┌──────────────────┴────────────────────┐         │
    │   │    EC2 - On-Prem Server               │         │
    │   │    Running BIND DNS Server            │         │
    │   │    Zone: onprem.local                 │         │
    │   │                                       │         │
    │   │    erp.onprem.local      → A record   │         │
    │   │    mail.onprem.local     → A record   │         │
    │   │    intranet.onprem.local → A record   │         │
    │   │    legacy.onprem.local   → CNAME      │         │
    │   └───────────────────────────────────────┘         │
    └─────────────────────────────────────────────────────┘
```

### How It Works

| Direction | Component | What It Does |
|-----------|-----------|-------------|
| On-prem → AWS | **Inbound Endpoint** | On-prem DNS server forwards `cloud.internal` queries to the inbound endpoint IPs in VPC A |
| AWS → On-prem | **Outbound Endpoint** + **Forwarding Rule** | When AWS instances query `onprem.local`, the outbound endpoint forwards to the on-prem DNS server (10.1.x.x) |

---

## Prerequisites

✅ AWS Account  
✅ AWS CLI configured  
✅ EC2 Key Pair created  
✅ Completed the VPC Peering exercise (recommended)

---

## Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository (skip if already done)
git clone https://github.com/ronhadad22/cloud-formation-course-site.git

# Navigate to the repository
cd cloud-formation-course-site

# Switch to the release branch
git checkout release

# Navigate to VPC peering directory
cd vpc-peering
```

### Login to AWS

**Option 1: Configure AWS CLI (First Time Setup):**
```bash
aws configure
```
```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: us-east-1
Default output format: json
```

**Option 2: Environment Variables (Mac/Linux):**
```bash
export AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
export AWS_REGION=us-east-1
```

**Option 2: Environment Variables (Windows PowerShell):**
```powershell
$env:AWS_ACCESS_KEY_ID = "YOUR_ACCESS_KEY"
$env:AWS_SECRET_ACCESS_KEY = "YOUR_SECRET_KEY"
$env:AWS_REGION = "us-east-1"
```

**Verify:**
```bash
aws sts get-caller-identity
```

---

## Step 2: Deploy the Stack (5-7 minutes)

```bash
# Replace 'your-key-name' with your EC2 key pair name
aws cloudformation create-stack \
  --stack-name r53-resolver-demo \
  --template-body file://cloudformation/route53-resolvers.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-name \
  --region us-east-1

# Wait for stack to complete (5-7 minutes - resolver endpoints take time)
aws cloudformation wait stack-create-complete \
  --stack-name r53-resolver-demo \
  --region us-east-1

echo "✅ Stack created!"
```

### Get the Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name r53-resolver-demo \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

Save these values:
- **Cloud Instance Public IP** → for SSH into AWS cloud server
- **Cloud Instance Private IP** → for testing
- **On-Prem Instance Public IP** → for SSH into on-prem server
- **On-Prem Instance Private IP** → this is also the on-prem DNS server

---

## Step 3: Understand the Setup (5 minutes)

Before testing, let's understand what was deployed.

### Check the Resolver Endpoints

```bash
# List all resolver endpoints
aws route53resolver list-resolver-endpoints \
  --region us-east-1 \
  --query 'ResolverEndpoints[].{Name:Name,Direction:Direction,Status:Status}' \
  --output table
```

> **Q1:** How many resolver endpoints do you see? What direction is each one?

### Get Inbound Endpoint IPs

```bash
# Get the inbound endpoint IPs - on-prem will send DNS queries here
aws route53resolver list-resolver-endpoint-ip-addresses \
  --resolver-endpoint-id INBOUND_ENDPOINT_ID \
  --region us-east-1 \
  --query 'IpAddresses[].{IP:Ip,AZ:AvailabilityZone,Status:Status}' \
  --output table
```

> **Q2:** How many IP addresses does the inbound endpoint have? Why are they in different AZs?

### Check Forwarding Rules

```bash
# List forwarding rules
aws route53resolver list-resolver-rules \
  --region us-east-1 \
  --query 'ResolverRules[?RuleType==`FORWARD`].{Name:Name,Domain:DomainName,Status:Status}' \
  --output table
```

> **Q3:** What domain is being forwarded? Where is it being forwarded to?

---

## Step 4: Test Outbound Resolver - AWS → On-Premises (10 minutes)

The **Outbound Resolver** lets AWS instances resolve on-premises DNS names.

### SSH into the Cloud Instance

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@CLOUD_INSTANCE_PUBLIC_IP
```

### Test Resolving On-Premises DNS

```bash
# Try to resolve on-premises DNS names from AWS
dig erp.onprem.local +short

dig mail.onprem.local +short

dig intranet.onprem.local +short

# Try the CNAME record
dig legacy.onprem.local +short
```

> **Q4:** Do the on-premises DNS names resolve from the AWS instance? What IP do they resolve to?

### Test Connectivity to On-Premises by DNS Name

```bash
# Ping on-prem server using DNS name
ping -c 3 erp.onprem.local

# Access on-prem web server using DNS name
curl http://erp.onprem.local
```

> **Q5:** Can you reach the on-premises server using its DNS name from AWS? What makes this possible? (Hint: two things are needed)

### Trace the DNS Resolution Path

```bash
# See the full DNS resolution path
dig erp.onprem.local

# Look at the SERVER line in the output - which DNS server answered?
```

> **Q6:** Which DNS server answered the query? Is it the VPC DNS (10.0.0.2) or the on-prem DNS directly?

---

## Step 5: Test Inbound Resolver - On-Premises → AWS (10 minutes)

The **Inbound Resolver** lets on-premises servers resolve AWS private DNS names.

### Get Inbound Endpoint IPs First

From your local machine (not SSH):
```bash
aws route53resolver list-resolver-endpoint-ip-addresses \
  --resolver-endpoint-id INBOUND_ENDPOINT_ID \
  --region us-east-1 \
  --query 'IpAddresses[].Ip' \
  --output text
```

Save these IPs (e.g., `10.0.1.x` and `10.0.2.x`).

### SSH into the On-Premises Instance

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@ONPREM_INSTANCE_PUBLIC_IP
```

### Test Resolving AWS DNS via Inbound Endpoint

```bash
# Query the inbound resolver endpoint directly for AWS private DNS
# Replace INBOUND_IP with one of the inbound endpoint IPs
dig @INBOUND_IP app.cloud.internal +short

dig @INBOUND_IP db.cloud.internal +short

dig @INBOUND_IP api.cloud.internal +short
```

> **Q7:** Do the AWS private DNS names resolve when you query the inbound endpoint? What IP do they return?

### Test WITHOUT the Inbound Endpoint

```bash
# Try resolving WITHOUT specifying the inbound endpoint
dig app.cloud.internal +short
```

> **Q8:** Does it resolve without specifying the inbound endpoint? Why or why not?

### Configure On-Prem DNS to Forward to Inbound Endpoint

In a real environment, you would configure your on-prem DNS server to forward `cloud.internal` queries to the inbound endpoint. Let's simulate this:

```bash
# Add a forwarder zone to BIND for cloud.internal
# Replace INBOUND_IP with the actual inbound endpoint IP
sudo bash -c 'cat >> /etc/named.conf << EOF

zone "cloud.internal" IN {
    type forward;
    forward only;
    forwarders { INBOUND_IP; };
};
EOF'

# Restart BIND
sudo systemctl restart named

# Now test - it should resolve through the local DNS server
dig app.cloud.internal +short

# Access the cloud web server by DNS name
curl http://app.cloud.internal
```

> **Q9:** After configuring the forwarder, does `app.cloud.internal` resolve without specifying `@INBOUND_IP`? Explain the DNS query flow step by step.

---

## Step 6: Explore in AWS Console (5 minutes)

### Route 53 Resolver Dashboard

1. Go to: https://console.aws.amazon.com/route53resolver/home?region=us-east-1
2. Click **Inbound endpoints** → Examine the endpoint details and IPs
3. Click **Outbound endpoints** → Examine the endpoint details
4. Click **Rules** → Find the forwarding rule for `onprem.local`

### Check Resolver Query Logs (if enabled)

```bash
# Check if query logging is configured
aws route53resolver list-resolver-query-log-configs \
  --region us-east-1 \
  --output table
```

### Questions to Answer

> **Q10:** In the console, how many ENIs (network interfaces) does each resolver endpoint create? Why?

> **Q11:** Look at the forwarding rule. What is the target IP? What port does it use?

---

## Step 7: Challenges

### Challenge 1: Add a New Forwarding Rule

Create a forwarding rule for a new domain `corp.local` that also forwards to the on-prem DNS:

```bash
# First, add the zone to the on-prem BIND server
# SSH into on-prem instance and run:
sudo bash -c 'cat > /var/named/corp.local.zone << EOF
\$TTL 60
@   IN  SOA ns1.corp.local. admin.corp.local. (
            2024010101 3600 900 604800 60 )
@       IN  NS  ns1.corp.local.
ns1     IN  A   $(hostname -I | awk "{print \$1}")
hr      IN  A   $(hostname -I | awk "{print \$1}")
finance IN  A   $(hostname -I | awk "{print \$1}")
EOF'

# Add zone to named.conf
sudo bash -c 'cat >> /etc/named.conf << EOF

zone "corp.local" IN {
    type master;
    file "/var/named/corp.local.zone";
};
EOF'

sudo systemctl restart named

# Verify it works locally
dig @localhost hr.corp.local +short
```

Now create the forwarding rule in AWS:

1. Go to **Route 53 Resolver** → **Rules** → **Create rule**
2. Name: `forward-corp-local`
3. Rule type: Forward
4. Domain: `corp.local`
5. Outbound endpoint: Select the existing outbound endpoint
6. Target IP: On-prem instance private IP, port 53
7. Associate with VPC A

Test from the cloud instance:
```bash
dig hr.corp.local +short
dig finance.corp.local +short
```

> Did it work? You just extended hybrid DNS to a new domain!

### Challenge 2: Bidirectional DNS Test

Verify full bidirectional DNS works:

```bash
# From CLOUD instance - resolve on-prem AND cloud DNS
dig erp.onprem.local +short      # Should work (outbound resolver)
dig app.cloud.internal +short     # Should work (local private zone)

# From ON-PREM instance - resolve on-prem AND cloud DNS
dig erp.onprem.local +short       # Should work (local BIND)
dig @INBOUND_IP app.cloud.internal +short  # Should work (inbound resolver)
```

> **Draw a diagram showing the DNS query path for each of these four queries.**

### Challenge 3: What Breaks Without Resolvers?

Think about and answer these questions:

1. If you **delete the outbound endpoint**, can AWS instances still resolve `onprem.local`?
2. If you **delete the inbound endpoint**, can on-prem still resolve `cloud.internal`?
3. If you **delete the forwarding rule** but keep the outbound endpoint, what happens?
4. If you **delete the VPC peering** but keep the resolvers, does DNS still work? Does connectivity work?

> **Don't actually delete anything!** Just reason through each scenario.

### Challenge 4: DNS Query Flow Diagram

For each scenario below, write out the complete DNS query path:

**Scenario A:** Cloud instance queries `erp.onprem.local`
```
Cloud Instance → ??? → ??? → ??? → Response
```

**Scenario B:** On-prem instance queries `app.cloud.internal` (after BIND forwarder configured)
```
On-Prem Instance → ??? → ??? → ??? → Response
```

**Scenario C:** Cloud instance queries `google.com`
```
Cloud Instance → ??? → ??? → Response
```

---

## Step 8: Cleanup (2 minutes)

**Important:** Resolver endpoints cost ~$0.125/hour each. Delete when done!

```bash
# Delete the stack
aws cloudformation delete-stack \
  --stack-name r53-resolver-demo \
  --region us-east-1

# Wait for deletion (may take 5+ minutes for resolver endpoints)
aws cloudformation wait stack-delete-complete \
  --stack-name r53-resolver-demo \
  --region us-east-1

echo "✅ All resources deleted!"
```

---

## Answer Key

<details>
<summary>Click to reveal answers (try on your own first!)</summary>

**Q1:** Two resolver endpoints - one INBOUND and one OUTBOUND.

**Q2:** Two IP addresses, one in each AZ. This provides high availability - if one AZ goes down, DNS resolution still works through the other.

**Q3:** The domain `onprem.local` is being forwarded to the on-premises DNS server IP (10.1.x.x) on port 53.

**Q4:** Yes, they resolve to the on-prem instance's private IP. The outbound resolver forwards the query to the on-prem BIND DNS server.

**Q5:** Two things are needed: (1) DNS resolution via the outbound resolver + forwarding rule, and (2) network connectivity via VPC peering. DNS alone isn't enough.

**Q6:** The VPC DNS server (10.0.0.2) answers the query. It receives the query, checks the forwarding rules, and sends it to the outbound resolver endpoint, which forwards to on-prem DNS. The response comes back through the same path.

**Q7:** Yes, they resolve to the cloud instance's private IP. The inbound endpoint receives the query and resolves it against the `cloud.internal` private hosted zone.

**Q8:** No, it doesn't resolve. The on-prem instance uses VPC B's DNS (10.1.0.2) which doesn't know about `cloud.internal`. You need to either query the inbound endpoint directly or configure a forwarder.

**Q9:** After configuring the BIND forwarder: On-prem instance → local BIND DNS (10.1.x.x) → sees `cloud.internal` zone → forwards to inbound endpoint IP (10.0.x.x) → Route 53 resolves against private hosted zone → returns IP back through the chain.

**Q10:** Each resolver endpoint creates 2 ENIs (one per subnet/AZ specified). This is for high availability and to handle DNS traffic in each AZ.

**Q11:** The target IP is the on-prem instance's private IP (VPC B DNS server). Port 53 (standard DNS port).

</details>

---

## What You Learned

✅ Route 53 Resolver enables hybrid DNS between AWS and on-premises  
✅ **Inbound Endpoint** = on-premises can resolve AWS private DNS  
✅ **Outbound Endpoint** = AWS can resolve on-premises DNS  
✅ **Forwarding Rules** tell the outbound endpoint which domains to forward and where  
✅ Resolver endpoints need ENIs in your VPC subnets  
✅ DNS resolution and network connectivity are independent layers  
✅ High availability requires endpoints in multiple AZs

---

## Key Concepts

**Inbound Resolver Endpoint:** Creates ENIs in your VPC that accept DNS queries from outside (on-prem). On-prem DNS servers forward queries to these IPs to resolve AWS private DNS.

**Outbound Resolver Endpoint:** Creates ENIs in your VPC that send DNS queries to external DNS servers. Used with forwarding rules to resolve on-prem domains.

**Forwarding Rule:** Tells Route 53 Resolver which domain names should be forwarded to which DNS servers (e.g., `onprem.local` → 10.1.x.x).

**BIND:** Open-source DNS server software commonly used on Linux. In this demo, it simulates an on-premises DNS server.

**VPC DNS Server:** Every VPC has a built-in DNS server at the VPC CIDR base +2 (e.g., 10.0.0.2 for 10.0.0.0/16). This is where EC2 instances send DNS queries by default.

---

## Real-World Use Cases

- **Hybrid Cloud Migration:** Gradually move services to AWS while keeping on-prem DNS working
- **Multi-Account DNS:** Share private hosted zones across AWS accounts
- **Compliance:** Keep sensitive DNS records in private zones, only accessible from specific VPCs
- **Service Discovery:** Use friendly DNS names instead of IP addresses across environments

---

## Cost Breakdown

- Resolver endpoints (2 endpoints × 2 ENIs): ~$0.25/hour
- EC2 instances (2x t3.micro): ~$0.02/hour
- Private Hosted Zone: $0.50/month (prorated)
- VPC Peering: **FREE**
- **Total for 1-hour demo: ~$0.30**
- **⚠️ Don't forget to delete! Resolver endpoints cost ~$6/day if left running.**

---

**Questions?** Ask your instructor!
