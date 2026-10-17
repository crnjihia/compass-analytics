resource "aws_elasticache_subnet_group" "redis" {
  name       = "compass-${var.environment}-redis-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = {
    Name = "compass-${var.environment}-redis-subnet-group"
  }
}

resource "aws_security_group" "redis" {
  name        = "compass-${var.environment}-redis-sg"
  description = "Security group for Compass Analytics ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow Redis access strictly from EKS worker nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    description = "Allow outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "compass-${var.environment}-redis-sg"
  }
}

resource "aws_elasticache_parameter_group" "redis7" {
  name   = "compass-${var.environment}-redis7-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name = "compass-${var.environment}-redis7-params"
  }
}

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "compass-${var.environment}-redis"
  description                = "ElastiCache Redis replication group for Compass caching and stream ingestion"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_clusters
  parameter_group_name       = aws_elasticache_parameter_group.redis7.name
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]

  automatic_failover_enabled = true
  multi_az_enabled           = true
  engine                     = "redis"
  engine_version             = "7.1"

  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.compass.arn
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  snapshot_retention_limit   = 7
  snapshot_window            = "02:00-03:00"
  maintenance_window         = "sun:04:00-sun:05:00"
  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = {
    Name = "compass-${var.environment}-redis"
  }
}
