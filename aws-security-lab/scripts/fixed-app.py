#!/usr/bin/env python3
"""
CloudShop - SECURE Application Code
=====================================
This is the FIXED version that retrieves credentials from AWS Secrets Manager.
No hardcoded passwords - secrets are fetched securely at runtime!
"""

import json
import os
import urllib.request
import boto3


def get_region():
    """Auto-detect region from EC2 metadata or ~/.aws_region file"""
    # Try region file first (written by CloudFormation UserData)
    region_file = os.path.expanduser("~/.aws_region")
    if os.path.exists(region_file):
        return open(region_file).read().strip()
    # Try EC2 instance metadata
    try:
        url = "http://169.254.169.254/latest/meta-data/placement/region"
        return urllib.request.urlopen(url, timeout=2).read().decode()
    except Exception:
        return "us-east-1"


REGION = get_region()


def get_secret(secret_name):
    """Retrieve a secret from AWS Secrets Manager"""
    client = boto3.client("secretsmanager", region_name=REGION)
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def connect_to_database():
    """Connect to database using Secrets Manager (SECURE!)"""
    secret = get_secret("aws-security-lab-db-credentials")
    db_user = secret["username"]
    db_pass = secret["password"]

    print(f"Connecting to database as {db_user}...")
    print(f"Password: {'*' * len(db_pass)} (hidden - retrieved from Secrets Manager)")
    print("SECURE: Credentials are NOT in the source code!")
    print("")
    return True


def process_payment(amount):
    """Process payment using Secrets Manager (SECURE!)"""
    secret = get_secret("aws-security-lab-api-key")
    api_key = secret["api_key"]

    print(f"Processing ${amount} payment...")
    print(f"Stripe Key: {api_key[:8]}...{'*' * 20} (partially hidden)")
    print("SECURE: API key is NOT in the source code!")
    print("")
    return True


def send_email(to, subject):
    """Send email - would use Secrets Manager for real API key"""
    print(f"Sending email to {to}: {subject}")
    print("SECURE: Would retrieve SendGrid key from Secrets Manager")
    print("")
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("  CloudShop - SECURE Application Demo")
    print("  Credentials from AWS Secrets Manager!")
    print("=" * 50)
    print("")

    print("[1] Connecting to database...")
    try:
        connect_to_database()
    except Exception as e:
        print(f"  Error: {e}")
        print("  (Make sure you created the secrets in the lab exercises)")
        print("")

    print("[2] Processing a payment...")
    try:
        process_payment(99.99)
    except Exception as e:
        print(f"  Error: {e}")
        print("  (Make sure you created 'aws-security-lab-api-key' secret)")
        print("")

    print("[3] Sending confirmation email...")
    send_email("customer@example.com", "Order Confirmed")

    print("=" * 50)
    print("  SECURITY IMPROVEMENTS:")
    print("  + Database password stored in Secrets Manager")
    print("  + API keys stored in Secrets Manager")
    print("  + Source code contains ZERO secrets")
    print("  + Credentials can be rotated without code changes")
    print("  + IAM role controls who can access secrets")
    print("  + CloudTrail logs every secret access")
    print("=" * 50)
