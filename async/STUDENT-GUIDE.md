# EventBridge Assignment - Quick Guide

## What You'll Build

Upload file to S3 → EventBridge catches it → Sends email notification

Then add layers: SQS → Lambda → DynamoDB

---

## Part 1: Deploy (30 min)

### Step 1: Deploy the Stack

```bash
aws cloudformation create-stack \
  --stack-name my-eventbridge \
  --template-body file://eventbridge.yaml \
  --region us-east-2 \
  --parameters \
    ParameterKey=BucketName,ParameterValue=student-eb-YOURNAME \
    ParameterKey=EmailAddress,ParameterValue=YOUR-EMAIL \
  --capabilities CAPABILITY_IAM \
  --profile YOUR-PROFILE
```

### Step 2: Wait & Confirm Email

```bash
# Wait for stack (2-3 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name my-eventbridge \
  --region us-east-2

# Check your email and click "Confirm subscription"
```

### Step 3: Test It

Upload any file to your S3 bucket using AWS Console or CLI.

Check your email - notification arrives in 1-2 minutes.

**✅ Deliverable**: Screenshot of email notification

---

## Part 2: Deploy SNS-to-SQS (30 min)

### Why?
Learn how SNS fans out messages to multiple SQS queues - one message reaches many consumers.

### Deploy the Stack

```bash
aws cloudformation create-stack \
  --stack-name my-sns-to-sqs \
  --template-body file://sns.yaml \
  --region us-east-2 \
  --parameters \
    ParameterKey=MyPublishUserPassword,ParameterValue=TempPass123 \
    ParameterKey=MyQueueUserPassword,ParameterValue=TempPass456 \
  --capabilities CAPABILITY_IAM
```

### What Gets Created

- **1 SNS Topic** → Publishes messages
- **2 SQS Queues** → Receive messages from SNS
- **IAM Users** → One to publish, one to consume
- **Policies** → Permissions for everything

### Test It

1. Go to SNS Console → Find your topic
2. Click "Publish message"
3. Enter any message and publish
4. Go to SQS Console → Check both queues
5. Both queues should have the same message

**✅ Deliverable**: Screenshot showing message in both SQS queues

---

## Part 3: Add SQS Queue (30 min)

### Why?
Store events in a queue so Lambda can process them reliably.

### Create `layer1-sqs.yaml`

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  EventQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: my-eventbridge-queue

  QueuePolicy:
    Type: AWS::SQS::QueuePolicy
    Properties:
      Queues: [!Ref EventQueue]
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: events.amazonaws.com
            Action: sqs:SendMessage
            Resource: !GetAtt EventQueue.Arn

Outputs:
  QueueArn:
    Value: !GetAtt EventQueue.Arn
  QueueUrl:
    Value: !Ref EventQueue
```

### Deploy & Connect

```bash
# Deploy SQS
aws cloudformation create-stack \
  --stack-name my-eventbridge-sqs \
  --template-body file://layer1-sqs.yaml \
  --region us-east-2

# Get queue ARN
QUEUE_ARN=$(aws cloudformation describe-stacks \
  --stack-name my-eventbridge-sqs \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`QueueArn`].OutputValue' \
  --output text)

# Add SQS as target to EventBridge rule
aws events put-targets \
  --rule eventbridge-rule-example \
  --targets "Id=ToSQS,Arn=$QUEUE_ARN" \
  --region us-east-2
```

### Test

Upload a file to S3, then check SQS queue in AWS Console.

You should see the event message in the queue.

**✅ Deliverable**: Screenshot showing message in SQS

---

## Part 4: Add Lambda (45 min)

### Why?
Process events automatically - extract file info, validate, transform data.

### Create `processor.py`

```python
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    for record in event['Records']:
        body = json.loads(record['body'])
        detail = body.get('detail', {})
        
        bucket = detail.get('bucket', {}).get('name')
        key = detail.get('object', {}).get('key')
        size = detail.get('object', {}).get('size')
        
        logger.info(f"File: {key}, Bucket: {bucket}, Size: {size} bytes")
    
    return {'statusCode': 200}
