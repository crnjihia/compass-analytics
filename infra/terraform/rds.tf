resource "aws_db_subnet_group" "rds" {
  name       = "compass-${var.environment}-rds-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = {
    Name = "compass-${var.environment}-rds-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name        = "compass-${var.environment}-rds-sg"
  description = "Security group for Compass Analytics RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow PostgreSQL access strictly from EKS worker nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "compass-${var.environment}-rds-sg"
  }
}

resource "aws_db_parameter_group" "pg16" {
  name   = "compass-${var.environment}-pg16-params"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "250" # Log slow queries > 250ms
  }

  tags = {
    Name = "compass-${var.environment}-pg16-params"
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier             = "compass-${var.environment}-postgres"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = var.db_max_allocated_storage
  storage_type           = "gp3"
  storage_encrypted      = true
  kms_key_id             = aws_kms_key.compass.arn

  db_name  = "compass_analytics"
  username = "compass_admin"
  password = random_password.db_password.result

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  backup_retention_period   = 30
  backup_window             = "01:00-02:00"
  maintenance_window        = "Sun:03:00-Sun:04:00"
  auto_minor_version_upgrade = true
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = "compass-${var.environment}-postgres-final-snapshot"

  tags = {
    Name = "compass-${var.environment}-postgres"
  }
}
