output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (used for ingress ALBs)"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (used for EKS nodes)"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "IDs of the isolated database subnets (used for RDS and ElastiCache)"
  value       = aws_subnet.database[*].id
}

output "kms_key_arn" {
  description = "ARN of the customer managed KMS key"
  value       = aws_kms_key.compass.arn
}

output "rds_endpoint" {
  description = "Connection endpoint for the RDS PostgreSQL database"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_database_name" {
  description = "Database name"
  value       = aws_db_instance.postgres.db_name
}

output "redis_primary_endpoint" {
  description = "Primary endpoint address for ElastiCache Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Reader endpoint address for ElastiCache Redis"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port for ElastiCache Redis"
  value       = aws_elasticache_replication_group.redis.port
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane API"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_version" {
  description = "Kubernetes version running on EKS"
  value       = aws_eks_cluster.main.version
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "eks_oidc_provider_arn" {
  description = "ARN of the OIDC provider for IRSA"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "app_workload_irsa_role_arn" {
  description = "IAM Role ARN to annotate Kubernetes ServiceAccounts for IRSA"
  value       = aws_iam_role.app_workload.arn
}

output "secrets_manager_app_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret containing app credentials"
  value       = aws_secretsmanager_secret.app.arn
}
