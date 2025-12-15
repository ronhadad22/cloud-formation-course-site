# Lesson 02: Terraform Features

## 🎯 Learning Goals

- Master count and for_each meta-arguments
- Use dynamic blocks for complex configurations
- Understand locals and how they differ from variables
- Apply conditional expressions and ternary operators
- Use Terraform built-in functions
- Implement lifecycle rules
- Work with provisioners (and when to avoid them)

## 📖 Advanced Terraform Features

This lesson covers powerful Terraform features that enable:
- Creating multiple similar resources efficiently
- Building flexible, reusable configurations
- Handling complex logic and transformations
- Managing resource lifecycles precisely

## 🏗️ Project Structure

```
02-terraform-features/
├── README.md
├── 01-count/
│   └── main.tf              # Using count meta-argument
├── 02-for-each/
│   └── main.tf              # Using for_each
├── 03-dynamic-blocks/
│   └── main.tf              # Dynamic nested blocks
├── 04-functions/
│   └── main.tf              # Built-in functions
├── 05-conditionals/
│   └── main.tf              # Conditional expressions
├── 06-lifecycle/
│   └── main.tf              # Lifecycle rules
└── 07-locals/
    └── main.tf              # Local values
```

## 📝 Exercise 1: Count Meta-Argument

The `count` meta-argument creates multiple instances of a resource.

### Basic Count

```hcl
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  tags = {
    Name = "web-server-${count.index}"
  }
}
```

### Conditional Count

```hcl
resource "aws_instance" "web" {
  count         = var.create_instance ? 1 : 0
  ami           = "ami-12345678"
  instance_type = "t2.micro"
}
```

### Referencing Count Resources

```hcl
# Reference all instances
output "all_instance_ids" {
  value = aws_instance.web[*].id
}

# Reference specific instance
output "first_instance_id" {
  value = aws_instance.web[0].id
}
```

### Try It

```bash
cd 01-count
terraform init
terraform plan
terraform apply
```

## 📝 Exercise 2: For_Each Meta-Argument

`for_each` is more flexible than `count` - it uses a map or set.

### For_Each with Set

```hcl
variable "user_names" {
  type    = set(string)
  default = ["alice", "bob", "charlie"]
}

resource "aws_iam_user" "users" {
  for_each = var.user_names
  name     = each.value
}
```

### For_Each with Map

```hcl
variable "instances" {
  type = map(object({
    instance_type = string
    ami           = string
  }))
  default = {
    web = {
      instance_type = "t2.micro"
      ami           = "ami-12345678"
    }
    db = {
      instance_type = "t2.small"
      ami           = "ami-87654321"
    }
  }
}

resource "aws_instance" "servers" {
  for_each      = var.instances
  instance_type = each.value.instance_type
  ami           = each.value.ami
  
  tags = {
    Name = each.key
  }
}
```

### Count vs For_Each

**Use count when:**
- Creating identical resources
- Number of resources is a simple integer
- Order matters

**Use for_each when:**
- Each resource has unique configuration
- Resources are identified by name/key
- Adding/removing items shouldn't affect others

### Try It

```bash
cd ../02-for-each
terraform init
terraform plan
terraform apply
```

## 📝 Exercise 3: Dynamic Blocks

Dynamic blocks generate nested configuration blocks.

### Without Dynamic Block (Repetitive)

```hcl
resource "aws_security_group" "example" {
  name = "example"
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
}
```

### With Dynamic Block (DRY)

```hcl
variable "ingress_rules" {
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = [
    {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP"
    },
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS"
    },
    {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/8"]
      description = "SSH"
    }
  ]
}

resource "aws_security_group" "example" {
  name = "example"
  
  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }
}
```

### Try It

```bash
cd ../03-dynamic-blocks
terraform init
terraform plan
```

## 📝 Exercise 4: Terraform Functions

Terraform has 100+ built-in functions for transformations.

### String Functions

```hcl
# upper, lower, title
upper("hello")           # "HELLO"
lower("WORLD")           # "world"
title("hello world")     # "Hello World"

# format, join, split
format("web-%03d", 5)    # "web-005"
join("-", ["a", "b"])    # "a-b"
split("-", "a-b-c")      # ["a", "b", "c"]

# replace, regex
replace("hello", "l", "L")  # "heLLo"
```

### Collection Functions

```hcl
# length
length([1, 2, 3])        # 3

# concat
concat([1, 2], [3, 4])   # [1, 2, 3, 4]

# merge
merge({a = 1}, {b = 2})  # {a = 1, b = 2}

# lookup
lookup({a = 1, b = 2}, "a", 0)  # 1

# contains
contains(["a", "b"], "a")  # true
```

### Numeric Functions

```hcl
# min, max
min(1, 2, 3)             # 1
max(1, 2, 3)             # 3

# ceil, floor
ceil(1.3)                # 2
floor(1.7)               # 1
```

### Date/Time Functions

```hcl
timestamp()              # "2024-01-15T10:30:00Z"
formatdate("YYYY-MM-DD", timestamp())
```

### IP Network Functions

```hcl
cidrsubnet("10.0.0.0/16", 8, 1)  # "10.0.1.0/24"
cidrhost("10.0.0.0/24", 5)       # "10.0.0.5"
```

