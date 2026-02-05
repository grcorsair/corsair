# ═══════════════════════════════════════════════════════════════════
# SECURITY MODULE: IAM + Cognito + Secrets Manager
# Intentional Vulnerabilities: Overpermissive policies, weak MFA, exposed secrets
# ═══════════════════════════════════════════════════════════════════

variable "name_prefix" {
  type = string
}

variable "tags" {
  type = map(string)
}

# 🔴 VULNERABILITY 1: OVERPERMISSIVE IAM ROLE (CRITICAL)
# MITRE: T1078.004 (Valid Accounts: Cloud Accounts)
# NIST: PR.AC-4 (Access permissions managed)
# SOC2: CC6.2 (Logical access - authorization)

resource "aws_iam_role" "overpermissive_role" {
  name = "${var.name_prefix}-overpermissive-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = ["ec2.amazonaws.com", "lambda.amazonaws.com"]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-overpermissive-role"
    Vulnerability = "CRITICAL-overpermissive-iam"
    AttackVector  = "privilege-escalation"
  })
}

resource "aws_iam_role_policy" "overpermissive_policy" {
  name = "${var.name_prefix}-overpermissive-policy"
  role = aws_iam_role.overpermissive_role.id

  # 🔴 INTENTIONALLY GRANTS ADMIN ACCESS
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "*"           # ALL actions
        Resource = "*"           # ALL resources
      }
    ]
  })
}

# 🔴 VULNERABILITY 2: IAM USER WITH INLINE ADMIN POLICY (CRITICAL)
# MITRE: T1078.004
# NIST: PR.AC-4
# SOC2: CC6.1

resource "aws_iam_user" "admin_user" {
  name = "${var.name_prefix}-admin-user"

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-admin-user"
    Vulnerability = "CRITICAL-admin-user"
    AttackVector  = "credential-access"
  })
}

resource "aws_iam_user_policy" "admin_policy" {
  name = "AdminAccess"
  user = aws_iam_user.admin_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "*"
        Resource = "*"
      }
    ]
  })
}

# 🔴 VULNERABILITY 3: ACCESS KEYS FOR IAM USER (HIGH)
# MITRE: T1078.004
# NIST: IA-5 (Authenticator management)
# SOC2: CC6.1

resource "aws_iam_access_key" "admin_key" {
  user = aws_iam_user.admin_user.name
}

# 🔴 VULNERABILITY 4: COGNITO USER POOL - MFA DISABLED (CRITICAL)
# (Same as original Cognito-only deployment)
# MITRE: T1556.006
# NIST: PR.AC-7
# SOC2: CC6.1

resource "aws_cognito_user_pool" "insecure_pool" {
  name = "${var.name_prefix}-userpool"

  mfa_configuration = "OFF"  # Should be "ON"

  password_policy {
    minimum_length    = 8      # Should be 12+
    require_lowercase = false
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  auto_verified_attributes = ["email"]

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  username_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-cognito-userpool"
    Vulnerability = "CRITICAL-mfa-disabled"
    AttackVector  = "authentication-bypass"
  })
}

resource "aws_cognito_user_pool_client" "insecure_client" {
  name         = "${var.name_prefix}-userpool-client"
  user_pool_id = aws_cognito_user_pool.insecure_pool.id

  generate_secret            = false
  refresh_token_validity     = 30
  access_token_validity      = 60
  id_token_validity          = 60

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# 🔴 VULNERABILITY 5: SECRETS IN PLAIN TEXT (HIGH)
# MITRE: T1552.001 (Unsecured Credentials: Credentials In Files)
# NIST: IA-5
# SOC2: CC6.1

resource "aws_secretsmanager_secret" "unrotated_secret" {
  name                    = "${var.name_prefix}-unrotated-secret"
  recovery_window_in_days = 0  # Immediate deletion (testing)

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-unrotated-secret"
    Vulnerability = "HIGH-no-rotation"
    AttackVector  = "credential-exposure"
  })
}

resource "aws_secretsmanager_secret_version" "unrotated_secret_value" {
  secret_id = aws_secretsmanager_secret.unrotated_secret.id
  secret_string = jsonencode({
    username = "admin"
    password = "insecure-password-123"  # Weak password in secret
  })
}

# Intentionally NO rotation configuration

# ═══════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════

output "overpermissive_role_arn" {
  value = aws_iam_role.overpermissive_role.arn
}

output "admin_user_name" {
  value = aws_iam_user.admin_user.name
}

output "admin_access_key_id" {
  value     = aws_iam_access_key.admin_key.id
  sensitive = true
}

output "admin_secret_access_key" {
  value     = aws_iam_access_key.admin_key.secret
  sensitive = true
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.insecure_pool.id
}

output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.insecure_pool.arn
}

output "secret_arn" {
  value = aws_secretsmanager_secret.unrotated_secret.arn
}

output "vulnerabilities" {
  value = {
    CRITICAL = [
      {
        id          = "iam-overpermissive-role"
        resource    = aws_iam_role.overpermissive_role.name
        description = "IAM role has * permissions on all resources"
        mitre       = "T1078.004"
        nist        = "PR.AC-4"
        soc2        = "CC6.2"
      },
      {
        id          = "iam-admin-user"
        resource    = aws_iam_user.admin_user.name
        description = "IAM user with inline admin policy"
        mitre       = "T1078.004"
        nist        = "PR.AC-4"
        soc2        = "CC6.1"
      },
      {
        id          = "cognito-mfa-disabled"
        resource    = aws_cognito_user_pool.insecure_pool.id
        description = "Cognito User Pool has MFA disabled"
        mitre       = "T1556.006"
        nist        = "PR.AC-7"
        soc2        = "CC6.1"
      }
    ]
    HIGH = [
      {
        id          = "iam-access-keys"
        resource    = aws_iam_user.admin_user.name
        description = "IAM user has programmatic access keys"
        mitre       = "T1078.004"
        nist        = "IA-5"
        soc2        = "CC6.1"
      },
      {
        id          = "cognito-weak-password"
        resource    = aws_cognito_user_pool.insecure_pool.id
        description = "Weak password policy (8 chars, no complexity)"
        mitre       = "T1110.003"
        nist        = "PR.AC-1"
        soc2        = "CC6.1"
      },
      {
        id          = "secrets-no-rotation"
        resource    = aws_secretsmanager_secret.unrotated_secret.name
        description = "Secret has no automatic rotation configured"
        mitre       = "T1552.001"
        nist        = "IA-5"
        soc2        = "CC6.1"
      }
    ]
  }
}
