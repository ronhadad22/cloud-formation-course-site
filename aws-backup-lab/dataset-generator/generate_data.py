#!/usr/bin/env python3
"""
Healthcare Dataset Generator for AWS Backup DR Lab.
Generates realistic (but fake) medical data for training purposes.
This is for TRAINING AND SIMULATION ONLY - no real patient data.
"""

import json
import csv
import os
import random
import string
import uuid
from datetime import datetime, timedelta

OUTPUT_DIR = "hospital-data"

# ============================================
# Patient Record Generator
# ============================================
FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael",
    "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan",
    "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen",
    "Daniel", "Lisa", "Matthew", "Nancy", "Anthony", "Betty", "Mark",
    "Margaret", "Donald", "Sandra", "Steven", "Ashley", "Andrew", "Dorothy",
    "Paul", "Kimberly", "Joshua", "Emily", "Kenneth", "Donna",
    "Kevin", "Michelle", "Brian", "Carol", "George", "Amanda",
    "Timothy", "Melissa", "Ronald", "Deborah"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
]

DIAGNOSES = [
    "Hypertension", "Type 2 Diabetes", "Asthma", "COPD",
    "Coronary Artery Disease", "Atrial Fibrillation", "Heart Failure",
    "Pneumonia", "Urinary Tract Infection", "Cellulitis",
    "Acute Bronchitis", "Migraine", "Lower Back Pain",
    "Osteoarthritis", "Anxiety Disorder", "Major Depression",
    "Hypothyroidism", "Hyperlipidemia", "GERD", "Anemia"
]

MEDICATIONS = [
    "Lisinopril 10mg", "Metformin 500mg", "Amlodipine 5mg",
    "Atorvastatin 20mg", "Omeprazole 20mg", "Metoprolol 25mg",
    "Losartan 50mg", "Albuterol Inhaler", "Levothyroxine 50mcg",
    "Gabapentin 300mg", "Sertraline 50mg", "Prednisone 10mg",
    "Amoxicillin 500mg", "Ibuprofen 400mg", "Acetaminophen 500mg"
]

BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

DEPARTMENTS = [
    "Emergency", "Cardiology", "Orthopedics", "Neurology",
    "Oncology", "Pediatrics", "Internal Medicine", "Surgery",
    "Radiology", "Pathology"
]

DOCTORS = [
    "Dr. Sarah Chen", "Dr. Michael Roberts", "Dr. Aisha Patel",
    "Dr. James Wilson", "Dr. Maria Santos", "Dr. David Kim",
    "Dr. Rachel Green", "Dr. Ahmed Hassan", "Dr. Lisa Chang",
    "Dr. Robert Taylor"
]


