# AWS Security Lab - Security Groups & GuardDuty

Learn fundamental AWS security concepts through hands-on exercises with Security Groups and GuardDuty.

## What You'll Learn

- **Security Groups**: Network-level firewall rules to control inbound/outbound traffic
- **GuardDuty**: Intelligent threat detection service that monitors for malicious activity
- **Security Best Practices**: Principle of least privilege, monitoring, and incident response

---

## Architecture

```
Internet → Security Group → EC2 Web Server
                ↓
           GuardDuty (monitoring)
```

---

## Prerequisites

- **AWS CLI configured**
- **EC2 Key Pair** in your region ([Create one](https://console.aws.amazon.com/ec2/v2/home#KeyPairs:) if needed)

---

## Part 1: Deploy the Infrastructure

Deploy the CloudFormation stack to create a VPC, EC2 web server, and basic security group:

```bash
aws cloudformation deploy \
  --stack-name aws-security-lab \
  --template-file aws-security-lab/cloudformation/01-infrastructure.yaml \
  --parameter-overrides KeyPairName=<YOUR-KEY-PAIR-NAME>
```

**Wait ~3 minutes** for the stack to complete.

Get the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name aws-security-lab \
  --query 'Stacks[0].Outputs' --output table
```

Note down:
- **WebServerPublicIP**
- **WebServerURL**
- **WebServerSecurityGroup**

---

## Part 2: Security Groups Hands-On

### Exercise 1: Test Initial Access (INSECURE)

The web server is currently deployed with an **insecure** security group that allows SSH from anywhere (0.0.0.0/0).

1. **Try to access the web server:**
   ```bash
   curl http://<WebServerPublicIP>
   ```
   
   ❌ **This should FAIL** - Why? Because we haven't opened port 80 (HTTP) yet!

2. **Try SSH access:**
   ```bash
   ssh -i <YOUR-KEY-PAIR>.pem ec2-user@<WebServerPublicIP>
   ```
   
   ✅ **This should WORK** - But it's insecure because SSH is open to the entire internet!

---

### Exercise 2: Add HTTP Access (Console)

Let's add HTTP access through the AWS Console:

1. Go to **EC2 Console** → **Security Groups**
2. Find the security group named `web-server-sg`
3. Click on the security group → **Inbound rules** tab
4. Click **Edit inbound rules**
5. Click **Add rule**:
   - **Type**: HTTP
   - **Protocol**: TCP
   - **Port**: 80
   - **Source**: 0.0.0.0/0 (Anywhere IPv4)
   - **Description**: Allow HTTP from anywhere
6. Click **Save rules**

7. **Test again:**
   ```bash
   curl http://<WebServerPublicIP>
   ```
   
   ✅ **Now it works!** You should see the web page HTML.

8. **Open in browser:**
   ```
   http://<WebServerPublicIP>
   ```
   
   You should see: "🔒 AWS Security Lab - Web Server is Running"

---

### Exercise 3: Secure SSH Access (Best Practice)

Currently, SSH is open to the entire internet (0.0.0.0/0) - this is a **security risk**!

**Best Practice**: Only allow SSH from YOUR IP address.

1. **Find your public IP:**
   ```bash
   curl https://api.ipify.org
   ```

2. **Update the SSH rule in the Console:**
   - Go to **EC2 Console** → **Security Groups** → `web-server-sg`
   - Click **Edit inbound rules**
   - Find the SSH rule (port 22)
   - Change **Source** from `0.0.0.0/0` to `<YOUR-IP>/32`
   - Update **Description**: "SSH from my IP only"
   - Click **Save rules**

3. **Test SSH access:**
   ```bash
   ssh -i <YOUR-KEY-PAIR>.pem ec2-user@<WebServerPublicIP>
   ```
   
   ✅ **Still works** - but now only from YOUR IP!

4. **Security Improvement**: If someone else tries to SSH from a different IP, they will be blocked by the security group.

---

### Exercise 4: Test Outbound Rules

Security groups also control **outbound** traffic (traffic leaving the instance).

1. **SSH into the web server:**
   ```bash
   ssh -i <YOUR-KEY-PAIR>.pem ec2-user@<WebServerPublicIP>
   ```

2. **Test outbound internet access:**
   ```bash
   curl https://www.google.com
   ```
   
   ✅ **This works** - By default, security groups allow all outbound traffic.

3. **View outbound rules in Console:**
   - Go to **EC2 Console** → **Security Groups** → `web-server-sg`
   - Click **Outbound rules** tab
   - You'll see: `All traffic` to `0.0.0.0/0`

4. **Optional Challenge**: Try restricting outbound traffic to only HTTPS (port 443) and see what breaks!

---

## Part 3: AWS GuardDuty Hands-On

GuardDuty is a threat detection service that continuously monitors for malicious activity.

### Exercise 5: Enable GuardDuty

1. Go to **GuardDuty Console**: https://console.aws.amazon.com/guardduty/
2. Click **Get Started**
3. Click **Enable GuardDuty**

**Note**: GuardDuty has a 30-day free trial, then costs ~$4.50/month for the first 10GB of CloudTrail events.

---

### Exercise 6: Generate Sample Findings

GuardDuty can generate sample findings so you can see what real threats look like:

1. In **GuardDuty Console** → Click **Settings** (left sidebar)
2. Scroll down to **Sample findings**
3. Click **Generate sample findings**

4. Go to **Findings** (left sidebar)
5. You'll see multiple sample findings like:
   - **UnauthorizedAccess:EC2/SSHBruteForce** - Someone trying to brute force SSH
   - **Recon:EC2/PortProbeUnprotectedPort** - Port scanning detected
   - **Backdoor:EC2/C&CActivity.B** - Instance communicating with known malicious IP
   - **CryptoCurrency:EC2/BitcoinTool.B** - Bitcoin mining detected

6. **Click on a finding** to see details:
   - Severity (Low, Medium, High)
   - Resource affected
   - Action taken
   - Recommended remediation

---

### Exercise 7: Understand Finding Details

Let's examine a specific finding:

1. Click on **UnauthorizedAccess:EC2/SSHBruteForce**
2. Review the details:
   - **Finding type**: What kind of threat
   - **Severity**: How serious is it
   - **Resource**: Which EC2 instance
   - **Action**: What happened
   - **Actor**: Who/what initiated it

3. **Recommended Actions**:
   - Review security group rules
   - Investigate the instance
   - Consider blocking the source IP
   - Rotate credentials if compromised

---

### Exercise 8: Create a Finding Filter (Optional)

You can create filters to focus on specific types of findings:

1. In **GuardDuty Console** → **Findings**
2. Click **Add filter criteria**
3. Select **Severity** → **High**
4. Click **Save filter** → Name it "High Severity Only"

Now you can quickly view only high-severity threats!

---

### Exercise 9: Set Up Notifications (Optional)

In a real environment, you'd want to be notified of threats:

1. Go to **GuardDuty Console** → **Settings**
2. Under **Findings export options**, you can configure:
   - **S3 bucket** - Export findings for long-term storage
   - **CloudWatch Events** - Trigger Lambda functions or SNS notifications

**Example Use Case**: Send an email when a high-severity finding is detected.

---

## Part 4: Security Best Practices

### What We Learned

1. **Security Groups are Stateful**:
   - If you allow inbound traffic, the response is automatically allowed outbound
   - You don't need to create a separate outbound rule for responses

2. **Principle of Least Privilege**:
   - Only open the ports you need
   - Restrict source IPs as much as possible
   - Don't use 0.0.0.0/0 unless absolutely necessary

3. **Defense in Depth**:
   - Security Groups (network level)
   - GuardDuty (threat detection)
   - IAM (identity and access)
   - Encryption (data protection)

4. **Monitoring is Critical**:
   - GuardDuty continuously monitors for threats
   - You should review findings regularly
   - Automate responses to common threats

---

## Security Group vs NACL (Network ACL)

| Feature | Security Group | NACL |
|---------|---------------|------|
| Level | Instance level | Subnet level |
| State | Stateful (return traffic automatic) | Stateless (must allow both ways) |
| Rules | Allow rules only | Allow AND Deny rules |
| Evaluation | All rules evaluated | Rules evaluated in order |
| Default | Deny all inbound, allow all outbound | Allow all traffic |

**When to use**:
- **Security Groups**: Primary defense, instance-specific rules
- **NACLs**: Additional subnet-level protection, blocking specific IPs

---

## Common Security Group Patterns

### Web Server (Public)
```
Inbound:
- HTTP (80) from 0.0.0.0/0
- HTTPS (443) from 0.0.0.0/0
- SSH (22) from YOUR_IP/32

Outbound:
- All traffic (for updates, API calls)
```

### Database Server (Private)
```
Inbound:
- MySQL (3306) from web-server-sg only
- PostgreSQL (5432) from web-server-sg only

Outbound:
- HTTPS (443) for updates only
```

### Bastion Host (Jump Server)
```
Inbound:
- SSH (22) from YOUR_IP/32 only

Outbound:
- SSH (22) to private subnet only
```

---

## Cleanup

**Important**: Disable GuardDuty first to avoid charges:

1. Go to **GuardDuty Console** → **Settings**
2. Click **Disable GuardDuty**
3. Confirm

Then delete the CloudFormation stack:

```bash
aws cloudformation delete-stack --stack-name aws-security-lab
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't access web server | Check security group has HTTP (80) rule |
| SSH connection refused | Check security group allows SSH (22) from your IP |
| GuardDuty not showing findings | Wait a few minutes, or generate sample findings |
| Web page shows "connection refused" | Check httpd service is running: `sudo systemctl status httpd` |

---

## Additional Challenges

1. **Create a second security group** for a database server that only accepts traffic from the web server security group

2. **Set up a CloudWatch alarm** that triggers when GuardDuty detects a high-severity finding

3. **Create a Lambda function** that automatically blocks IPs detected by GuardDuty

4. **Implement VPC Flow Logs** to see all network traffic and analyze it

---

## Key Takeaways

✅ **Security Groups** are your first line of defense - configure them carefully!

✅ **GuardDuty** provides intelligent threat detection without managing infrastructure

✅ **Always follow least privilege** - only open what you need, when you need it

✅ **Monitor continuously** - security is not a one-time setup, it's ongoing

✅ **Layer your security** - use multiple security controls together

---

## Next Steps

- Learn about **AWS WAF** (Web Application Firewall)
- Explore **AWS Shield** (DDoS protection)
- Study **AWS Inspector** (vulnerability scanning)
- Implement **AWS Config** (compliance monitoring)
- Set up **AWS Security Hub** (centralized security view)
