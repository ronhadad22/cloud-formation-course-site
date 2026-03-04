# VPC Peering - Student Exercise

## What You'll Learn

- How VPCs are isolated by default
- How to create a VPC Peering connection
- How route tables enable cross-VPC communication
- How security groups control peering traffic
- How Route 53 Private Hosted Zones provide DNS across VPCs

**Time:** 30-45 minutes  
**Cost:** Less than $0.50

---

## Architecture

```
              ┌─────────────────────────────────────────┐
              │   Route 53 Private Hosted Zone           │
              │   internal.company.local                 │
              │                                         │
              │   production.internal.company.local → A  │
              │   dev.internal.company.local        → A  │
              │   webapp.internal.company.local     → CNAME
              └────────────┬────────────┬───────────────┘
                           │            │
┌──────────────────────────┼──┐     ┌───┼──────────────────────────┐
│   VPC A - Production     │  │     │   │   VPC B - Development    │
│   CIDR: 10.0.0.0/16     │  │     │   │   CIDR: 10.1.0.0/16     │
│                          │  │     │   │                          │
│  ┌────────────────┐      │  │     │   │      ┌────────────────┐  │
│  │ Public Subnet  │      │  │ VPC │   │      │ Public Subnet  │  │
│  │ 10.0.1.0/24   │      │  │Peer-│   │      │ 10.1.1.0/24   │  │
│  │                │◄─────┼──┼─ing─┼───┼─────►│                │  │
│  │  EC2 Instance  │      │  │     │   │      │  EC2 Instance  │  │
│  │  (Web Server)  │      │  │     │   │      │  (Web Server)  │  │
│  └────────────────┘      │  │     │   │      └────────────────┘  │
│                          │  │     │   │                          │
│  ┌────────────────┐      │  │     │   │      ┌────────────────┐  │
│  │ Private Subnet │      │  │     │   │      │ Private Subnet │  │
│  │ 10.0.2.0/24   │      │  │     │   │      │ 10.1.2.0/24   │  │
│  └────────────────┘      │  │     │   │      └────────────────┘  │
└──────────────────────────┘  │     │   └──────────────────────────┘
                              │     │
                              └─────┘
```

---

## Prerequisites

✅ AWS Account  
✅ AWS CLI configured  
✅ EC2 Key Pair created

---

## Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/ronhadad22/cloud-formation-course-site.git

# Navigate to the repository
cd cloud-formation-course-site

# Switch to the release branch
git checkout release

# Navigate to VPC peering directory
cd vpc-peering
```

### Login to AWS

Choose the method that matches your setup:

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

## Step 2: Deploy the Stack (5 minutes)

```bash
# Replace 'your-key-name' with your EC2 key pair name
aws cloudformation create-stack \
  --stack-name vpc-peering-demo \
  --template-body file://cloudformation/vpc-peering.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-name \
  --region us-east-1

# Wait for stack to complete (3-5 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name vpc-peering-demo \
  --region us-east-1

echo "✅ Stack created!"
```

### Get the Instance IPs

```bash
# Get all outputs
aws cloudformation describe-stacks \
  --stack-name vpc-peering-demo \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

Save these values - you'll need them:
- **VPC A Public IP** → for SSH into VPC A instance
- **VPC A Private IP** → for testing peering from VPC B
- **VPC B Public IP** → for SSH into VPC B instance
- **VPC B Private IP** → for testing peering from VPC A
- **DNS Names** → `production.internal.company.local`, `dev.internal.company.local`, `webapp.internal.company.local`

---

## Step 3: Verify VPCs Are Created (5 minutes)

### Check in AWS Console

1. Go to: https://console.aws.amazon.com/vpc/home?region=us-east-1
2. Click **Your VPCs** → You should see two new VPCs
3. Click **Peering connections** → You should see one active peering connection
4. Click **Route tables** → Check that peering routes exist

### Questions to Answer

> **Q1:** What are the CIDR blocks of each VPC?

> **Q2:** Why can't the two VPCs communicate without peering? (Hint: think about IP routing)

> **Q3:** Look at the route tables. What destination CIDR and target do the peering routes use?

---

## Step 4: Test Connectivity (10 minutes)

### Test 1: Ping from VPC A → VPC B

```bash
# SSH into VPC A instance
ssh -i ~/.ssh/your-key.pem ec2-user@VPC_A_PUBLIC_IP

# Ping VPC B instance using its PRIVATE IP
ping VPC_B_PRIVATE_IPc
```

**Expected:** You should see ping replies! This proves peering works.

### Test 2: Ping from VPC B → VPC A

