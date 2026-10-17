variable "aws_region" {
  description = "The primary AWS region for Compass Analytics infrastructure"
  type        = string
  default     = "af-south-1" # Cape Town (Africa Local Low-Latency)
}

variable "environment" {
  description = "Deployment environment (production, staging)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the Compass VPC"
  type        = string
  default     = "10.100.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones for multi-AZ high availability"
  type        = list(string)
  default     = ["af-south-1a", "af-south-1b", "af-south-1c"]
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance type"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "Maximum storage auto-scaling threshold in GB"
  type        = number
  default     = 1000
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.m6g.large"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters in the ElastiCache replication group"
  type        = number
  default     = 3
}

variable "eks_cluster_version" {
  description = "Kubernetes control plane version"
  type        = string
  default     = "1.30"
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS managed node group"
  type        = list(string)
  default     = ["t4g.xlarge", "m6g.xlarge"]
}

variable "eks_node_desired_capacity" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 3
}

variable "eks_node_min_capacity" {
  description = "Minimum number of worker nodes for auto-scaling"
  type        = number
  default     = 2
}

variable "eks_node_max_capacity" {
  description = "Maximum number of worker nodes for auto-scaling"
  type        = number
  default     = 10
}
