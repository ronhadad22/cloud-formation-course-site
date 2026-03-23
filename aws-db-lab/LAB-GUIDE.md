# AWS Database Decision Lab

## How This Lab Works

This lab is a **quiz** — each question presents a real-world scenario. Think about which AWS database service is the best fit, then reveal the answer. After each answer, you'll do a **hands-on mini-lab** to experience that service firsthand.

### Services Covered
- **Amazon DynamoDB** — NoSQL key-value store, millisecond latency
- **Amazon Athena + S3** — Serverless SQL queries on files in S3
- **Amazon RDS (MySQL)** — Managed relational database with SQL and transactions

### Lab Cost
- **DynamoDB**: Free tier (25GB free)
- **Athena**: ~$0.005 per query (pennies)
- **RDS t3.micro**: ~$0.02/hour
- **Total**: **Under $1** if you clean up after

---

## Part 1: Deploy the Infrastructure

```bash
aws cloudformation deploy \
  --stack-name aws-db-lab \
  --template-file aws-db-lab/cloudformation/01-infrastructure.yaml \
  --parameter-overrides DBPassword=LabPassword123! \
  --capabilities CAPABILITY_NAMED_IAM
```

**Wait ~5-8 minutes** (RDS takes time to create).

Get the outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name aws-db-lab \
  --query 'Stacks[0].Outputs' --output table
```

Note down all the output values — you'll need them for the mini-labs.

---

## The Decision Tree

Before starting the quiz, study this decision tree:

```
                    What kind of data do you have?
                    /              |              \
                   /               |               \
            Structured         Semi-structured      Files in S3
          (tables, rows)      (JSON, key-value)    (CSV, Parquet, logs)
               |                    |                     |
        Need complex JOINs?   Need <10ms latency?   Need to query them?
        Need transactions?    Unpredictable scale?        |
               |                    |                     |
              YES                  YES                   YES
               |                    |                     |
             RDS              DynamoDB              Athena + S3
         (MySQL, PostgreSQL)  (NoSQL, serverless)   (serverless SQL)
```

### When to Use Each Service

| Service | Best For | NOT Good For |
|---------|----------|-------------|
| **DynamoDB** | Key-value lookups, session stores, real-time apps, massive scale | Complex JOINs, ad-hoc analytics, transactions across tables |
| **Athena + S3** | Querying data already in S3, log analysis, one-time analytics | Real-time queries, frequent updates, sub-second latency |
| **RDS** | Complex relationships, transactions, JOINs, structured data | Massive horizontal scale, key-value patterns, unstructured data |

---

# Quiz Time!

---

## Question 1: TechShop — Black Friday Sale

> **Scenario**: TechShop is an online store preparing for Black Friday. They expect **5 million users** browsing products simultaneously. Each product page must load in **under 10 milliseconds**. Product data is simple: product_id, name, price, category, stock count. Traffic is very spiky — 100x normal during the sale.

**Think about it:**
- What kind of data is this? (structured/semi-structured/files?)
- Do we need complex JOINs?
- Do we need super-fast reads?
- Does the workload scale unpredictably?

<details>
<summary>Click to reveal the answer</summary>

### Answer: Amazon DynamoDB

**Why DynamoDB?**
- **Millisecond latency** at any scale — handles 5 million concurrent users easily
- **Key-value pattern** — looking up products by `product_id` is exactly what DynamoDB does best
- **Auto-scaling** — handles the 100x Black Friday spike automatically with on-demand billing
- **Simple data model** — no complex relationships between products

**Why NOT the others?**
- **RDS** would struggle with 5M concurrent users and spiky traffic (needs pre-provisioned capacity)
- **Athena** is too slow (~seconds per query) for real-time product pages

</details>

---

### Mini-Lab 1: DynamoDB Hands-On

**Story**: You're the backend engineer at TechShop. Build the product catalog!

#### Step 1: Seed the products table

The CloudFormation already created the DynamoDB table. Let's add products:

```bash
chmod +x aws-db-lab/scripts/seed-dynamodb.sh
./aws-db-lab/scripts/seed-dynamodb.sh aws-db-lab-products <YOUR-REGION>
```

#### Step 2: Get a single product (the key-value lookup)

This is what happens when a customer opens a product page:

```bash
aws dynamodb get-item \
  --table-name aws-db-lab-products \
  --key '{"product_id": {"S": "ELEC-001"}}' \
  --output table
