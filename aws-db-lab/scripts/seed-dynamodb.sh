#!/bin/bash
# Seed the DynamoDB products table with sample data
# Usage: ./seed-dynamodb.sh <table-name> <region>

TABLE_NAME="${1:-aws-db-lab-products}"
REGION="${2:-us-east-1}"

echo "=================================================="
echo "  TechShop - Seeding Product Catalog"
echo "  Table: $TABLE_NAME"
echo "=================================================="
echo ""

# Electronics
aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "ELEC-001"},
  "category": {"S": "electronics"},
  "name": {"S": "Wireless Bluetooth Headphones"},
  "price": {"N": "79.99"},
  "stock": {"N": "250"},
  "brand": {"S": "SoundMax"},
  "rating": {"N": "4.5"}
}' && echo "[OK] ELEC-001 - Wireless Bluetooth Headphones"

aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "ELEC-002"},
  "category": {"S": "electronics"},
  "name": {"S": "USB-C Fast Charger 65W"},
  "price": {"N": "34.99"},
  "stock": {"N": "500"},
  "brand": {"S": "PowerUp"},
  "rating": {"N": "4.8"}
}' && echo "[OK] ELEC-002 - USB-C Fast Charger 65W"

aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "ELEC-003"},
  "category": {"S": "electronics"},
  "name": {"S": "4K Webcam Pro"},
  "price": {"N": "129.99"},
  "stock": {"N": "80"},
  "brand": {"S": "VisionTech"},
  "rating": {"N": "4.3"}
}' && echo "[OK] ELEC-003 - 4K Webcam Pro"

# Clothing
aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "CLOTH-001"},
  "category": {"S": "clothing"},
  "name": {"S": "Cloud Developer T-Shirt"},
  "price": {"N": "29.99"},
  "stock": {"N": "1000"},
  "brand": {"S": "DevWear"},
  "rating": {"N": "4.7"}
}' && echo "[OK] CLOTH-001 - Cloud Developer T-Shirt"

aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "CLOTH-002"},
  "category": {"S": "clothing"},
  "name": {"S": "AWS Hoodie"},
  "price": {"N": "59.99"},
  "stock": {"N": "300"},
  "brand": {"S": "CloudGear"},
  "rating": {"N": "4.9"}
}' && echo "[OK] CLOTH-002 - AWS Hoodie"

aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "CLOTH-003"},
  "category": {"S": "clothing"},
  "name": {"S": "Terraform Socks (3-pack)"},
  "price": {"N": "14.99"},
  "stock": {"N": "2000"},
  "brand": {"S": "DevWear"},
  "rating": {"N": "4.2"}
}' && echo "[OK] CLOTH-003 - Terraform Socks"

# Books
aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "BOOK-001"},
  "category": {"S": "books"},
  "name": {"S": "AWS Solutions Architect Guide"},
  "price": {"N": "49.99"},
  "stock": {"N": "150"},
  "brand": {"S": "TechPress"},
  "rating": {"N": "4.6"}
}' && echo "[OK] BOOK-001 - AWS Solutions Architect Guide"

aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "BOOK-002"},
  "category": {"S": "books"},
  "name": {"S": "Docker & Kubernetes Handbook"},
  "price": {"N": "39.99"},
  "stock": {"N": "200"},
  "brand": {"S": "TechPress"},
  "rating": {"N": "4.4"}
}' && echo "[OK] BOOK-002 - Docker & Kubernetes Handbook"

# Accessories
aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "ACC-001"},
  "category": {"S": "accessories"},
  "name": {"S": "Mechanical Keyboard RGB"},
  "price": {"N": "89.99"},
  "stock": {"N": "120"},
  "brand": {"S": "KeyMaster"},
  "rating": {"N": "4.7"}
}' && echo "[OK] ACC-001 - Mechanical Keyboard RGB"

aws dynamodb put-item --table-name "$TABLE_NAME" --region "$REGION" --item '{
  "product_id": {"S": "ACC-002"},
  "category": {"S": "accessories"},
  "name": {"S": "Ergonomic Mouse Pad XL"},
  "price": {"N": "24.99"},
  "stock": {"N": "800"},
  "brand": {"S": "ComfortZone"},
  "rating": {"N": "4.1"}
}' && echo "[OK] ACC-002 - Ergonomic Mouse Pad XL"

echo ""
echo "=================================================="
echo "  Done! $TABLE_NAME seeded with 10 products"
echo "  Categories: electronics, clothing, books, accessories"
echo "=================================================="
