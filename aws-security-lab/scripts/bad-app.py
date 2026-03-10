#!/usr/bin/env python3
"""
CloudShop - INSECURE Application Code
======================================
This is the BAD code that a junior developer wrote.
It has hardcoded database credentials - a major security risk!

DO NOT do this in production. This file is for educational purposes only.
"""

import json

# ============================================================
# BAD PRACTICE - Hardcoded credentials!
# If this gets pushed to GitHub, anyone can see these passwords!
# ============================================================
DB_HOST = "cloudshop-db.us-east-1.rds.amazonaws.com"
DB_USER = "admin"
DB_PASSWORD = "CloudShop2026!SuperSecret"  # <-- THIS IS THE PROBLEM!
DB_NAME = "cloudshop_orders"

STRIPE_API_KEY = "sk_live_abc123_FAKE_KEY_DO_NOT_USE"
SENDGRID_API_KEY = "SG.fake_key_1234567890"


def connect_to_database():
    """Connect to database using hardcoded credentials (INSECURE!)"""
    print(f"Connecting to {DB_HOST} as {DB_USER}...")
    print(f"Password: {DB_PASSWORD}")
    print("WARNING: These credentials are HARDCODED in the source code!")
    print("")
    return True


def process_payment(amount):
    """Process payment using hardcoded API key (INSECURE!)"""
    print(f"Processing ${amount} payment...")
    print(f"Stripe Key: {STRIPE_API_KEY}")
    print("WARNING: API key is HARDCODED in the source code!")
    print("")
    return True


def send_email(to, subject):
    """Send email using hardcoded API key (INSECURE!)"""
    print(f"Sending email to {to}: {subject}")
    print(f"SendGrid Key: {SENDGRID_API_KEY}")
    print("WARNING: API key is HARDCODED in the source code!")
    print("")
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("  CloudShop - INSECURE Application Demo")
    print("  This shows what NOT to do!")
    print("=" * 50)
    print("")

    print("[1] Connecting to database...")
    connect_to_database()

    print("[2] Processing a payment...")
    process_payment(99.99)

    print("[3] Sending confirmation email...")
    send_email("customer@example.com", "Order Confirmed")

    print("=" * 50)
    print("  SECURITY PROBLEMS FOUND:")
    print("  - Database password hardcoded in source code")
    print("  - Stripe API key hardcoded in source code")
    print("  - SendGrid API key hardcoded in source code")
    print("")
    print("  If this code is pushed to GitHub:")
    print("  - Anyone can read the passwords")
    print("  - Attackers scan GitHub for leaked credentials")
    print("  - Your database, payments, and email are compromised!")
    print("=" * 50)
    print("")
    print("  YOUR MISSION: Fix this using AWS Secrets Manager!")
    print("  See the next script: fixed-app.py")