def generate_patients(count=50):
    """Generate patient records as JSON files."""
    patients_dir = os.path.join(OUTPUT_DIR, "patients")
    os.makedirs(patients_dir, exist_ok=True)

    patients = []
    for i in range(1, count + 1):
        patient_id = f"PAT-{i:06d}"
        dob = datetime(
            random.randint(1940, 2005),
            random.randint(1, 12),
            random.randint(1, 28)
        )
        admission = datetime.now() - timedelta(days=random.randint(0, 365))
        num_diagnoses = random.randint(1, 4)
        num_meds = random.randint(1, 5)

        patient = {
            "patient_id": patient_id,
            "first_name": random.choice(FIRST_NAMES),
            "last_name": random.choice(LAST_NAMES),
            "date_of_birth": dob.strftime("%Y-%m-%d"),
            "gender": random.choice(["Male", "Female"]),
            "blood_type": random.choice(BLOOD_TYPES),
            "ssn_hash": uuid.uuid4().hex[:16],
            "contact": {
                "phone": f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",
                "email": f"patient{i}@example.com",
                "address": {
                    "street": f"{random.randint(100,9999)} {random.choice(['Main', 'Oak', 'Elm', 'Park', 'Cedar'])} St",
                    "city": random.choice(["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]),
                    "state": random.choice(["NY", "CA", "IL", "TX", "AZ"]),
                    "zip": f"{random.randint(10000, 99999)}"
                }
            },
            "insurance": {
                "provider": random.choice(["BlueCross", "Aetna", "UnitedHealth", "Cigna", "Humana"]),
                "policy_number": f"INS-{uuid.uuid4().hex[:10].upper()}",
                "group_number": f"GRP-{random.randint(1000, 9999)}"
            },
            "medical_history": {
                "diagnoses": random.sample(DIAGNOSES, num_diagnoses),
                "medications": random.sample(MEDICATIONS, num_meds),
                "allergies": random.sample(["Penicillin", "Sulfa", "Latex", "Aspirin", "None"], random.randint(1, 2)),
                "surgeries": random.randint(0, 3)
            },
            "current_visit": {
                "admission_date": admission.strftime("%Y-%m-%d %H:%M:%S"),
                "department": random.choice(DEPARTMENTS),
                "attending_physician": random.choice(DOCTORS),
                "status": random.choice(["Admitted", "Discharged", "Under Observation", "In Surgery"]),
                "room": f"{random.choice(['A', 'B', 'C', 'D'])}-{random.randint(100, 499)}",
                "priority": random.choice(["Low", "Medium", "High", "Critical"])
            },
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "version": "1.0",
                "data_classification": "PHI-SIMULATED"
            }
        }
        patients.append(patient)

        # Write individual patient file
        filepath = os.path.join(patients_dir, f"{patient_id}.json")
        with open(filepath, 'w') as f:
            json.dump(patient, f, indent=2)

    # Write summary file
    summary = {
        "total_patients": count,
        "generated_at": datetime.now().isoformat(),
        "departments": list(set(p["current_visit"]["department"] for p in patients)),
        "status_counts": {}
    }
    for p in patients:
        status = p["current_visit"]["status"]
        summary["status_counts"][status] = summary["status_counts"].get(status, 0) + 1

    with open(os.path.join(patients_dir, "patient_summary.json"), 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"  ✅ Generated {count} patient records")
    return patients


# ============================================
# Medical Image Simulator
# ============================================
def generate_medical_images(count=20):
    """Generate simulated medical image files (small binary placeholders)."""
    images_dir = os.path.join(OUTPUT_DIR, "medical-images")
    os.makedirs(images_dir, exist_ok=True)

    image_types = ["xray", "mri", "ct-scan", "ultrasound", "ecg"]
    body_parts = ["chest", "head", "abdomen", "spine", "knee", "shoulder", "hip"]

    for i in range(1, count + 1):
        img_type = random.choice(image_types)
        body_part = random.choice(body_parts)
        patient_id = f"PAT-{random.randint(1, 50):06d}"
        filename = f"{patient_id}_{img_type}_{body_part}_{i:03d}.dcm"

        # Create a simulated DICOM-like file (placeholder binary)
        filepath = os.path.join(images_dir, filename)
        header = {
            "patient_id": patient_id,
            "image_type": img_type,
            "body_part": body_part,
            "date": (datetime.now() - timedelta(days=random.randint(0, 90))).strftime("%Y-%m-%d"),
            "radiologist": random.choice(DOCTORS),
            "findings": random.choice([
                "Normal", "Abnormal - follow up required",
                "Inconclusive", "Critical finding"
            ])
        }
        with open(filepath, 'wb') as f:
            # Write JSON header + random binary data to simulate image
            header_bytes = json.dumps(header).encode()
            f.write(b"SIMULATED_DICOM_V1\n")
            f.write(header_bytes)
            f.write(b"\n---BINARY_DATA---\n")
            f.write(os.urandom(random.randint(10240, 51200)))  # 10-50KB

    print(f"  ✅ Generated {count} medical image files")


# ============================================
# Billing Records Generator
# ============================================
def generate_billing(count=20):
    """Generate CSV billing records."""
    billing_dir = os.path.join(OUTPUT_DIR, "billing")
    os.makedirs(billing_dir, exist_ok=True)

    procedures = [
        ("Blood Test", 150, 350),
        ("X-Ray", 200, 500),
        ("MRI Scan", 1000, 3000),
        ("CT Scan", 800, 2500),
        ("ECG", 100, 300),
        ("Ultrasound", 300, 800),
        ("Surgery - Minor", 2000, 8000),
        ("Surgery - Major", 10000, 50000),
        ("Physical Therapy", 100, 250),
        ("Consultation", 150, 400),
        ("Emergency Room Visit", 500, 3000),
        ("ICU Stay (per day)", 3000, 10000),
        ("Medication Administration", 50, 500),
        ("Lab Work - Comprehensive", 200, 600),
        ("Vaccination", 50, 200)
    ]

    # Generate monthly billing files
    for month_offset in range(3):
        month_date = datetime.now() - timedelta(days=30 * month_offset)
        filename = f"billing_{month_date.strftime('%Y_%m')}.csv"
        filepath = os.path.join(billing_dir, filename)

        with open(filepath, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "invoice_id", "patient_id", "date", "procedure",
                "amount", "insurance_covered", "patient_owes",
                "status", "department", "physician"
            ])

            records_per_month = count // 3 + (1 if month_offset == 0 else 0)
            for j in range(records_per_month):
                procedure, min_cost, max_cost = random.choice(procedures)
                amount = round(random.uniform(min_cost, max_cost), 2)
                insurance_pct = random.choice([0.6, 0.7, 0.8, 0.85, 0.9])
                insurance_covered = round(amount * insurance_pct, 2)
                patient_owes = round(amount - insurance_covered, 2)

                writer.writerow([
                    f"INV-{uuid.uuid4().hex[:8].upper()}",
                    f"PAT-{random.randint(1, 50):06d}",
                    (month_date - timedelta(days=random.randint(0, 29))).strftime("%Y-%m-%d"),
                    procedure,
                    amount,
                    insurance_covered,
                    patient_owes,
                    random.choice(["Paid", "Pending", "Overdue", "Insurance Processing"]),
                    random.choice(DEPARTMENTS),
                    random.choice(DOCTORS)
                ])

    print(f"  ✅ Generated {count} billing records across 3 monthly files")