```bash
# SSH into VPC B instance
ssh -i ~/.ssh/your-key.pem ec2-user@VPC_B_PUBLIC_IP

# Ping VPC A instance using its PRIVATE IP
ping VPC_A_PRIVATE_IP
```

### Test 3: Access Web Server Across VPCs

```bash
# From VPC A instance, access VPC B web server
curl http://VPC_B_PRIVATE_IP

# From VPC B instance, access VPC A web server
curl http://VPC_A_PRIVATE_IP
```

**Expected:** You should see the HTML page from the other VPC's web server.

### Questions to Answer

> **Q4:** Can you ping using the PUBLIC IP from one VPC to another? Why or why not?

> **Q5:** Why do we use PRIVATE IPs for cross-VPC communication?

---

## Step 5: Explore the Components (10 minutes)

### 5a: Examine Route Tables

```bash
# Get VPC A route table
aws ec2 describe-route-tables \
  --filters "Name=tag:Name,Values=*vpc-a-public*" \
  --query 'RouteTables[0].Routes' \
  --output table \
  --region us-east-1
```

> **Q6:** How many routes do you see? What does each route do?

### 5b: Examine Security Groups

```bash
# Get VPC A security group rules
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=*vpc-a-sg*" \
  --query 'SecurityGroups[0].IpPermissions' \
  --output table \
  --region us-east-1
```

> **Q7:** What traffic is allowed from VPC B's CIDR (10.1.0.0/16)?

### 5c: Examine the Peering Connection

```bash
aws ec2 describe-vpc-peering-connections \
  --filters "Name=tag:Name,Values=*vpc-a-to-vpc-b*" \
  --query 'VpcPeeringConnections[0].{Status:Status.Code,Requester:RequesterVpcInfo.CidrBlock,Accepter:AccepterVpcInfo.CidrBlock}' \
  --output table \
  --region us-east-1
```

> **Q8:** What is the status of the peering connection? What are the requester and accepter CIDRs?

---

## Step 5.5: Test Private DNS (10 minutes)

A **Private Hosted Zone** in Route 53 lets instances resolve friendly DNS names instead of remembering IP addresses. The hosted zone `internal.company.local` is associated with BOTH VPCs.

### DNS Records Created

| DNS Name | Type | Points To |
|----------|------|-----------|
| `production.internal.company.local` | A | VPC A instance private IP |
| `dev.internal.company.local` | A | VPC B instance private IP |
| `webapp.internal.company.local` | CNAME | `production.internal.company.local` |

### Test 1: Resolve DNS from VPC A

```bash
# SSH into VPC A instance
ssh -i ~/.ssh/your-key.pem ec2-user@VPC_A_PUBLIC_IP

# Resolve the production server (should return VPC A private IP)
dig production.internal.company.local +short

# Resolve the dev server (should return VPC B private IP)
dig dev.internal.company.local +short

# Resolve the CNAME alias
dig webapp.internal.company.local +short
```

> **Q9:** What IP does `production.internal.company.local` resolve to? Is it the public or private IP?

> **Q10:** What does `webapp.internal.company.local` resolve to? How is a CNAME different from an A record?

### Test 2: Use DNS Names Instead of IPs

```bash
# From VPC A - ping dev server by DNS name
ping dev.internal.company.local

# From VPC A - access dev web server by DNS name
curl http://dev.internal.company.local
```

**Expected:** Same result as using IP addresses, but much more readable!

### Test 3: Resolve DNS from VPC B

```bash
# SSH into VPC B instance
ssh -i ~/.ssh/your-key.pem ec2-user@VPC_B_PUBLIC_IP

# Resolve production server from VPC B
dig production.internal.company.local +short

# Access production web server by DNS name
curl http://production.internal.company.local

# Try the CNAME alias
curl http://webapp.internal.company.local
```

> **Q11:** Can VPC B resolve the same DNS names as VPC A? Why?

### Test 4: Check from Outside

```bash
# From your LOCAL machine (not SSH'd into any instance)
dig production.internal.company.local +short
```

> **Q12:** Does this resolve from your local machine? Why or why not?

### Explore in AWS Console

1. Go to: https://console.aws.amazon.com/route53/v2/hostedzones
2. Click on `internal.company.local`
3. Examine the records (A records, CNAME, SOA, NS)
4. Check **Associated VPCs** - you should see both VPC A and VPC B

> **Q13:** What would happen if you removed VPC B from the hosted zone association? Would VPC B still resolve the DNS names?

---

## Step 6: Break and Fix Challenge (10 minutes)

### Challenge 1: Remove a Peering Route

