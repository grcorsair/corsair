# ═══════════════════════════════════════════════════════════════════
# TERRAFORM OUTPUTS - CORSAIR MULTI-SERVICE PLAYGROUND
# ═══════════════════════════════════════════════════════════════════

# Account Info
output "aws_account_id" {
  value = var.aws_account_id
}

output "aws_region" {
  value = var.aws_region
}

# Storage Outputs
output "storage" {
  value = {
    public_bucket        = module.storage.public_bucket_name
    unencrypted_bucket   = module.storage.unencrypted_bucket_name
    test_file_url        = module.storage.test_file_url
    vulnerabilities      = module.storage.vulnerabilities
  }
}

# Networking Outputs
output "networking" {
  value = {
    vpc_id               = module.networking.vpc_id
    open_sg_id           = module.networking.open_security_group_id
    ssh_sg_id            = module.networking.ssh_security_group_id
    vulnerabilities      = module.networking.vulnerabilities
  }
}

# Compute Outputs
output "compute" {
  value = {
    ec2_instance_id      = module.compute.ec2_instance_id
    ec2_public_ip        = module.compute.ec2_public_ip
    vulnerabilities      = module.compute.vulnerabilities
  }
}

# Database Outputs
output "database" {
  value = {
    dynamodb_table       = module.database.dynamodb_table_name
    vulnerabilities      = module.database.vulnerabilities
  }
}

# Security Outputs
output "security" {
  value = {
    cognito_user_pool_id = module.security.cognito_user_pool_id
    iam_role_arn         = module.security.overpermissive_role_arn
    iam_user             = module.security.admin_user_name
    secret_arn           = module.security.secret_arn
    vulnerabilities      = module.security.vulnerabilities
  }
  sensitive = true
}

# API Outputs
output "api" {
  value = {
    api_endpoint         = module.api.api_endpoint
    vulnerabilities      = module.api.vulnerabilities
  }
}

# ═══════════════════════════════════════════════════════════════════
# CORSAIR TESTING TARGETS
# ═══════════════════════════════════════════════════════════════════

output "corsair_targets" {
  description = "All Corsair testable resources with attack vectors"
  value = {
    s3_buckets = {
      public = {
        name = module.storage.public_bucket_name
        attack_vectors = ["data-exposure", "public-read"]
        test_url = module.storage.test_file_url
      }
      unencrypted = {
        name = module.storage.unencrypted_bucket_name
        attack_vectors = ["data-at-rest-exposure"]
      }
    }
    cognito = {
      user_pool_id = module.security.cognito_user_pool_id
      attack_vectors = ["mfa-bypass", "password-spray", "session-hijack"]
    }
    ec2_instances = {
      insecure = {
        id = module.compute.ec2_instance_id
        public_ip = module.compute.ec2_public_ip
        attack_vectors = ["imdsv1-exploit", "network-exposure"]
      }
    }
    api_gateways = {
      unauthenticated = {
        endpoint = module.api.api_endpoint
        attack_vectors = ["no-auth-bypass", "cors-misconfiguration"]
      }
    }
    iam_resources = {
      overpermissive_role = module.security.overpermissive_role_arn
      admin_user = module.security.admin_user_name
      attack_vectors = ["privilege-escalation", "credential-access"]
    }
    databases = {
      dynamodb = {
        table = module.database.dynamodb_table_name
        attack_vectors = ["data-exposure", "no-encryption"]
      }
    }
  }
}

# ═══════════════════════════════════════════════════════════════════
# VULNERABILITY SUMMARY
# ═══════════════════════════════════════════════════════════════════

output "vulnerability_summary" {
  description = "Total vulnerability count by severity"
  value = {
    CRITICAL = "11+ vulnerabilities"
    HIGH     = "5+ vulnerabilities"
    MEDIUM   = "6+ vulnerabilities"
    TOTAL    = "22+ intentional misconfigurations"

    details = {
      storage    = "4 vulnerabilities (1 CRITICAL, 1 HIGH, 2 MEDIUM)"
      networking = "5 vulnerabilities (3 CRITICAL, 1 MEDIUM)"
      security   = "6 vulnerabilities (3 CRITICAL, 3 HIGH)"
      compute    = "1 vulnerability (1 HIGH)"
      database   = "1 vulnerability (1 MEDIUM)"
      api        = "1 vulnerability (1 CRITICAL)"
    }
  }
}

# ═══════════════════════════════════════════════════════════════════
# QUICK REFERENCE
# ═══════════════════════════════════════════════════════════════════

output "quick_start" {
  value = <<-EOT

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🏴‍☠️ CORSAIR MULTI-SERVICE PLAYGROUND DEPLOYED
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Account: InsecureCorsair (${var.aws_account_id})
    Region:  ${var.aws_region}

    Services Deployed:
      ✓ S3 Buckets (2): Public + Unencrypted
      ✓ EC2 Instance: t2.micro with IMDSv1
      ✓ Cognito: User Pool with MFA disabled
      ✓ IAM: Overpermissive roles + Admin user
      ✓ DynamoDB: Unencrypted table
      ✓ API Gateway: No authentication
      ✓ VPC: Open security groups

    Total Vulnerabilities: 22+
      • CRITICAL: 11+  (S3 public, wide-open SG, MFA off, IAM admin, API no-auth)
      • HIGH: 5+       (S3 unencrypted, IMDSv1, IAM keys, weak passwords)
      • MEDIUM: 6+     (No logging, no encryption, no flow logs)

    Test Public S3 Access:
      ${module.storage.test_file_url}

    Next Steps:
      1. Update Corsair to support multi-service testing
      2. Create plugins for each service (S3, EC2, IAM, etc.)
      3. Run autonomous agent missions per service
      4. Validate detection across all 22+ vulnerabilities

    Cost: FREE TIER ($0.00/month for testing workloads)

    Destroy: terraform destroy -auto-approve

    ⚠️  INTENTIONALLY INSECURE - For Testing Only
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EOT
}