# ============================================
# Application Log Generator
# ============================================
def generate_logs(count=10):
    """Generate application log files."""
    logs_dir = os.path.join(OUTPUT_DIR, "logs")
    os.makedirs(logs_dir, exist_ok=True)

    log_levels = ["INFO", "WARN", "ERROR", "DEBUG"]
    log_messages = {
        "INFO": [
            "Patient record accessed by {doctor}",
            "Backup completed successfully for {dept} department",
            "User login successful: {doctor}",
            "Report generated for patient {patient_id}",
            "System health check passed",
            "Database connection pool: {n}/50 active",
            "EFS mount verified: /mnt/efs/hospital-data",
            "S3 sync completed: {n} files uploaded",
        ],
        "WARN": [
            "High memory usage: {n}% on app server",
            "Slow query detected: {n}ms for patient lookup",
            "Certificate expiring in {n} days",
            "Disk usage at {n}% on /mnt/efs",
            "Rate limit approaching for API endpoint",
        ],
        "ERROR": [
            "Failed to connect to RDS: timeout after {n}ms",
            "Patient record not found: {patient_id}",
            "S3 upload failed: AccessDenied for billing/{patient_id}",
            "EFS mount point unreachable",
            "Database deadlock detected in transactions table",
        ],
        "DEBUG": [
            "Processing request: GET /api/patients/{patient_id}",
            "Cache hit for patient {patient_id}",
            "SQL query: SELECT * FROM patients WHERE id={patient_id}",
            "Response time: {n}ms for /api/billing",
        ]
    }

    for day_offset in range(count):
        log_date = datetime.now() - timedelta(days=day_offset)
        filename = f"app_{log_date.strftime('%Y%m%d')}.log"
        filepath = os.path.join(logs_dir, filename)

        with open(filepath, 'w') as f:
            # Generate 50-200 log entries per file
            num_entries = random.randint(50, 200)
            for _ in range(num_entries):
                level = random.choices(
                    log_levels,
                    weights=[60, 20, 10, 10],
                    k=1
                )[0]
                msg_template = random.choice(log_messages[level])
                msg = msg_template.format(
                    doctor=random.choice(DOCTORS),
                    dept=random.choice(DEPARTMENTS),
                    patient_id=f"PAT-{random.randint(1, 50):06d}",
                    n=random.randint(1, 99)
                )
                timestamp = log_date.replace(
                    hour=random.randint(0, 23),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59)
                )
                f.write(f"[{timestamp.strftime('%Y-%m-%d %H:%M:%S')}] [{level:5s}] {msg}\n")

    print(f"  ✅ Generated {count} log files")