1. Go to **VPC Console** → **Route Tables**
2. Find the VPC A public route table
3. **Delete** the route to `10.1.0.0/16`
4. Try to ping VPC B from VPC A again

> **Q9:** What happens? Why?

5. **Add the route back** manually:
   - Destination: `10.1.0.0/16`
   - Target: Select the peering connection

### Challenge 2: Modify Security Group

1. Go to **VPC Console** → **Security Groups**
2. Find VPC A's security group
3. **Remove** the ICMP rule (ping from VPC B)
4. Try to ping VPC A from VPC B

> **Q10:** Can you still ping? Can you still access the web server? Why?

5. **Add the ICMP rule back**

### Challenge 3: DNS Without Peering

1. Think about this: If you remove the VPC peering routes but keep the Private Hosted Zone...
2. From VPC A, run:
   ```bash
   dig dev.internal.company.local +short
   ```
3. Then try:
   ```bash
   ping dev.internal.company.local
   ```

> **Q14:** Does DNS resolution still work? Does the ping work? What does this tell you about the difference between DNS resolution and network connectivity?

---

## Step 6.5: Student Challenges (15-20 minutes)

Try these challenges on your own! Each one builds on what you've learned.

### Challenge 4: Create Your Own DNS Record

Create a new DNS record in the Private Hosted Zone that points to the VPC B instance.

1. Go to **Route 53 Console** → **Hosted zones** → `internal.company.local`
2. Click **Create record**
3. Create a record with:
   - Record name: `myapp`
   - Type: `A`
   - Value: VPC B instance private IP
   - TTL: 60
4. Test it from VPC A:
   ```bash
   dig myapp.internal.company.local +short
   curl http://myapp.internal.company.local
   ```

> Did it work? Why is it useful to give servers friendly names?

### Challenge 5: One-Way Peering

What happens if peering routes only exist in one direction?

