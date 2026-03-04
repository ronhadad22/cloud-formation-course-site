#!/usr/bin/env python3
"""
IoT Core Lab — HTTP Device Upload Simulator

Flow:
1. Device publishes upload request to IoT Core (devices/<thing>/upload-request)
2. IoT Rule triggers Lambda → generates presigned S3 PUT URL
3. Lambda publishes presigned URL back to (devices/<thing>/upload-response)
4. Device polls the response topic via IoT Data Plane
5. Device uploads a file directly to S3 using the presigned URL (HTTP PUT)

Uses HTTPS throughout — works through corporate proxies.
"""

import json
import time
import uuid
import os
import sys
import ssl
import warnings
from datetime import datetime, timezone

import boto3
import urllib.request

# Suppress SSL warnings for corporate proxy
warnings.filterwarnings("ignore")
ssl._create_default_https_context = ssl._create_unverified_context

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
REGION = os.environ.get("AWS_REGION", "eu-west-1")
PROFILE = os.environ.get("AWS_PROFILE", "iitc-profile")

REQUEST_TOPIC = f"devices/{THING_NAME}/upload-request"
RESPONSE_TOPIC = f"devices/{THING_NAME}/upload-response"


def generate_sample_file():
    """Generate sample sensor data file to upload."""
    data = {
        "device_id": THING_NAME,
        "report_type": "daily_summary",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "measurements": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "temperature": 22.5 + i * 0.3,
                "humidity": 55.0 + i * 1.2,
                "pressure": 1013.25 + i * 0.1,
            }
            for i in range(10)
        ],
        "summary": {
            "avg_temperature": 24.0,
            "avg_humidity": 60.4,
            "min_temperature": 22.5,
            "max_temperature": 25.2,
            "total_readings": 10,
        },
    }
    return json.dumps(data, indent=2).encode("utf-8")


def main():
    request_id = uuid.uuid4().hex[:8]
    filename = f"sensor-report-{request_id}.json"

    print("=" * 55)
    print("  IoT Core Lab — HTTP Device Upload")
    print("=" * 55)
    print(f"  Endpoint:   {ENDPOINT}")
    print(f"  Thing:      {THING_NAME}")
    print(f"  Request ID: {request_id}")
    print(f"  Filename:   {filename}")
    print("=" * 55)
    print()

    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    iot_data = session.client(
        "iot-data",
        endpoint_url=f"https://{ENDPOINT}",
        verify=False,
    )

    # ── Step 1: Publish upload request to IoT Core ──
    print("📤 Step 1: Requesting presigned URL via IoT Core...")
    upload_request = {
        "request_id": request_id,
        "device_id": THING_NAME,
        "filename": filename,
        "content_type": "application/json",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    iot_data.publish(
        topic=REQUEST_TOPIC,
        qos=1,
        payload=json.dumps(upload_request),
    )
    print(f"   ✅ Published to {REQUEST_TOPIC}")
    print()

    # ── Step 2: Poll for presigned URL response ──
    print("⏳ Step 2: Waiting for presigned URL from Lambda...")
    print("   (Lambda receives via IoT Rule, generates URL, publishes to response topic)")
    print()

    # Give Lambda a moment to process
    time.sleep(3)

    # Since we can't easily subscribe via HTTPS, we invoke the Lambda directly
    # to get the presigned URL. In a real MQTT setup, the device would subscribe
    # to the response topic. Here we simulate by calling the Lambda.
    lambda_client = session.client("lambda", region_name=REGION)
    lambda_response = lambda_client.invoke(
        FunctionName="iot-lab-presigned-url",
        InvocationType="RequestResponse",
        Payload=json.dumps(upload_request),
    )

    response_payload = json.loads(lambda_response["Payload"].read())
    presigned_url = response_payload["presigned_url"]
    s3_key = response_payload["s3_key"]

    print(f"   ✅ Received presigned URL!")
    print(f"   S3 Key: {s3_key}")
    print(f"   Expires in: {response_payload['expires_in']}s")
    print()

    # ── Step 3: Upload file directly to S3 ──
    print("📤 Step 3: Uploading file directly to S3 via presigned URL...")
    file_data = generate_sample_file()
    print(f"   File size: {len(file_data)} bytes")

    req = urllib.request.Request(
        presigned_url,
        data=file_data,
        method="PUT",
        headers={"Content-Type": "application/json"},
    )

    try:
        response = urllib.request.urlopen(req)
        print(f"   ✅ Upload successful! HTTP {response.status}")
    except urllib.error.HTTPError as e:
        print(f"   ❌ Upload failed: HTTP {e.code} — {e.read().decode()}")
        sys.exit(1)
    print()

    # ── Step 4: Verify ──
    print("🔍 Step 4: Verifying upload in S3...")
    s3_client = session.client("s3", region_name=REGION)
    bucket = response_payload["s3_bucket"]

    try:
        obj = s3_client.head_object(Bucket=bucket, Key=s3_key)
        size = obj.get("ContentLength", obj.get("contentLength", "unknown"))
        modified = obj.get("LastModified", obj.get("lastModified", "unknown"))
        print(f"   ✅ Object found in S3!")
        print(f"   Bucket:       {bucket}")
        print(f"   Key:          {s3_key}")
        print(f"   Size:         {size} bytes")
        print(f"   Last Modified: {modified}")
    except Exception as e:
        print(f"   ⚠️  Could not verify: {e}")

    print()
    print("=" * 55)
    print("  ✅ Upload Complete!")
    print("=" * 55)
    print()
    print("  Flow summary:")
    print(f"  1. Device → IoT Core ({REQUEST_TOPIC})")
    print(f"  2. IoT Rule → Lambda (generates presigned URL)")
    print(f"  3. Lambda → IoT Core ({RESPONSE_TOPIC})")
    print(f"  4. Device → S3 (direct HTTP PUT)")
    print(f"  5. File stored: s3://{bucket}/{s3_key}")


if __name__ == "__main__":
    main()
