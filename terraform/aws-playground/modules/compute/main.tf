# COMPUTE MODULE: EC2 + Lambda
# Vulnerabilities: Insecure EC2, over-permissioned Lambda

variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_id" { type = string }
variable "open_security_group_id" { type = string }
variable "tags" { type = map(string) }

# 🔴 EC2 with IMDSv1 (HIGH)
resource "aws_instance" "insecure_ec2" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = "t3.micro"  # Free tier (750 hrs/month)
  subnet_id     = var.public_subnet_id
  vpc_security_group_ids = [var.open_security_group_id]

  metadata_options {
    http_tokens = "optional"  # Allows IMDSv1
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-insecure-ec2"
    Vulnerability = "HIGH-imdsv1"
  })
}

data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

output "ec2_instance_id" { value = aws_instance.insecure_ec2.id }
output "ec2_public_ip" { value = aws_instance.insecure_ec2.public_ip }
output "vulnerabilities" {
  value = {
    HIGH = [{
      id = "ec2-imdsv1"
      resource = aws_instance.insecure_ec2.id
      description = "EC2 allows IMDSv1 (metadata service v1)"
      mitre = "T1552.005"
    }]
  }
}
