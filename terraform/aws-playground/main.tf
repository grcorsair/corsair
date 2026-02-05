# ⚠️  INTENTIONALLY INSECURE AWS MULTI-SERVICE PLAYGROUND ⚠️
#
# This Terraform configuration creates an intentionally vulnerable AWS environment
# spanning multiple services for comprehensive Corsair security testing.
#
# 🚨 DO NOT USE IN PRODUCTION 🚨
# Account: InsecureCorsair (957654404683)
#
# Services Deployed:
# - Storage: S3 (public buckets, no encryption)
# - Compute: EC2 (open security groups), Lambda (over-permissioned)
# - Database: RDS (publicly accessible), DynamoDB (no encryption)
# - Security: IAM (overpermissive), Cognito (weak MFA/passwords)
# - Networking: VPC (open security groups, no NACLs)
# - API: API Gateway (no authentication)
#
# Cost: FREE TIER (750 EC2 hrs, 5GB S3, 750 RDS hrs, etc.)
# Note: Bedrock EXCLUDED (no free tier, cost risk)

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  # Target the InsecureCorsair account
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      ManagedBy    = "Terraform"
      Environment  = "corsair-testing"
      Purpose      = "security-testing"
      Security     = "INTENTIONALLY-INSECURE"
      Project      = "Corsair-GRC-Playground"
      Account      = "InsecureCorsair"
      DestroyAfter = "testing-complete"
    }
  }
}

# Random suffix for globally unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "corsair-${random_id.suffix.hex}"
  common_tags = {
    Playground       = "InsecureCorsair"
    VulnerabilityTest = "Enabled"
  }
}

# ═══════════════════════════════════════════════════════════════════
# MODULE: STORAGE (S3, EBS)
# ═══════════════════════════════════════════════════════════════════

module "storage" {
  source = "./modules/storage"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

# ═══════════════════════════════════════════════════════════════════
# MODULE: NETWORKING (VPC, Security Groups)
# ═══════════════════════════════════════════════════════════════════

module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  tags        = local.common_tags
}

# ═══════════════════════════════════════════════════════════════════
# MODULE: COMPUTE (EC2, Lambda)
# ═══════════════════════════════════════════════════════════════════

module "compute" {
  source = "./modules/compute"

  name_prefix       = local.name_prefix
  vpc_id            = module.networking.vpc_id
  public_subnet_id  = module.networking.public_subnet_id
  open_security_group_id = module.networking.open_security_group_id
  tags              = local.common_tags

  depends_on = [module.networking]
}

# ═══════════════════════════════════════════════════════════════════
# MODULE: DATABASE (RDS, DynamoDB)
# ═══════════════════════════════════════════════════════════════════

module "database" {
  source = "./modules/database"

  name_prefix       = local.name_prefix
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  open_security_group_id = module.networking.open_security_group_id
  tags              = local.common_tags

  depends_on = [module.networking]
}

# ═══════════════════════════════════════════════════════════════════
# MODULE: SECURITY (IAM, Cognito, Secrets Manager)
# ═══════════════════════════════════════════════════════════════════

module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

# ═══════════════════════════════════════════════════════════════════
# MODULE: API (API Gateway)
# ═══════════════════════════════════════════════════════════════════

module "api" {
  source = "./modules/api"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}