# ============================================
# Configuration Files Generator
# ============================================
def generate_configs():
    """Generate YAML configuration files."""
    configs_dir = os.path.join(OUTPUT_DIR, "configs")
    os.makedirs(configs_dir, exist_ok=True)

    configs = {
        "app-config.json": {
            "application": {
                "name": "Healthcare Management System",
                "version": "3.2.1",
                "environment": "production",
                "port": 8080,
                "log_level": "INFO"
            },
            "database": {
                "host": "backup-lab-patient-db.xxxxx.us-east-1.rds.amazonaws.com",
                "port": 5432,
                "name": "healthcare",
                "pool_size": 50,
                "timeout_ms": 5000
            },
            "storage": {
                "efs_mount": "/mnt/efs/hospital-data",
                "s3_bucket": "backup-lab-healthcare-data",
                "max_upload_size_mb": 100
            },
            "security": {
                "session_timeout_min": 30,
                "max_login_attempts": 5,
                "encryption": "AES-256",
                "audit_logging": True
            }
        },
        "backup-policy.json": {
            "backup_policy": {
                "name": "Healthcare DR Policy",
                "version": "1.0",
                "rpo_hours": 4,
                "rto_hours": 2,
                "schedules": {
                    "daily": {"time": "02:00 UTC", "retention_days": 7},
                    "weekly": {"day": "Sunday", "time": "03:00 UTC", "retention_days": 30},
                    "monthly": {"day": 1, "time": "04:00 UTC", "retention_days": 365}
                },
                "resources": ["EC2", "RDS", "EFS", "S3"],
                "cross_region": {
                    "enabled": True,
                    "target_region": "us-west-2"
                },
                "encryption": {
                    "enabled": True,
                    "kms_key_alias": "alias/backup-lab-backup-key"
                },
                "compliance": {
                    "hipaa": True,
                    "audit_trail": True,
                    "immutable_backups": True
                }
            }
        },
        "monitoring-config.json": {
            "monitoring": {
                "cloudwatch": {
                    "enabled": True,
                    "namespace": "HealthcareApp",
                    "metrics_interval_sec": 60
                },
                "alarms": {
                    "cpu_threshold_pct": 80,
                    "memory_threshold_pct": 85,
                    "disk_threshold_pct": 90,
                    "rds_connections_max": 100,
                    "backup_failure_alert": True
                },
                "notifications": {
                    "sns_topic": "arn:aws:sns:us-east-1:ACCOUNT:healthcare-alerts",
                    "email": "ops-team@hospital-example.com"
                }
            }
        },
        "disaster-recovery.json": {
            "disaster_recovery": {
                "plan_name": "Healthcare DR Plan v2.0",
                "last_tested": "2025-12-15",
                "next_test": "2026-03-15",
                "scenarios": [
                    {
                        "name": "Data Deletion (Human Error)",
                        "severity": "Medium",
                        "recovery_method": "Restore from latest backup",
                        "estimated_rto_min": 30
                    },
                    {
                        "name": "Database Corruption",
                        "severity": "High",
                        "recovery_method": "Point-in-time recovery from RDS backup",
                        "estimated_rto_min": 45
                    },
                    {
                        "name": "Ransomware Attack",
                        "severity": "Critical",
                        "recovery_method": "Restore from air-gapped vault",
                        "estimated_rto_min": 120
                    },
                    {
                        "name": "Region Failure",
                        "severity": "Critical",
                        "recovery_method": "Restore from cross-region backup in us-west-2",
                        "estimated_rto_min": 180
                    }
                ],
                "contacts": {
                    "incident_commander": "CTO",
                    "backup_admin": "DevOps Lead",
                    "security_team": "CISO"
                }
            }
        },
        "network-config.json": {
            "network": {
                "vpc_cidr": "10.0.0.0/16",
                "subnets": {
                    "public": ["10.0.1.0/24", "10.0.2.0/24"],
                    "private": ["10.0.10.0/24", "10.0.20.0/24"]
                },
                "security_groups": {
                    "app_server": {
                        "inbound": [
                            {"port": 22, "protocol": "tcp", "source": "0.0.0.0/0"},
                            {"port": 80, "protocol": "tcp", "source": "0.0.0.0/0"},
                            {"port": 443, "protocol": "tcp", "source": "0.0.0.0/0"}
                        ]
                    },
                    "database": {
                        "inbound": [
                            {"port": 5432, "protocol": "tcp", "source": "app_server_sg"}
                        ]
                    },
                    "efs": {
                        "inbound": [
                            {"port": 2049, "protocol": "tcp", "source": "app_server_sg"}
                        ]
                    }
                }
            }
        }
    }

    for filename, content in configs.items():
        filepath = os.path.join(configs_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(content, f, indent=2)

    print(f"  ✅ Generated {len(configs)} configuration files")


# ============================================
# Main
# ============================================
def main():
    print("🏥 Healthcare Dataset Generator")
    print("=" * 50)
    print(f"Output directory: {OUTPUT_DIR}/")
    print()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Generating data...")
    generate_patients(50)
    generate_medical_images(20)
    generate_billing(20)
    generate_logs(10)
    generate_configs()

    # Count total files
    total_files = 0
    total_size = 0
    for root, dirs, files in os.walk(OUTPUT_DIR):
        for f in files:
            total_files += 1
            total_size += os.path.getsize(os.path.join(root, f))

    print()
    print("=" * 50)
    print(f"✅ Dataset generation complete!")
    print(f"   Total files: {total_files}")
    print(f"   Total size:  {total_size / 1024:.1f} KB")
    print()
    print("Directory structure:")
    for root, dirs, files in os.walk(OUTPUT_DIR):
        level = root.replace(OUTPUT_DIR, '').count(os.sep)
        indent = '  ' * level
        print(f"  {indent}{os.path.basename(root)}/  ({len(files)} files)")


if __name__ == "__main__":
    main()
