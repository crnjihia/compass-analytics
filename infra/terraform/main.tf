terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Production S3 backend with DynamoDB state locking
  backend "s3" {
    bucket         = "compass-analytics-tf-state"
    key            = "production/terraform.tfstate"
    region         = "af-south-1"
    dynamodb_table = "compass-analytics-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CompassAnalytics"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "PlatformEngineering"
    }
  }
}