```

**Notice how fast that was!** DynamoDB returns in single-digit milliseconds regardless of table size.

#### Step 3: Browse by category (using Global Secondary Index)

Customer clicks "Electronics" category:

```bash
aws dynamodb query \
  --table-name aws-db-lab-products \
  --index-name category-index \
  --key-condition-expression "category = :cat" \
  --expression-attribute-values '{":cat": {"S": "electronics"}}' \
  --output table
```

#### Step 4: Update stock after purchase (atomic counter)

Customer buys 2 headphones — decrease stock atomically:

```bash
aws dynamodb update-item \
  --table-name aws-db-lab-products \
  --key '{"product_id": {"S": "ELEC-001"}}' \
  --update-expression "SET stock = stock - :qty" \
  --expression-attribute-values '{":qty": {"N": "2"}}' \
  --return-values UPDATED_NEW \
  --output table
```

**This is atomic** — even with millions of concurrent purchases, the stock count stays accurate.

#### Step 5: Check it in the Console

1. Go to **DynamoDB Console**: https://console.aws.amazon.com/dynamodb/
2. Click **Tables** → `aws-db-lab-products`
3. Click **Explore table items**
4. See your products and verify ELEC-001 stock decreased by 2

#### Key Takeaway

DynamoDB is perfect for TechShop because:
- Lookup by `product_id` = single-digit millisecond response
- GSI on `category` = fast category browsing
- Atomic updates = safe concurrent stock management
- On-demand billing = handles Black Friday spikes automatically

---

## Question 2: CloudTaxi — Ride Analytics

> **Scenario**: CloudTaxi is a ride-sharing company. They have **2 years of ride data** stored as CSV files in S3 — pickup location, dropoff, fare, distance, driver, etc. The analytics team wants to answer questions like: "What's the average fare from Tel Aviv?", "Who is our top driver?", "What's the busiest pickup location?" They query this data a **few times per month** and don't want to manage any infrastructure.

**Think about it:**
- Where is the data? (already in S3!)
- How often do they query? (infrequently)
- Do they need a running database server?
- What kind of queries? (SQL analytics)

<details>
<summary>Click to reveal the answer</summary>

### Answer: Amazon Athena + S3

**Why Athena?**
- **Data is already in S3** — no need to load it anywhere else
- **Serverless** — no infrastructure to manage, no servers running 24/7
- **Pay per query** — perfect for occasional analytics ($5 per TB scanned)
- **Standard SQL** — analysts already know SQL, no new language to learn

**Why NOT the others?**
- **DynamoDB** can't do analytics queries like GROUP BY, AVG, or JOINs efficiently
- **RDS** would require loading all the CSV data into a database, keeping a server running 24/7 — wasteful for monthly queries

</details>

---

### Mini-Lab 2: Athena + S3 Hands-On

**Story**: You're the data analyst at CloudTaxi. The CEO wants insights from ride data — NOW!

#### Step 1: Upload ride data to S3

```bash
DATA_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name aws-db-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' \
  --output text)

aws s3 cp aws-db-lab/data/rides.csv s3://$DATA_BUCKET/rides/rides.csv

