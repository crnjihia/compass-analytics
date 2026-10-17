resource "aws_kms_key" "compass" {
  description             = "Customer managed KMS key for Compass Analytics data encryption at rest"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "compass-${var.environment}-kms-key"
  }
}

resource "aws_kms_alias" "compass" {
  name          = "alias/compass-${var.environment}"
  target_key_id = aws_kms_key.compass.key_id
}
