# ═══════════════════════════════════════════════════════════════════
# TERRAFORM VARIABLES
# ═══════════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-west-2"
}

variable "aws_account_id" {
  description = "AWS Account ID (InsecureCorsair)"
  type        = string
  default     = "957654404683"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_ec2" {
  description = "Deploy EC2 instance (uses free tier hours)"
  type        = bool
  default     = true
}

variable "enable_rds" {
  description = "Deploy RDS instance (uses free tier hours - WARNING: takes 5-10min to create)"
  type        = bool
  default     = false  # Disabled by default due to long creation time
}

variable "enable_lambda" {
  description = "Deploy Lambda functions"
  type        = bool
  default     = true
}

variable "enable_api_gateway" {
  description = "Deploy API Gateway"
  type        = bool
  default     = true
}