echo "Data uploaded to: s3://$DATA_BUCKET/rides/"
```

#### Step 2: Open Athena Console

1. Go to **Athena Console**: https://console.aws.amazon.com/athena/
2. If asked about workgroup, select `aws-db-lab-workgroup`
3. You're now in the **Query Editor**

#### Step 3: Create a database and table

Run this SQL in Athena's query editor:

```sql
CREATE DATABASE IF NOT EXISTS cloudtaxi;
```

Then create a table that points to the S3 data:

```sql
CREATE EXTERNAL TABLE cloudtaxi.rides (
  ride_id INT,
  driver_name STRING,
  passenger_name STRING,
  pickup_location STRING,
  dropoff_location STRING,
  fare DOUBLE,
  distance_km DOUBLE,
  duration_min INT,
  payment_method STRING,
  ride_date DATE,
  rating INT
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://<DATA_BUCKET>/rides/'
TBLPROPERTIES ('skip.header.line.count'='1');
```

> **Replace `<DATA_BUCKET>`** with your actual bucket name from Step 1!

#### Step 4: Run analytics queries

**CEO asks: "What's our total revenue?"**
```sql
SELECT 
  COUNT(*) as total_rides,
  ROUND(SUM(fare), 2) as total_revenue,
  ROUND(AVG(fare), 2) as avg_fare,
  ROUND(AVG(distance_km), 1) as avg_distance
FROM cloudtaxi.rides;
```

**CEO asks: "Who is our best driver?"**
```sql
SELECT 
  driver_name,
  COUNT(*) as total_rides,
  ROUND(SUM(fare), 2) as total_revenue,
  ROUND(AVG(rating), 1) as avg_rating
FROM cloudtaxi.rides
GROUP BY driver_name
ORDER BY total_revenue DESC;
```

**CEO asks: "What's the busiest pickup location?"**
```sql
SELECT 
  pickup_location,
  COUNT(*) as ride_count,
  ROUND(AVG(fare), 2) as avg_fare
FROM cloudtaxi.rides
GROUP BY pickup_location
ORDER BY ride_count DESC
LIMIT 5;
```

**CEO asks: "How do customers pay?"**
```sql
SELECT 
  payment_method,
  COUNT(*) as count,
  ROUND(SUM(fare), 2) as total_revenue
FROM cloudtaxi.rides
GROUP BY payment_method
ORDER BY total_revenue DESC;
```

#### Step 5: Check query cost

After each query, Athena shows **"Data scanned"** at the bottom. Notice:
- Our CSV is tiny (~2KB), so each query costs **fractions of a cent**
- Athena charges **$5 per TB scanned**
- In production, use **Parquet format** (columnar) to reduce data scanned by 90%+

#### Key Takeaway

Athena is perfect for CloudTaxi because:
- Data stays in S3 — no ETL or data loading needed
- Standard SQL — analysts are immediately productive
- Serverless — zero infrastructure to manage
- Pay per query — a few cents per month for occasional analytics

---

## Question 3: MediCare — Hospital Management System

> **Scenario**: MediCare hospital needs a system to manage patients, doctors, appointments, and prescriptions. When a doctor writes a prescription, the system must update the prescription table AND the appointment status **atomically** (both succeed or both fail). They need queries like: "Find all patients who saw Dr. Cohen and were prescribed Aspirin" — which involves **JOINing 4 tables**. The hospital has ~500 concurrent users.

**Think about it:**
- Is the data structured with relationships?
- Do we need transactions (ACID)?
- Do we need complex JOINs across tables?
- Is the scale moderate (not millions)?

<details>
<summary>Click to reveal the answer</summary>

### Answer: Amazon RDS (MySQL)

**Why RDS?**
- **Relational data** — patients, doctors, appointments, prescriptions have clear relationships
- **ACID transactions** — prescription + appointment update must be atomic
- **Complex JOINs** — "patients who saw Dr. Cohen with Aspirin" requires joining 4 tables
- **500 concurrent users** — well within RDS capacity

**Why NOT the others?**
- **DynamoDB** doesn't support JOINs natively and transactions are limited to 25 items
- **Athena** is for analytics on S3 files, not real-time transactional applications

</details>

---

### Mini-Lab 3: RDS MySQL Hands-On

**Story**: You're the database admin at MediCare hospital. Set up the patient management system!

#### Step 1: Get the RDS endpoint

```bash
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name aws-db-lab \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpoint`].OutputValue' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

#### Step 2: Connect to MySQL

You need a MySQL client. If you don't have one:

**Option A — From your local machine (if you have mysql client):**
```bash
mysql -h $RDS_ENDPOINT -u admin -p hospital_db
```
Enter password: `LabPassword123!`

**Option B — Use CloudShell in the AWS Console:**
1. Open AWS CloudShell (top navigation bar)
2. Run the same `mysql` command above

**Option C — Use a GUI tool like DBeaver or MySQL Workbench**

#### Step 3: Create tables and seed data

Copy and paste the contents of `aws-db-lab/scripts/setup-rds.sql` into your MySQL session, or run:

```bash
mysql -h $RDS_ENDPOINT -u admin -p hospital_db < aws-db-lab/scripts/setup-rds.sql
```

You should see:
```
+---------------+-----------+
| table_name    | row_count |
+---------------+-----------+
| Doctors       |         5 |
| Patients      |         8 |
| Appointments  |        12 |
| Prescriptions |         8 |
+---------------+-----------+
```

#### Step 4: Run queries that show WHY you need a relational database

**Query 1: "Find all patients who saw Dr. Cohen"** (2-table JOIN)

```sql
SELECT 
  p.first_name, p.last_name, 
  a.appointment_date, a.notes
FROM patients p
JOIN appointments a ON p.patient_id = a.patient_id
JOIN doctors d ON a.doctor_id = d.doctor_id
WHERE d.last_name = 'Cohen'
ORDER BY a.appointment_date;
```

**Try doing THIS in DynamoDB!** You'd need multiple queries and application-side joins.

---

**Query 2: "Find patients prescribed Aspirin by Dr. Cohen"** (4-table JOIN)

```sql
SELECT 
  p.first_name, p.last_name,
  d.first_name AS doctor_first, d.last_name AS doctor_last,
  pr.medication_name, pr.dosage
FROM patients p
JOIN appointments a ON p.patient_id = a.patient_id
JOIN doctors d ON a.doctor_id = d.doctor_id
JOIN prescriptions pr ON a.appointment_id = pr.appointment_id
WHERE d.last_name = 'Cohen' AND pr.medication_name = 'Aspirin';
```

**4 tables joined in one query.** This is where relational databases shine.

---

**Query 3: "Doctor workload report"** (aggregate with JOIN)

```sql
SELECT 
  d.first_name, d.last_name, d.specialty,
  COUNT(a.appointment_id) AS total_appointments,
  COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed,
  COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled
FROM doctors d
LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
GROUP BY d.doctor_id, d.first_name, d.last_name, d.specialty
ORDER BY total_appointments DESC;
```

---

#### Step 5: Demonstrate a TRANSACTION

This is the killer feature. Dr. Cohen writes a prescription — it must update BOTH the prescription table AND the appointment status atomically:

```sql
START TRANSACTION;

-- Add the prescription
INSERT INTO prescriptions (appointment_id, medication_name, dosage, duration_days, notes)
VALUES (10, 'Tretinoin Cream', 'Apply nightly', 30, 'For acne treatment');

-- Update appointment status
UPDATE appointments SET status = 'completed' WHERE appointment_id = 10;

COMMIT;
```

**Both operations succeed or both fail.** If the server crashes between the INSERT and UPDATE, the transaction rolls back — no partial data.

Try it with a deliberate rollback:

```sql
START TRANSACTION;

INSERT INTO prescriptions (appointment_id, medication_name, dosage, duration_days, notes)
VALUES (11, 'Test Medicine', '100mg', 7, 'This will be rolled back');

-- Oops, changed our mind
ROLLBACK;

-- Verify the prescription was NOT added
SELECT * FROM prescriptions WHERE medication_name = 'Test Medicine';
-- Returns 0 rows!
```

#### Step 6: Check it in the Console

1. Go to **RDS Console**: https://console.aws.amazon.com/rds/
2. Click **Databases** → `aws-db-lab-mysql`
3. See the instance details: engine, storage, endpoint, status

#### Key Takeaway

RDS is perfect for MediCare because:
- Complex JOINs across 4+ tables in a single query
- ACID transactions for critical medical data
- Referential integrity (foreign keys prevent orphaned records)
- Standard SQL — familiar to any developer

---

## Question 4: GameZone — Real-Time Leaderboard

> **Scenario**: GameZone is a mobile gaming platform with **10 million active players**. They need to: (1) Get any player's score instantly by player_id, (2) Show the top 100 global leaderboard, (3) Handle **50,000 score updates per second** during peak hours. Data per player: player_id, username, score, level, last_played.

**Think about it:**
- Is this key-value access pattern?
- Do we need extreme write throughput?
- Do we need millisecond reads?
- Is the data model simple?

<details>
<summary>Click to reveal the answer</summary>

### Answer: Amazon DynamoDB (with Global Secondary Index)

**Why DynamoDB again?**
- **Key-value pattern** — get player by `player_id` = instant
- **50K writes/second** — DynamoDB handles this easily with on-demand capacity
- **GSI** — create an index on `score` to power the leaderboard query
- **10M players** — no problem, DynamoDB scales to any table size

**Why NOT RDS?**
- 50K writes/second would overwhelm most RDS instances
- Leaderboard query with ORDER BY on 10M rows is slow in RDS
- Would need read replicas and careful tuning

**Why NOT Athena?**
- Athena has seconds-long query times — not suitable for real-time leaderboard

</details>

---

### Mini-Lab 4: DynamoDB Leaderboard (CLI Exercise)

No new infrastructure needed! Use the existing DynamoDB table to practice:

```bash
# Scan all products sorted by price (simulating a "top products" leaderboard)
aws dynamodb scan \
  --table-name aws-db-lab-products \
  --projection-expression "product_id, #n, price, rating" \
  --expression-attribute-names '{"#n": "name"}' \
  --output table
```

**Takeaway**: In production, you'd create a GSI on `score` (descending) to power the leaderboard without scanning the whole table.

---

## Question 5: LogHunter — Security Log Analysis

> **Scenario**: A company stores **3 years of web server access logs** (500GB) as gzipped text files in S3. The security team needs to investigate an incident: "Find all requests from IP 192.168.1.100 in the last 30 days." They do this kind of investigation **a few times per month** — no need for real-time dashboards.

**Think about it:**
- Where is the data? (S3)
- Is this a one-time/infrequent query?
- Do they need a running server?
- Is cost important?

<details>
<summary>Click to reveal the answer</summary>

### Answer: Amazon Athena + S3

**Why Athena again?**
- **Data is already in S3** — no copying needed
- **SQL on files** — `SELECT * FROM logs WHERE source_ip = '192.168.1.100'`
- **500GB scanned = ~$2.50** — extremely cheap for a security investigation
- **Serverless** — no server sitting idle between investigations

**Cost comparison:**
- **Athena**: $2.50 per investigation (pay per query)
- **RDS**: Would need to load 500GB into a database (~$50/month storage + instance cost)
- **DynamoDB**: Not designed for full-text search across logs

</details>

---

### Mini-Lab 5: Athena — More Advanced Queries

Go back to the Athena console and try these on the CloudTaxi data:

**Find all rides by a specific passenger:**
```sql
SELECT * FROM cloudtaxi.rides 
WHERE passenger_name = 'David Levi'
ORDER BY ride_date;
```

**Revenue trend by month:**
```sql
SELECT 
  DATE_FORMAT(ride_date, '%Y-%m') AS month,
  COUNT(*) AS rides,
  ROUND(SUM(fare), 2) AS revenue
FROM cloudtaxi.rides
GROUP BY DATE_FORMAT(ride_date, '%Y-%m')
ORDER BY month;
```

**Takeaway**: Same pattern as LogHunter — SQL on data that lives in S3, no servers needed.

---

## Question 6: BankSafe — Money Transfer System

> **Scenario**: BankSafe needs to transfer money between accounts. When $500 is moved from Account A to Account B: (1) Debit $500 from Account A, (2) Credit $500 to Account B. If step 1 succeeds but step 2 fails, **the money vanishes** — this is unacceptable. The system handles ~1,000 transactions/second.

**Think about it:**
- Do we need ACID transactions?
- Is data integrity critical?
- Can we afford partial failures?
- Is the scale moderate?

<details>
<summary>Click to reveal the answer</summary>

### Answer: Amazon RDS (MySQL/PostgreSQL)

**Why RDS?**
- **ACID transactions** — debit and credit happen atomically (both or neither)
- **ROLLBACK** — if credit fails, debit is automatically reversed
- **1,000 TPS** — well within RDS capabilities
- **Data integrity** — constraints ensure balance can't go negative

**Why NOT DynamoDB?**
- DynamoDB transactions are limited to 25 items and lack the full ACID semantics of SQL databases
- No built-in CHECK constraints (can't prevent negative balance at database level)

**Why NOT Athena?**
- Athena is read-only analytics — it can't INSERT, UPDATE, or run transactions

</details>

---

### Mini-Lab 6: RDS Transaction Demo

Go back to your MySQL session and demonstrate:

```sql
-- Create accounts table
CREATE TABLE accounts (
    account_id INT PRIMARY KEY,
    owner_name VARCHAR(100),
    balance DECIMAL(10,2) CHECK (balance >= 0)
);

INSERT INTO accounts VALUES (1, 'Alice', 1000.00);
INSERT INTO accounts VALUES (2, 'Bob', 500.00);

SELECT * FROM accounts;
```

**Safe transfer with transaction:**
```sql
START TRANSACTION;

UPDATE accounts SET balance = balance - 500 WHERE account_id = 1;
UPDATE accounts SET balance = balance + 500 WHERE account_id = 2;

-- Verify before committing
SELECT * FROM accounts;

COMMIT;

-- Final state: Alice=500, Bob=1000
SELECT * FROM accounts;
```

**What happens if it fails? (ROLLBACK)**
```sql
START TRANSACTION;

UPDATE accounts SET balance = balance - 9999 WHERE account_id = 1;
-- Alice would have -9499 balance!

-- Oh no, something's wrong - rollback!
ROLLBACK;

-- Alice still has her money
SELECT * FROM accounts;
```

---

## Summary: The Complete Decision Tree

| Question | Scenario | Answer | Key Reason |
|----------|----------|--------|------------|
| Q1 | TechShop — 5M users, <10ms | **DynamoDB** | Key-value, millisecond latency, auto-scale |
| Q2 | CloudTaxi — CSV analytics | **Athena + S3** | SQL on S3, serverless, pay-per-query |
| Q3 | MediCare — Hospital system | **RDS** | JOINs, transactions, relationships |
| Q4 | GameZone — Leaderboard | **DynamoDB** | 50K writes/sec, GSI for ranking |
| Q5 | LogHunter — Log analysis | **Athena + S3** | Query S3 files, infrequent, cheap |
| Q6 | BankSafe — Money transfers | **RDS** | ACID transactions, rollback |

### Quick Decision Cheat Sheet

```
Need <10ms latency + massive scale?     → DynamoDB
Data already in S3 + infrequent queries? → Athena
Need JOINs + transactions?              → RDS
Simple key-value access?                → DynamoDB
Analytics on large datasets?            → Athena
Complex relationships between entities?  → RDS
```

---

## Cleanup

**IMPORTANT: Clean up to avoid ongoing charges!**

### 1. Delete the CloudFormation stack

```bash
aws cloudformation delete-stack --stack-name aws-db-lab
```

### 2. Delete the Athena database

In the Athena console, run:
```sql
DROP TABLE IF EXISTS cloudtaxi.rides;
DROP DATABASE IF EXISTS cloudtaxi;
```

### 3. Verify cleanup

```bash
aws cloudformation describe-stacks \
  --stack-name aws-db-lab 2>&1 || echo "Stack deleted successfully!"
```

> **Note**: S3 buckets must be empty before CloudFormation can delete them. If the stack deletion fails, empty the buckets first:
> ```bash
> aws s3 rm s3://aws-db-lab-data-<ACCOUNT-ID> --recursive
> aws s3 rm s3://aws-db-lab-athena-results-<ACCOUNT-ID> --recursive
> aws cloudformation delete-stack --stack-name aws-db-lab
> ```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't connect to RDS | Check security group allows your IP on port 3306 |
| Athena query fails | Make sure you selected the `aws-db-lab-workgroup` |
| DynamoDB seed script errors | Verify table name and region match your stack |
| Stack deletion fails | Empty S3 buckets first, then delete stack |
| Athena "table not found" | Make sure you created the database and table in Step 3 |