```

### Create `layer2-lambda.yaml`

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  ProcessorFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: eventbridge-processor
      Runtime: python3.11
      Handler: index.lambda_handler
      Role: !GetAtt LambdaRole.Arn
      Code:
        ZipFile: |
          import json
          import logging
          logger = logging.getLogger()
          logger.setLevel(logging.INFO)
          def lambda_handler(event, context):
              for record in event['Records']:
                  body = json.loads(record['body'])
                  detail = body.get('detail', {})
                  key = detail.get('object', {}).get('key')
                  logger.info(f"Processing: {key}")
              return {'statusCode': 200}

  LambdaRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        - arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole

  EventSourceMapping:
    Type: AWS::Lambda::EventSourceMapping
    Properties:
      EventSourceArn: 
        Fn::ImportValue: my-eventbridge-sqs-QueueArn
      FunctionName: !Ref ProcessorFunction
      BatchSize: 10
```

### Deploy & Test

```bash
# Deploy Lambda
aws cloudformation create-stack \
  --stack-name my-eventbridge-lambda \
  --template-body file://layer2-lambda.yaml \
  --region us-east-2 \
  --capabilities CAPABILITY_IAM
```

Upload a file to S3, then check Lambda logs in CloudWatch Console.

**✅ Deliverable**: Screenshot of Lambda logs showing file processing

---

## Part 5: Add DynamoDB (30 min)

### Why?
Store event history - who uploaded what and when.

### Create `layer3-dynamodb.yaml`

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  EventTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: eventbridge-events
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: eventId
          AttributeType: S
      KeySchema:
        - AttributeName: eventId
          KeyType: HASH

Outputs:
  TableName:
    Value: !Ref EventTable
```

### Update Lambda Code

```python
import json
import logging
import boto3
import os
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('eventbridge-events')

def lambda_handler(event, context):
    for record in event['Records']:
        body = json.loads(record['body'])
        detail = body.get('detail', {})
        
        # Save to DynamoDB
        table.put_item(Item={
            'eventId': body.get('id'),
            'bucket': detail.get('bucket', {}).get('name'),
            'key': detail.get('object', {}).get('key'),
            'size': detail.get('object', {}).get('size'),
            'timestamp': body.get('time'),
            'processedAt': datetime.utcnow().isoformat()
        })
        
        logger.info(f"Saved event {body.get('id')}")
    
    return {'statusCode': 200}
```

### Deploy & Test

```bash
# Deploy DynamoDB
aws cloudformation create-stack \
  --stack-name my-eventbridge-dynamodb \
  --template-body file://layer3-dynamodb.yaml \
  --region us-east-2
```

Update Lambda function with new code (add DynamoDB write logic).

Upload a file to S3, then check DynamoDB table in AWS Console.

**✅ Deliverable**: Screenshot of DynamoDB table with data

---

## Grading (100 points)

| Task | Points |
|------|--------|
| Part 1: EventBridge base deployment | 20 |
| Part 2: SNS-to-SQS fan-out pattern | 20 |
| Part 3: EventBridge + SQS integration | 20 |
| Part 4: Lambda processes events | 20 |
| Part 5: DynamoDB stores data | 20 |

---

## Submission

Create a folder with:
```
submission/
├── screenshots/
│   ├── 1-eventbridge-email.png
│   ├── 2-sns-fanout.png
│   ├── 3-eventbridge-sqs.png
│   ├── 4-lambda-logs.png
│   └── 5-dynamodb.png
├── layer1-sqs.yaml
├── layer2-lambda.yaml
├── layer3-dynamodb.yaml
└── README.md (explain what you built)
```

---

## Troubleshooting

**Email not received?**
- Check spam folder
- Confirm SNS subscription

**SQS empty?**
- Wait 10-20 seconds after upload
- Check EventBridge rule has SQS target

**Lambda not running?**
- Check event source mapping exists
- View Lambda logs for errors

**DynamoDB empty?**
- Check Lambda has DynamoDB permissions
- View Lambda logs for errors

---

## Clean Up

```bash
# Delete stacks (reverse order)
aws cloudformation delete-stack --stack-name my-eventbridge-dynamodb --region us-east-2
aws cloudformation delete-stack --stack-name my-eventbridge-lambda --region us-east-2
aws cloudformation delete-stack --stack-name my-eventbridge-sqs --region us-east-2
aws cloudformation delete-stack --stack-name my-sns-to-sqs --region us-east-2

# Empty S3 bucket first
aws s3 rm s3://student-eb-YOURNAME --recursive --region us-east-2

# Delete base stack
aws cloudformation delete-stack --stack-name my-eventbridge --region us-east-2
```

---

**Questions?** Ask in class or office hours.

**Good luck! 🚀**
