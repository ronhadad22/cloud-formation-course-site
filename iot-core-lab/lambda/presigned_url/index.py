"""
Lambda: Generate a presigned S3 PUT URL and publish it back to IoT Core.

Triggered by IoT Rule when a device publishes to devices/+/upload-request.
The device receives the presigned URL on devices/<thing>/upload-response.
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3

s3_client = boto3.client("s3")
iot_client = boto3.client("iot-data")

BUCKET = os.environ["S3_BUCKET"]
URL_EXPIRATION = int(os.environ.get("URL_EXPIRATION", "300"))  # 5 minutes


def handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    device_id = event.get("device_id", "unknown")
    filename = event.get("filename", f"{uuid.uuid4().hex}.dat")
    content_type = event.get("content_type", "application/octet-stream")

    # Build S3 key: uploads/<device_id>/<date>/<filename>
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    s3_key = f"uploads/{device_id}/{date_prefix}/{filename}"

    # Generate presigned PUT URL
    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=URL_EXPIRATION,
    )

    response_payload = {
        "request_id": event.get("request_id", uuid.uuid4().hex),
        "device_id": device_id,
        "presigned_url": presigned_url,
        "s3_bucket": BUCKET,
        "s3_key": s3_key,
        "content_type": content_type,
        "expires_in": URL_EXPIRATION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Publish the presigned URL back to the device's response topic
    response_topic = f"devices/{device_id}/upload-response"
    print(f"Publishing presigned URL to {response_topic}")

    iot_client.publish(
        topic=response_topic,
        qos=1,
        payload=json.dumps(response_payload),
    )

    print(f"Presigned URL generated for s3://{BUCKET}/{s3_key}")
    return response_payload
