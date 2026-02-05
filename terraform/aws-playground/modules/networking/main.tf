# ═══════════════════════════════════════════════════════════════════
# NETWORKING MODULE: VPC + Security Groups
# Intentional Vulnerabilities: Open security groups, no NACLs, no flow logs
# ═══════════════════════════════════════════════════════════════════

variable "name_prefix" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "tags" {
  type = map(string)
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

# Public Subnets (for testing publicly accessible resources)
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, 1)
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-subnet-1"
    Type = "Public"
  })
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, 2)
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-subnet-2"
    Type = "Public"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# 🔴 VULNERABILITY 1: WIDE-OPEN SECURITY GROUP (CRITICAL)
# MITRE: T1190 (Exploit Public-Facing Application)
# NIST: PR.AC-5 (Network integrity protection)
# SOC2: CC6.6 (Logical access - network security)

resource "aws_security_group" "wide_open" {
  name        = "${var.name_prefix}-wide-open-sg"
  description = "INTENTIONALLY INSECURE - Allows all traffic from internet"
  vpc_id      = aws_vpc.main.id

  # Allow ALL inbound traffic from internet
  ingress {
    description = "CRITICAL: Allow ALL traffic from internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-wide-open-sg"
    Vulnerability = "CRITICAL-wide-open-sg"
    AttackVector  = "network-exposure"
  })
}

# 🔴 VULNERABILITY 2: SSH OPEN TO INTERNET (CRITICAL)
# MITRE: T1021.004 (Remote Services: SSH)
# NIST: PR.AC-5
# SOC2: CC6.6

resource "aws_security_group" "ssh_open" {
  name        = "${var.name_prefix}-ssh-open-sg"
  description = "INTENTIONALLY INSECURE - SSH open to internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "CRITICAL: SSH from internet"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-ssh-open-sg"
    Vulnerability = "CRITICAL-ssh-internet"
    AttackVector  = "remote-access"
  })
}

# 🔴 VULNERABILITY 3: RDP OPEN TO INTERNET (CRITICAL)
# MITRE: T1021.001 (Remote Services: Remote Desktop Protocol)
# NIST: PR.AC-5
# SOC2: CC6.6

resource "aws_security_group" "rdp_open" {
  name        = "${var.name_prefix}-rdp-open-sg"
  description = "INTENTIONALLY INSECURE - RDP open to internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "CRITICAL: RDP from internet"
    from_port   = 3389
    to_port     = 3389
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name         = "${var.name_prefix}-rdp-open-sg"
    Vulnerability = "CRITICAL-rdp-internet"
    AttackVector  = "remote-access"
  })
}

# 🔴 VULNERABILITY 4: NO VPC FLOW LOGS (MEDIUM)
# MITRE: T1562.008 (Impair Defenses: Disable Cloud Logs)
# NIST: DE.AE-3
# SOC2: CC7.2

# Intentionally NO flow logs configured

# 🔴 VULNERABILITY 5: NO NETWORK ACLS (LOW)
# Default NACLs allow all traffic

# Data source for AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# ═══════════════════════════════════════════════════════════════════
# OUTPUTS
# ═══════════════════════════════════════════════════════════════════

output "vpc_id" {
  value = aws_vpc.main.id
}

output "vpc_cidr" {
  value = aws_vpc.main.cidr_block
}

output "public_subnet_id" {
  value = aws_subnet.public_1.id
}

output "public_subnet_ids" {
  value = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

output "open_security_group_id" {
  value = aws_security_group.wide_open.id
}

output "ssh_security_group_id" {
  value = aws_security_group.ssh_open.id
}

output "rdp_security_group_id" {
  value = aws_security_group.rdp_open.id
}

output "vulnerabilities" {
  value = {
    CRITICAL = [
      {
        id          = "sg-wide-open"
        resource    = aws_security_group.wide_open.id
        description = "Security group allows ALL traffic from 0.0.0.0/0"
        mitre       = "T1190"
        nist        = "PR.AC-5"
        soc2        = "CC6.6"
      },
      {
        id          = "sg-ssh-internet"
        resource    = aws_security_group.ssh_open.id
        description = "SSH (port 22) open to internet"
        mitre       = "T1021.004"
        nist        = "PR.AC-5"
        soc2        = "CC6.6"
      },
      {
        id          = "sg-rdp-internet"
        resource    = aws_security_group.rdp_open.id
        description = "RDP (port 3389) open to internet"
        mitre       = "T1021.001"
        nist        = "PR.AC-5"
        soc2        = "CC6.6"
      }
    ]
    MEDIUM = [
      {
        id          = "vpc-no-flow-logs"
        resource    = aws_vpc.main.id
        description = "VPC has no flow logs enabled"
        mitre       = "T1562.008"
        nist        = "DE.AE-3"
        soc2        = "CC7.2"
      }
    ]
  }
}
