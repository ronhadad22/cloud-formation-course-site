#!/usr/bin/env python3
"""
IoT Core Lab — Device Simulator
Simulates a temperature sensor publishing data to AWS IoT Core via MQTT.
The IoT Rule routes messages to S3.
"""

import json
import time
import random
import os
import sys
from datetime import datetime, timezone

from awscrt import mqtt, io, auth
from awsiot import mqtt_connection_builder

# ============================================================
# Configuration
# ============================================================
CERTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "certs")

# Read endpoint from file or env
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
CERT_PATH = os.path.join(CERTS_DIR, "device-cert.pem")
KEY_PATH = os.path.join(CERTS_DIR, "private.key")
CA_PATH = os.path.join(CERTS_DIR, "AmazonRootCA1.pem")
INTERVAL = int(os.environ.get("PUBLISH_INTERVAL", "5"))  # seconds
MESSAGE_COUNT = int(os.environ.get("MESSAGE_COUNT", "10"))  # 0 = infinite

# Verify certs exist
for f, label in [(CERT_PATH, "Device cert"), (KEY_PATH, "Private key"), (CA_PATH, "Root CA")]:
    if not os.path.exists(f):
        print(f"❌ {label} not found: {f}")
        print("   Run scripts/setup-certs.sh first.")
        sys.exit(1)


def generate_sensor_data():
    """Generate realistic sensor data."""
    return {
        "device_id": THING_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "temperature": round(random.uniform(18.0, 35.0), 2),
        "humidity": round(random.uniform(30.0, 80.0), 2),
        "battery_pct": round(random.uniform(60.0, 100.0), 1),
        "firmware_version": "1.2.0",
        "location": {
            "room": "lab-room-1",
            "floor": 2
        }
    }


def on_connection_interrupted(connection, error, **kwargs):
    print(f"⚠️  Connection interrupted: {error}")


def on_connection_resumed(connection, return_code, session_present, **kwargs):
    print(f"✅ Connection resumed (return_code={return_code}, session_present={session_present})")


def main():
    print("=" * 50)
    print("  IoT Core Lab — Device Simulator")
    print("=" * 50)
    print(f"  Endpoint:  {ENDPOINT}")
    print(f"  Thing:     {THING_NAME}")
    print(f"  Topic:     {TOPIC}")
    print(f"  Interval:  {INTERVAL}s")
    print(f"  Messages:  {MESSAGE_COUNT if MESSAGE_COUNT > 0 else 'infinite'}")
    print("=" * 50)
    print()

    # Create MQTT connection using port 443 with ALPN
    # Port 443 with ALPN protocol "x-amzn-mqtt-ca" works better through corporate proxies
    print("🔌 Connecting to IoT Core (port 443 with ALPN)...")
    mqtt_connection = mqtt_connection_builder.mtls_from_path(
        endpoint=ENDPOINT,
        port=443,
        cert_filepath=CERT_PATH,
        pri_key_filepath=KEY_PATH,
        ca_filepath=CA_PATH,
        client_id=THING_NAME,
        clean_session=False,
        keep_alive_secs=30,
        on_connection_interrupted=on_connection_interrupted,
        on_connection_resumed=on_connection_resumed,
    )

    connect_future = mqtt_connection.connect()
    connect_future.result()
    print("✅ Connected to IoT Core!\n")

    # Publish messages
    count = 0
    try:
        while True:
            count += 1
            if 0 < MESSAGE_COUNT < count:
                break

            payload = generate_sensor_data()
            message = json.dumps(payload, indent=2)

            print(f"📤 [{count}] Publishing to {TOPIC}:")
            print(f"   temp={payload['temperature']}°C  humidity={payload['humidity']}%  battery={payload['battery_pct']}%")

            mqtt_connection.publish(
                topic=TOPIC,
                payload=message,
                qos=mqtt.QoS.AT_LEAST_ONCE,
            )

            print(f"   ✅ Published successfully")
            print()

            if 0 < MESSAGE_COUNT <= count:
                break

            time.sleep(INTERVAL)

    except KeyboardInterrupt:
        print("\n⏹️  Stopped by user")

    # Disconnect
    print("\n🔌 Disconnecting...")
    disconnect_future = mqtt_connection.disconnect()
    disconnect_future.result()
    print("✅ Disconnected.")
    print(f"\n📊 Total messages sent: {count}")
    print(f"📦 Check S3 bucket for stored data!")


if __name__ == "__main__":
    main()
