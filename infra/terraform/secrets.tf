resource "random_id" "daraja_key" {
  byte_length = 32
}

resource "aws_secretsmanager_secret" "app" {
  name        = "compass-${var.environment}-app-secrets"
  description = "Centralized credentials and encryption keys for Compass Analytics"
  kms_key_id  = aws_kms_key.compass.arn

  tags = {
    Name = "compass-${var.environment}-app-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL          = "postgresql://${aws_db_instance.postgres.username}:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}?sslmode=require"
    DIRECT_URL            = "postgresql://${aws_db_instance.postgres.username}:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}?sslmode=require"
    REDIS_URL             = "rediss://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
    DARAJA_ENCRYPTION_KEY = random_id.daraja_key.hex
  })
}

# IAM Policy to allow Pods via IRSA to read application secrets and decrypt via KMS
resource "aws_iam_policy" "secrets_reader" {
  name        = "compass-${var.environment}-secrets-reader"
  description = "Allows Compass workloads to read application secrets and decrypt via KMS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.app.arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.compass.arn
      }
    ]
  })
}

# IRSA IAM Role for Kubernetes Pod Service Accounts (e.g. in namespace 'compass')
resource "aws_iam_role" "app_workload" {
  name = "compass-${var.environment}-workload-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = [
              "system:serviceaccount:compass:compass-web",
              "system:serviceaccount:compass:compass-ingest"
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name = "compass-${var.environment}-workload-irsa"
  }
}

resource "aws_iam_role_policy_attachment" "app_workload_secrets" {
  role       = aws_iam_role.app_workload.name
  policy_arn = aws_iam_policy.secrets_reader.policy_arn
}
