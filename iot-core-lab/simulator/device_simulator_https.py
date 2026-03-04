#!/usr/bin/env python3
"""
IoT Core Lab — Device Simulator (HTTPS via boto3)
Uses the IoT Data Plane API to publish messages via HTTPS.
Works through corporate proxies — no MQTT/WebSocket needed.
"""

import json
import time
import random
import os
import sys
from datetime import datetime, timezone

import boto3

# ============================================================
# Configuration
# ============================================================
CERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "certs")

ENDPOINT_FILE = os.path.join(CERTS_DIR, "endpoint.txt")
if os.path.exists(ENDPOINT_FILE):
    ENDPOINT = open(ENDPOINT_FILE).read().strip()
else:
    ENDPOINT = os.environ.get("IOT_ENDPOINT", "")

if not ENDPOINT:
    print("❌ IoT endpoint not found. Run setup-certs.sh first or set IOT_ENDPOINT env var.")
    sys.exit(1)

THING_NAME = os.environ.get("THING_NAME", "temperature-sensor-01")
TOPIC = f"devices/{THING_NAME}/data"
INTERVAL = int(os.environ.get("PUBLISH_INTERVAL", "5"))
MESSAGE_COUNT = int(os.environ.get("MESSAGE_COUNT", "10"))
REGION = os.environ.get("AWS_REGION", "eu-west-1")
PROFILE = os.environ.get("AWS_PROFILE", "iitc-profile")


def generate_sensor_data():
    """Generate realistic sensor data."""
    return {
        "device_id": THING_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "temperature": round(random.uniform(18.0, 35.0), 2),
        "humidity": round(random.uniform(30.0, 80.0), 2),
        "battery_pct": round(random.uniform(60.0, 100.0), 1),
        "firmware_version": "1.2.0",
        "location": {"room": "lab-room-1", "floor": 2},
    }


def main():
    print("=" * 50)
    print("  IoT Core Lab — Device Simulator (HTTPS)")
    print("=" * 50)
    print(f"  Endpoint:  {ENDPOINT}")
    print(f"  Thing:     {THING_NAME}")
    print(f"  Topic:     {TOPIC}")
    print(f"  Interval:  {INTERVAL}s")
    print(f"  Messages:  {MESSAGE_COUNT if MESSAGE_COUNT > 0 else 'infinite'}")
    print(f"  Region:    {REGION}")
    print(f"  Profile:   {PROFILE}")
    print("=" * 50)
    print()

    # Create IoT Data Plane client
    print("🔑 Creating IoT Data Plane client...")
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    iot_data = session.client(
        "iot-data",
        endpoint_url=f"https://{ENDPOINT}",
        verify=False,  # Skip TLS verification for corporate proxy
    )

    print("✅ Connected to IoT Core via HTTPS!\n")

    # Publish messages
    count = 0
    try:
        while True:
            count += 1
            if 0 < MESSAGE_COUNT < count:
                break

            payload = generate_sensor_data()
            message = json.dumps(payload)

            print(f"📤 [{count}] Publishing to {TOPIC}:")
            print(f"   temp={payload['temperature']}°C  humidity={payload['humidity']}%  battery={payload['battery_pct']}%")

            iot_data.publish(
                topic=TOPIC,
                qos=1,
                payload=message,
            )

            print(f"   ✅ Published successfully")
            print()

            if 0 < MESSAGE_COUNT <= count:
                break

            time.sleep(INTERVAL)

    except KeyboardInterrupt:
        print("\n⏹️  Stopped by user")

    print(f"\n📊 Total messages sent: {count}")
    print(f"📦 Check S3 bucket for stored data!")
    print(f"   aws s3 ls s3://050752632489-iot-lab-data/devices/ --recursive --profile {PROFILE}")


if __name__ == "__main__":
    main()
