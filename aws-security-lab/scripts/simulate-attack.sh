#!/bin/bash
# ============================================================
# CloudShop Security Lab - Simulate Suspicious Activity
# ============================================================
# This script simulates what a real attacker might do after
# gaining access to a server. GuardDuty will detect these!
# ============================================================

echo "=========================================="
echo "  CloudShop Incident Simulation"
echo "  WARNING: This is for EDUCATIONAL purposes only!"
echo "=========================================="
echo ""

# ----------------------------------------------------------
# Attack 1: DNS queries to known crypto-mining domains
# GuardDuty Finding: CryptoCurrency:EC2/BitcoinTool.B!DNS
# ----------------------------------------------------------
echo "[ATTACK 1] Simulating crypto-mining DNS lookups..."
echo "  An attacker often installs crypto miners on compromised servers."
echo "  GuardDuty detects DNS queries to known mining pool domains."
echo ""

# These domains are monitored by GuardDuty as crypto-mining indicators
dig pool.minergate.com +short 2>/dev/null || nslookup pool.minergate.com 2>/dev/null || echo "  DNS lookup attempted for pool.minergate.com"
dig xmr.pool.minergate.com +short 2>/dev/null || nslookup xmr.pool.minergate.com 2>/dev/null || echo "  DNS lookup attempted for xmr.pool.minergate.com"

echo "  --> GuardDuty should detect: CryptoCurrency:EC2/BitcoinTool.B!DNS"
echo ""

# ----------------------------------------------------------
# Attack 2: DNS queries to command & control domains  
# GuardDuty Finding: Backdoor:EC2/C&CActivity.B!DNS
# ----------------------------------------------------------
echo "[ATTACK 2] Simulating command & control communication..."
echo "  Malware on a compromised server talks back to the attacker's C2 server."
echo "  GuardDuty detects DNS queries to known malicious domains."
echo ""

# GuardDuty threat intelligence test domain
dig guarddutyc2activityb.com +short 2>/dev/null || nslookup guarddutyc2activityb.com 2>/dev/null || echo "  DNS lookup attempted for guarddutyc2activityb.com"

echo "  --> GuardDuty should detect: Backdoor:EC2/C&CActivity.B!DNS"
echo ""

# ----------------------------------------------------------
# Attack 3: Port scanning (internal reconnaissance)
# GuardDuty Finding: Recon:EC2/Portscan
# ----------------------------------------------------------
echo "[ATTACK 3] Simulating internal port scanning..."
echo "  After compromising one server, attackers scan for other targets."
echo ""

# Quick scan of a few internal IPs (harmless - these don't exist)
for port in 22 80 443 3306 5432; do
    timeout 1 bash -c "echo >/dev/tcp/10.0.1.100/$port" 2>/dev/null
    echo "  Scanned 10.0.1.100:$port"
done

echo "  --> GuardDuty may detect: Recon:EC2/Portscan"
echo ""

# ----------------------------------------------------------
# Attack 4: Suspicious API calls
# GuardDuty monitors CloudTrail for unusual API activity
# ----------------------------------------------------------
echo "[ATTACK 4] Simulating suspicious AWS API calls..."
echo "  Attackers try to discover what they can access in AWS."
echo ""

REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo "us-east-1")

# These calls are harmless but show reconnaissance behavior
aws iam list-users --region $REGION 2>/dev/null && echo "  Listed IAM users" || echo "  Access Denied: iam:ListUsers (expected - we don't have permission)"
aws s3 ls --region $REGION 2>/dev/null && echo "  Listed S3 buckets" || echo "  Access Denied: s3:ListBuckets (expected - we don't have permission)"
aws ec2 describe-instances --region $REGION 2>/dev/null | head -5 && echo "  Listed EC2 instances" || echo "  Access Denied: ec2:DescribeInstances (expected - we don't have permission)"

echo "  --> GuardDuty may detect: Recon:IAMUser/MaliciousIPCaller or Discovery:S3/MaliciousIPCaller"
echo ""

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
echo "=========================================="
echo "  Simulation Complete!"
echo "=========================================="
echo ""
echo "  GuardDuty typically takes 5-15 minutes to generate findings."
echo "  Go to the GuardDuty Console to see what was detected!"
echo ""
echo "  Console: https://console.aws.amazon.com/guardduty/"
echo ""
echo "  Look for these finding types:"
echo "    - CryptoCurrency:EC2/BitcoinTool.B!DNS"
echo "    - Backdoor:EC2/C&CActivity.B!DNS"  
echo "    - Recon:EC2/Portscan"
echo "    - UnauthorizedAccess or Recon findings"
echo ""
echo "  If you set up SNS alerts, you should also receive an email!"
echo "=========================================="
