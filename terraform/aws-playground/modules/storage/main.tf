# ═══════════════════════════════════════════════════════════════════
# STORAGE MODULE: S3 + EBS
# Intentional Vulnerabilities: Public buckets, no encryption, no versioning
# ═══════════════════════════════════════════════════════════════════

variable "name_prefix" {
  type = string
}

variable "tags" {
  type = map(string)
}

# 🔴 VULNERABILITY 1: PUBLICLY ACCESSIBLE S3 BUCKET (CRITICAL)
# MITRE: T1530 (Data from Cloud Storage Object)
# NIST: PR.DS-1 (Data-at-rest protection)
# SOC2: CC6.7 (Data security)

resource "aws_s3_bucket" "public_bucket" {
  bucket = "${var.name_prefix}-public-data"

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-public-bucket"
    Vulnerability = "CRITICAL-public-access"
    AttackVector  = "data-exposure"
  })
}

resource "aws_s3_bucket_public_access_block" "public_bucket_access" {
  bucket = aws_s3_bucket.public_bucket.id

  # 🔴 INTENTIONALLY DISABLED - Allows public access
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_policy" {
  bucket = aws_s3_bucket.public_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.public_bucket.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.public_bucket_access]
}

# 🔴 VULNERABILITY 2: NO ENCRYPTION AT REST (HIGH)
# MITRE: T1530 (Data from Cloud Storage Object)
# NIST: PR.DS-1
# SOC2: CC6.7

resource "aws_s3_bucket" "unencrypted_bucket" {
  bucket = "${var.name_prefix}-unencrypted"

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-unencrypted-bucket"
    Vulnerability = "HIGH-no-encryption"
    AttackVector  = "data-at-rest-exposure"
  })
}

# Intentionally NO server-side encryption configuration

# 🔴 VULNERABILITY 3: NO VERSIONING (MEDIUM)
# MITRE: T1485 (Data Destruction)
# NIST: PR.IP-4 (Backup)
# SOC2: A1.2 (Availability)

resource "aws_s3_bucket_versioning" "disabled_versioning" {
  bucket = aws_s3_bucket.unencrypted_bucket.id

  versioning_configuration {
    status = "Disabled"  # Should be "Enabled"
  }
}

# 🔴 VULNERABILITY 4: NO LOGGING (MEDIUM)
# MITRE: T1562.008 (Impair Defenses: Disable Cloud Logs)
# NIST: DE.AE-3 (Event data aggregated)
# SOC2: CC7.2 (Monitoring)

# Intentionally NO access logging enabled for either bucket

# Upload test file to public bucket for validation
resource "aws_s3_object" "test_file" {
  bucket  = aws_s3_bucket.public_bucket.id
  key     = "test-data.txt"
  content = "🏴‍☠️ CORSAIR TEST DATA - This file is PUBLICLY ACCESSIBLE!"
  content_type = "text/plain"

  tags = {
    Purpose = "corsair-validation"
  }
}

# ═══════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════

output "public_bucket_name" {
  value = aws_s3_bucket.public_bucket.id
}

output "public_bucket_arn" {
  value = aws_s3_bucket.public_bucket.arn
}

output "unencrypted_bucket_name" {
  value = aws_s3_bucket.unencrypted_bucket.id
}

output "test_file_url" {
  value = "https://${aws_s3_bucket.public_bucket.bucket}.s3.${aws_s3_bucket.public_bucket.region}.amazonaws.com/test-data.txt"
  description = "Publicly accessible test file (validates public access vulnerability)"
}

output "vulnerabilities" {
  value = {
    CRITICAL = [
      {
        id          = "s3-public-access"
        resource    = aws_s3_bucket.public_bucket.id
        description = "S3 bucket is publicly accessible to internet"
        mitre       = "T1530"
        nist        = "PR.DS-1"
        soc2        = "CC6.7"
        test_url    = "https://${aws_s3_bucket.public_bucket.bucket}.s3.${aws_s3_bucket.public_bucket.region}.amazonaws.com/test-data.txt"
      }
    ]
    HIGH = [
      {
        id          = "s3-no-encryption"
        resource    = aws_s3_bucket.unencrypted_bucket.id
        description = "S3 bucket has no encryption at rest"
        mitre       = "T1530"
        nist        = "PR.DS-1"
        soc2        = "CC6.7"
      }
    ]
    MEDIUM = [
      {
        id          = "s3-no-versioning"
        resource    = aws_s3_bucket.unencrypted_bucket.id
        description = "S3 bucket has versioning disabled"
        mitre       = "T1485"
        nist        = "PR.IP-4"
        soc2        = "A1.2"
      },
      {
        id          = "s3-no-logging"
        resource    = aws_s3_bucket.public_bucket.id
        description = "S3 buckets have no access logging"
        mitre       = "T1562.008"
        nist        = "DE.AE-3"
        soc2        = "CC7.2"
      }
    ]
  }
}