1. Go to **VPC Console** → **Route Tables**
2. Find VPC **B** public route table
3. **Delete** the route to `10.0.0.0/16` (keep VPC A's route to VPC B)
4. Test from both sides:
   ```bash
   # From VPC A - ping VPC B
   ping VPC_B_PRIVATE_IP

   # From VPC B - ping VPC A
   ping VPC_A_PRIVATE_IP
   ```

> **Which direction works? Which fails? Why?**

5. **Fix it** - add the route back to VPC B's route table

### Challenge 6: Add a New Service Port

Your dev team needs to run a database on port 3306 (MySQL) on VPC B, accessible from VPC A.

1. Go to **VPC Console** → **Security Groups**
2. Find VPC B's security group
3. **Add** a new inbound rule:
   - Type: Custom TCP
   - Port: 3306
   - Source: `10.0.0.0/16`
   - Description: MySQL from VPC A
4. Verify the rule was added:
   ```bash
   aws ec2 describe-security-groups \
     --filters "Name=tag:Name,Values=*vpc-b-sg*" \
     --query 'SecurityGroups[0].IpPermissions' \
     --output table \
     --region us-east-1
   ```
5. From VPC A, test the port (it won't connect since MySQL isn't installed, but it shouldn't be blocked):
   ```bash
   # From VPC A instance
   nc -zv VPC_B_PRIVATE_IP 3306 -w 3
   ```

> **What's the difference between "connection refused" and "connection timed out"?**
> (Hint: one means the port is reachable but nothing is listening, the other means the traffic is blocked)

### Challenge 7: Trace the Full Path

Use `traceroute` to understand how traffic flows between VPCs:

```bash
# From VPC A instance
traceroute VPC_B_PRIVATE_IP

# Compare with a public internet destination
traceroute 8.8.8.8
```

> **How many hops to reach VPC B vs the internet? What does this tell you about VPC peering?**

### Challenge 8: Create a CNAME Chain

Create a chain of DNS records:

1. In Route 53, create these records:
   - `api.internal.company.local` → CNAME → `dev.internal.company.local`
   - `frontend.internal.company.local` → CNAME → `production.internal.company.local`
2. Test the chain:
   ```bash
   dig api.internal.company.local +short
   dig frontend.internal.company.local +short
   curl http://api.internal.company.local
   curl http://frontend.internal.company.local
   ```

> **How many DNS lookups happen when you resolve `api.internal.company.local`? Trace it step by step.**

### Bonus Challenge: Document Your Architecture

Draw a diagram (on paper or whiteboard) showing:
- Both VPCs with their CIDR blocks
- The peering connection
- Route table entries (all routes)
- Security group rules
- Private Hosted Zone with all DNS records
- The flow of a request from VPC B to `webapp.internal.company.local`

> **Present your diagram to a classmate and explain each component.**

---

## Step 7: Cleanup (2 minutes)

```bash
# Delete the stack
aws cloudformation delete-stack \
  --stack-name vpc-peering-demo \
  --region us-east-1

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name vpc-peering-demo \
  --region us-east-1

echo "✅ All resources deleted!"
```

---

## Answer Key

<details>
<summary>Click to reveal answers (try on your own first!)</summary>

**Q1:** VPC A = 10.0.0.0/16, VPC B = 10.1.0.0/16

**Q2:** VPCs are isolated networks. Without peering, there is no route between them. Traffic destined for 10.1.x.x from VPC A has no route to follow, so it gets dropped.

**Q3:** In VPC A's route table: Destination = 10.1.0.0/16, Target = pcx-xxxxx (peering connection). In VPC B's route table: Destination = 10.0.0.0/16, Target = pcx-xxxxx.

**Q4:** No. Peering works on private IPs only. Public IPs route through the internet, not through the peering connection.

**Q5:** VPC peering creates a private network link between VPCs. It operates at the VPC CIDR level using private IP addresses. Public IPs are translated by the Internet Gateway and don't use the peering route.

**Q6:** Three routes: (1) 10.0.0.0/16 → local (within VPC), (2) 0.0.0.0/0 → igw (internet), (3) 10.1.0.0/16 → pcx (peering to VPC B).

**Q7:** ICMP (ping) and HTTP (port 80) are allowed from 10.1.0.0/16.

**Q8:** Status = active. Requester = 10.0.0.0/16 (VPC A), Accepter = 10.1.0.0/16 (VPC B).

**Q9:** Ping fails. Without the route to 10.1.0.0/16, VPC A doesn't know how to reach VPC B. The route table is essential - peering alone is not enough.

**Q10:** `webapp.internal.company.local` first resolves to `production.internal.company.local` (the CNAME), then to the VPC A private IP. A CNAME is an alias that points to another DNS name, while an A record points directly to an IP address.

**Q11:** Yes. The Private Hosted Zone is associated with both VPCs, so both can resolve the same DNS names. This is the key benefit - shared DNS across peered VPCs.

**Q12:** No. Private Hosted Zones are only resolvable from within the associated VPCs. Your local machine uses public DNS servers which don't know about private zones.

**Q13:** VPC B would no longer be able to resolve the DNS names. The hosted zone association is what allows a VPC to query the private DNS records.

**Q14:** DNS resolution still works (dig returns the IP) because the Private Hosted Zone is independent of VPC peering. But ping fails because there's no network route to reach the IP. DNS and networking are separate layers - DNS tells you WHERE something is, but you still need a network path to GET there.

**Q-original-10 (security group):** Ping fails but web server (HTTP) still works. Security groups are stateful and filter by protocol/port. Removing ICMP only blocks ping, not HTTP traffic.

</details>

---

## What You Learned

✅ VPCs are isolated by default - no communication without explicit setup  
✅ VPC Peering creates a private network link between two VPCs  
✅ Route tables must be updated in BOTH VPCs for bidirectional traffic  
✅ Security groups control what traffic is allowed through the peering  
✅ Peering uses private IPs, not public IPs  
✅ All three components are needed: Peering + Routes + Security Groups  
✅ Private Hosted Zones provide DNS resolution across VPCs  
✅ DNS resolution and network connectivity are separate layers  
✅ CNAME records create aliases to other DNS names

---

## Key Concepts

**VPC Peering:** A networking connection between two VPCs that enables routing using private IP addresses.

**Non-Transitive:** If VPC A peers with VPC B, and VPC B peers with VPC C, VPC A CANNOT talk to VPC C through VPC B.

**Same Region:** This demo uses same-region peering. Cross-region peering is also possible but with higher latency.

**No Overlapping CIDRs:** VPCs with overlapping CIDR blocks cannot be peered (e.g., both using 10.0.0.0/16).

**Private Hosted Zone:** A Route 53 DNS zone that is only resolvable from within associated VPCs. Allows using friendly DNS names (e.g., `production.internal.company.local`) instead of IP addresses.

**A Record:** Maps a DNS name directly to an IP address.

**CNAME Record:** Maps a DNS name to another DNS name (alias). Cannot be used at the zone apex.

---

## Cost Breakdown

- EC2 instances (2x t3.micro): ~$0.02/hour
- VPC Peering: **FREE** (no charge for peering connection)
- Route 53 Private Hosted Zone: $0.50/month (prorated)
- Data transfer across peering: $0.01/GB
- **Total for 1-hour demo: < $0.10**

---

**Questions?** Ask your instructor!
