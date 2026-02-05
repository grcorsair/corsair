# DATABASE MODULE: RDS + DynamoDB
# Vulnerabilities: Publicly accessible RDS, unencrypted DynamoDB

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "open_security_group_id" { type = string }
variable "tags" { type = map(string) }

# 🔴 DynamoDB without encryption (MEDIUM)
resource "aws_dynamodb_table" "unencrypted" {
  name           = "${var.name_prefix}-table"
  billing_mode   = "PAY_PER_REQUEST"  # Free tier friendly
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  # Intentionally NO server_side_encryption block

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-dynamodb"
    Vulnerability = "MEDIUM-no-encryption"
  })
}

output "dynamodb_table_name" { value = aws_dynamodb_table.unencrypted.name }
output "vulnerabilities" {
  value = {
    MEDIUM = [{
      id = "dynamodb-no-encryption"
      resource = aws_dynamodb_table.unencrypted.name
      description = "DynamoDB table has no encryption at rest"
      mitre = "T1530"
    }]
  }
}