### Try It

```bash
cd ../04-functions
terraform console

# Try functions interactively
> upper("hello")
> length([1, 2, 3])
> cidrsubnet("10.0.0.0/16", 8, 1)
```

## 📝 Exercise 5: Conditional Expressions

Terraform supports ternary operators for conditional logic.

### Basic Conditional

```hcl
variable "environment" {
  default = "dev"
}

resource "aws_instance" "web" {
  instance_type = var.environment == "prod" ? "t2.large" : "t2.micro"
  
  tags = {
    Name = var.environment == "prod" ? "production-server" : "dev-server"
  }
}
```

### Nested Conditionals

```hcl
locals {
  instance_type = (
    var.environment == "prod" ? "t2.large" :
    var.environment == "staging" ? "t2.medium" :
    "t2.micro"
  )
}
```

### Conditional Resource Creation

```hcl
resource "aws_instance" "web" {
  count = var.create_instance ? 1 : 0
  # ...
}
```

### Try It

```bash
cd ../05-conditionals
terraform init
terraform plan -var="environment=prod"
terraform plan -var="environment=dev"
```

## 📝 Exercise 6: Lifecycle Rules

Lifecycle rules control how Terraform manages resources.

### Create Before Destroy

```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  lifecycle {
    create_before_destroy = true
  }
}
```

### Prevent Destroy

```hcl
resource "aws_s3_bucket" "important_data" {
  bucket = "critical-data"
  
  lifecycle {
    prevent_destroy = true
  }
}
```

### Ignore Changes

```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  lifecycle {
    ignore_changes = [
      tags,
      user_data
    ]
  }
}
```

### Replace Triggered By

```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  lifecycle {
    replace_triggered_by = [
      aws_security_group.web.id
    ]
  }
}
```

### Try It

```bash
cd ../06-lifecycle
terraform init
terraform apply
# Try modifying and see lifecycle behavior
```

## 📝 Exercise 7: Locals

Locals define computed values that can be reused.

### Locals vs Variables

**Variables**: Input from outside
**Locals**: Computed within configuration

### Using Locals

```hcl
locals {
  common_tags = {
    ManagedBy   = "Terraform"
    Environment = var.environment
    Project     = var.project_name
  }
  
  name_prefix = "${var.project_name}-${var.environment}"
  
  instance_type = var.environment == "prod" ? "t2.large" : "t2.micro"
  
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
}

resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = local.instance_type
  
  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-web"
    }
  )
}
```

### Complex Locals

```hcl
locals {
  # Flatten nested structures
  subnets = flatten([
    for az_index, az in local.availability_zones : [
      for subnet_type in ["public", "private"] : {
        name = "${subnet_type}-${az}"
        cidr = cidrsubnet(var.vpc_cidr, 8, az_index * 2 + (subnet_type == "private" ? 1 : 0))
        az   = az
        type = subnet_type
      }
    ]
  ])
}
```

### Try It

```bash
cd ../07-locals
terraform init
terraform plan
```

## 💡 Best Practices

### 1. Prefer for_each Over count

```hcl
# Good - stable references
resource "aws_iam_user" "users" {
  for_each = toset(["alice", "bob", "charlie"])
  name     = each.value
}

# Avoid - removing middle item affects others
resource "aws_iam_user" "users" {
  count = length(var.user_names)
  name  = var.user_names[count.index]
}
```

### 2. Use Locals for Complex Logic

```hcl
locals {
  # Complex computation done once
  subnet_config = {
    for subnet in var.subnets :
    subnet.name => {
      cidr_block        = subnet.cidr
      availability_zone = subnet.az
      tags = merge(var.common_tags, subnet.tags)
    }
  }
}
```

### 3. Keep Dynamic Blocks Simple

```hcl
# Good - clear and maintainable
dynamic "ingress" {
  for_each = var.ingress_rules
  content {
    from_port   = ingress.value.from_port
    to_port     = ingress.value.to_port
    protocol    = ingress.value.protocol
    cidr_blocks = ingress.value.cidr_blocks
  }
}
```

### 4. Use Lifecycle Rules Carefully

```hcl
# Only when necessary
lifecycle {
  create_before_destroy = true  # For zero-downtime updates
  prevent_destroy       = true  # For critical resources
  ignore_changes        = [tags] # For externally managed attributes
}
```

## ✅ Checklist

- [ ] Understand when to use count vs for_each
- [ ] Create resources with for_each
- [ ] Use dynamic blocks for nested configuration
- [ ] Apply Terraform functions for transformations
- [ ] Implement conditional logic
- [ ] Use lifecycle rules appropriately
- [ ] Leverage locals for computed values

## 🎓 Quiz

1. When should you use for_each instead of count?
2. What's the difference between locals and variables?
3. How do you reference a resource created with for_each?
4. What does `create_before_destroy` do?
5. Name three string functions in Terraform
6. How do you conditionally create a resource?

## ➡️ Next Steps

Move on to `03-advanced-deployments` to learn about:
- Module development
- Workspaces
- Remote state
- Import existing infrastructure
- Multi-cloud patterns
