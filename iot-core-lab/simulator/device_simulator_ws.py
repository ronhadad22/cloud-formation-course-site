#!/usr/bin/env python3
"""
IoT Core Lab — Device Simulator (WebSocket + SigV4)
Uses MQTT over WebSockets with IAM credentials (no device certificates needed for TLS).
This version works through corporate proxies that intercept TLS.
"""

import json
import time
import random
import os
import sys
import ssl
import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
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


def sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def get_signature_key(key, date_stamp, region, service):
    k_date = sign(("AWS4" + key).encode("utf-8"), date_stamp)
    k_region = sign(k_date, region)
    k_service = sign(k_region, service)
    k_signing = sign(k_service, "aws4_request")
    return k_signing


def get_sigv4_websocket_url(endpoint, region, credentials):
    """Build a SigV4-signed WebSocket URL for IoT Core."""
    method = "GET"
    service = "iotdevicegateway"
    host = endpoint
    canonical_uri = "/mqtt"

    t = datetime.now(timezone.utc)
    amz_date = t.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = t.strftime("%Y%m%d")

    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"

    canonical_querystring = "X-Amz-Algorithm=AWS4-HMAC-SHA256"
    canonical_querystring += f"&X-Amz-Credential={urllib.parse.quote_plus(credentials.access_key + '/' + credential_scope)}"
    canonical_querystring += f"&X-Amz-Date={amz_date}"
    canonical_querystring += "&X-Amz-Expires=86400"
    canonical_querystring += "&X-Amz-SignedHeaders=host"
    if credentials.token:
        canonical_querystring += f"&X-Amz-Security-Token={urllib.parse.quote_plus(credentials.token)}"

    canonical_headers = f"host:{host}\n"
    payload_hash = hashlib.sha256(b"").hexdigest()

    canonical_request = f"{method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\nhost\n{payload_hash}"

    string_to_sign = f"AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"

    signing_key = get_signature_key(credentials.secret_key, date_stamp, region, service)
    signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    canonical_querystring += f"&X-Amz-Signature={signature}"

    return f"wss://{host}{canonical_uri}?{canonical_querystring}"


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
    print("  IoT Core Lab — Device Simulator (WebSocket)")
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

    # Get AWS credentials
    print("🔑 Getting AWS credentials...")
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    credentials = session.get_credentials().get_frozen_credentials()

    # Build signed WebSocket URL
    ws_url = get_sigv4_websocket_url(ENDPOINT, REGION, credentials)

    # Parse URL for paho
    parsed = urllib.parse.urlparse(ws_url)
    path_with_query = f"{parsed.path}?{parsed.query}"

    # Create MQTT client with WebSocket transport
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=THING_NAME,
        transport="websockets",
    )
    client.ws_set_options(path=path_with_query)

    # TLS — disable verification to work through corporate proxy
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    client.tls_set_context(ssl_context)

    connected = False
    published_count = 0

    def on_connect(client, userdata, flags, reason_code, properties):
        nonlocal connected
        if reason_code == 0:
            print("✅ Connected to IoT Core via WebSocket!\n")
            connected = True
        else:
            print(f"❌ Connection failed: {reason_code}")
            sys.exit(1)

    def on_publish(client, userdata, mid, reason_codes, properties):
        pass

    def on_disconnect(client, userdata, flags, reason_code, properties):
        nonlocal connected
        connected = False
        if reason_code != 0:
            print(f"⚠️  Unexpected disconnect: {reason_code}")

    client.on_connect = on_connect
    client.on_publish = on_publish
    client.on_disconnect = on_disconnect

    print("🔌 Connecting to IoT Core via WebSocket (port 443)...")
    client.connect(ENDPOINT, port=443)
    client.loop_start()

    # Wait for connection
    timeout = 10
    while not connected and timeout > 0:
        time.sleep(0.5)
        timeout -= 0.5

    if not connected:
        print("❌ Connection timed out")
        sys.exit(1)

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

            result = client.publish(TOPIC, message, qos=1)
            result.wait_for_publish()
            published_count += 1

            print(f"   ✅ Published successfully")
            print()

            if 0 < MESSAGE_COUNT <= count:
                break

            time.sleep(INTERVAL)

    except KeyboardInterrupt:
        print("\n⏹️  Stopped by user")

    # Disconnect
    print("\n🔌 Disconnecting...")
    client.loop_stop()
    client.disconnect()
    print("✅ Disconnected.")
    print(f"\n📊 Total messages sent: {published_count}")
    print(f"📦 Check S3 bucket for stored data!")


if __name__ == "__main__":
    main()
