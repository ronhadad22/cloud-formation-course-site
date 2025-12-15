resource "aws_db_subnet_group" "main" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.identifier}-subnet-group"
    }
  )
}

resource "aws_security_group" "database" {
  name        = "${var.identifier}-sg"
  description = "Security group for ${var.identifier} database"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "Database access from allowed CIDR blocks"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.identifier}-sg"
    }
  )
}

resource "random_password" "master" {
  length  = 16
  special = true
}

resource "aws_db_instance" "main" {
  identifier     = var.identifier
  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_encrypted     = var.storage_encrypted

  db_name  = var.database_name
  username = var.master_username
  password = random_password.master.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]

  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.identifier}-final-snapshot"

  tags = merge(
    var.tags,
    {
      Name = var.identifier
    }
  )
}
