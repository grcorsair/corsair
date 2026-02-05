# 🏴‍☠️ Corsair AWS Multi-Service Playground

**Intentionally insecure AWS infrastructure spanning 6+ services for comprehensive Corsair security testing.**

## ⚠️ CRITICAL SAFETY WARNINGS

**DO NOT USE IN PRODUCTION**

This deployment creates **22+ intentional security vulnerabilities** across AWS services:
- ❌ PUBLIC S3 buckets
- ❌ WIDE-OPEN security groups (0.0.0.0/0)
- ❌ MFA DISABLED on Cognito
- ❌ OVERPERMISSIVE IAM roles
- ❌ NO ENCRYPTION on storage
- ❌ API Gateway with NO authentication

**Account:** InsecureCorsair (957654404683) - TESTING ONLY

## 🎯 Purpose

Validate Corsair's multi-service security testing capabilities across:

| Service | Vulnerabilities | MITRE Techniques |
|---------|----------------|------------------|
| **S3** | Public access, no encryption, no versioning, no logging | T1530 (Data from Cloud Storage) |
| **EC2** | IMDSv1, open security groups | T1552.005 (Cloud Instance Metadata API) |
| **Cognito** | MFA disabled, weak passwords | T1556.006 (MFA Interception) |
| **IAM** | Overpermissive policies, access keys | T1078.004 (Cloud Accounts) |
| **DynamoDB** | No encryption at rest | T1530 |
| **API Gateway** | No authentication, wide CORS | T1190 (Exploit Public-Facing Application) |
| **VPC/SG** | 0.0.0.0/0 ingress, SSH/RDP open, no flow logs | T1190, T1021 |

**Total:** 22+ vulnerabilities (11 CRITICAL, 5 HIGH, 6 MEDIUM)

## 📋 Prerequisites

1. **AWS Account**: InsecureCorsair (957654404683)
2. **Terraform**: v1.0+
3. **AWS CLI**: Configured with credentials
4. **Cost**: FREE TIER (750 EC2 hrs, 5GB S3, etc.)

## 🚀 Deployment

### Step 1: Configure AWS Credentials

```bash
# Option 1: AWS CLI profile
export AWS_PROFILE=insecure-corsair

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-west-2
```

### Step 2: Deploy Infrastructure

```bash
cd terraform/aws-playground
terraform init
terraform plan  # Review what will be created
terraform apply  # Type 'yes' to confirm
```

Deployment takes **~2-3 minutes**.

### Step 3: Verify Deployment

```bash
# Show all outputs
terraform output -json | jq .

# Test public S3 access (should work)
terraform output -raw storage | jq -r '.test_file_url' | xargs curl
```

## 🧪 Testing with Corsair

### Current Corsair Capabilities

Corsair currently supports **AWS Cognito** via the `aws-cognito` plugin. To test:

```bash
# Get Cognito User Pool ID
terraform output -json | jq -r '.security.value.cognito_user_pool_id'

# Update src/agents/example.ts with the User Pool ID
# Run Corsair against real AWS
bun run src/agents/example.ts
```

### Future: Multi-Service Testing

To extend Corsair for multi-service testing:

1. **Create plugins** for each service:
   - `plugins/aws-s3/` - S3 bucket security testing
   - `plugins/aws-ec2/` - EC2 instance security
   - `plugins/aws-iam/` - IAM policy analysis
   - `plugins/aws-dynamodb/` - DynamoDB encryption checks
   - `plugins/aws-api-gateway/` - API security testing

2. **Update corsair-agent.ts** to support multiple providers

3. **Create missions** for each service (see examples below)

### Example Missions

**Mission 1: S3 Security Audit**
```typescript
const mission = `
Test S3 bucket security in account ${account_id}:
1. Enumerate all S3 buckets
2. Test for public access
3. Check encryption at rest
4. Verify logging enabled
5. Map findings to SOC 2 CC6.7
`;
```

**Mission 2: Network Exposure Assessment**
```typescript
const mission = `
Audit network security in VPC ${vpc_id}:
1. RECON all security groups
2. MARK groups with 0.0.0.0/0 ingress
3. RAID test port scanning (dry run)
4. PLUNDER evidence of exposed services
5. Map to NIST PR.AC-5
`;
```

**Mission 3: IAM Privilege Escalation**
```typescript
const mission = `
Test IAM security posture:
1. RECON all IAM roles and policies
2. MARK overpermissive policies (* on *)
3. Simulate privilege escalation paths
4. PLUNDER evidence of excessive permissions
5. Map to MITRE T1078.004
`;
```

## 🔍 Vulnerability Matrix

| Resource | Severity | Vulnerability | MITRE | NIST | SOC 2 |
|----------|----------|---------------|-------|------|-------|
| S3 Public Bucket | **CRITICAL** | Public read access | T1530 | PR.DS-1 | CC6.7 |
| S3 Unencrypted | **HIGH** | No encryption at rest | T1530 | PR.DS-1 | CC6.7 |
| Security Group | **CRITICAL** | 0.0.0.0/0 ingress | T1190 | PR.AC-5 | CC6.6 |
| SSH Open | **CRITICAL** | Port 22 from internet | T1021.004 | PR.AC-5 | CC6.6 |
| RDP Open | **CRITICAL** | Port 3389 from internet | T1021.001 | PR.AC-5 | CC6.6 |
| Cognito MFA | **CRITICAL** | MFA disabled | T1556.006 | PR.AC-7 | CC6.1 |
| IAM Role | **CRITICAL** | * permissions | T1078.004 | PR.AC-4 | CC6.2 |
| IAM User | **CRITICAL** | Admin inline policy | T1078.004 | PR.AC-4 | CC6.1 |
| API Gateway | **CRITICAL** | No authentication | T1190 | PR.AC-3 | CC6.1 |
| EC2 IMDSv1 | **HIGH** | Metadata v1 enabled | T1552.005 | IA-5 | CC6.1 |
| IAM Access Keys | **HIGH** | Programmatic access | T1078.004 | IA-5 | CC6.1 |
| Cognito Password | **HIGH** | 8 char, no complexity | T1110.003 | PR.AC-1 | CC6.1 |
| Secrets | **HIGH** | No rotation | T1552.001 | IA-5 | CC6.1 |
| S3 Versioning | **MEDIUM** | Disabled | T1485 | PR.IP-4 | A1.2 |
| S3 Logging | **MEDIUM** | Not enabled | T1562.008 | DE.AE-3 | CC7.2 |
| VPC Flow Logs | **MEDIUM** | Not enabled | T1562.008 | DE.AE-3 | CC7.2 |
| DynamoDB Encryption | **MEDIUM** | Not enabled | T1530 | PR.DS-1 | CC6.7 |

## 💰 Cost Management

### Free Tier Limits

| Service | Free Tier | This Deployment | Monthly Cost |
|---------|-----------|-----------------|--------------|
| EC2 | 750 hrs t2.micro | 1 instance (730 hrs) | $0.00 |
| S3 | 5GB storage | ~1MB | $0.00 |
| DynamoDB | 25GB, 25 RCU/WCU | Pay-per-request (minimal) | $0.00 |
| API Gateway | 1M requests | Minimal usage | $0.00 |
| Cognito | 50,000 MAUs | No users | $0.00 |
| Secrets Manager | **30-day trial** | 1 secret | **$0.40/month after trial** |

**Estimated Cost:** ~$0.00-0.40/month (within free tier)

### Services NOT Included (Cost Risk)

| Service | Reason | Potential Cost |
|---------|--------|----------------|
| **Bedrock** | No free tier | $0.001-0.01 per request |
| **RDS** | Long creation time (5-10 min) | Free tier available, disabled by default |

To enable RDS: `terraform apply -var="enable_rds=true"` (WARNING: 5-10 min deploy time)

## 🧹 Cleanup

**IMPORTANT**: Destroy infrastructure after testing:

```bash
terraform destroy -auto-approve
```

Verify deletion:
```bash
aws s3 ls | grep corsair
aws ec2 describe-instances --filters "Name=tag:Project,Values=Corsair-GRC-Playground"
```

## 📊 Corsair Integration Roadmap

### Phase 1: Single-Service (DONE ✅)
- AWS Cognito plugin
- RECON, MARK, RAID, PLUNDER, CHART, ESCAPE primitives
- Agentic autonomous execution

### Phase 2: Multi-Service Reconnaissance (NEXT 🚧)
- S3 plugin (public access detection)
- EC2 plugin (security group analysis)
- IAM plugin (policy scanning)
- Parallel multi-target reconnaissance

### Phase 3: Cross-Service Attack Chains (FUTURE 📅)
- Multi-service attack scenarios
- Privilege escalation paths (IAM → EC2 → S3)
- Lateral movement simulation
- Supply chain attack validation

### Phase 4: Compliance Automation (FUTURE 📅)
- Automated SOC 2 control testing
- NIST CSF validation
- Continuous compliance monitoring
- Evidence aggregation for audits

## 🛠️ Customization

### Change Region

```bash
terraform apply -var="aws_region=eu-west-1"
```

### Disable Services

```bash
# Disable EC2 (saves free tier hours)
terraform apply -var="enable_ec2=false"

# Disable Lambda
terraform apply -var="enable_lambda=false"
```

### Enable RDS

```bash
# WARNING: Takes 5-10 minutes to create
terraform apply -var="enable_rds=true"
```

## 🔐 Security Notes

Even though intentionally insecure:

1. **Isolated Account**: Use InsecureCorsair (957654404683) only
2. **No Real Data**: Never put production data in this environment
3. **Monitor Costs**: Check AWS billing daily
4. **Time-Bound**: Deploy → test → destroy within hours
5. **Tagged**: All resources tagged "INTENTIONALLY-INSECURE"

## 🤝 Troubleshooting

### "Error: creating S3 bucket: BucketAlreadyExists"

S3 bucket names are globally unique. Destroy and recreate to get new random suffix:
```bash
terraform destroy -auto-approve
terraform apply
```

### "Error: authorizing Security Group ingress"

Check AWS account limits:
```bash
aws ec2 describe-account-attributes --attribute-names max-security-groups-per-interface
```

### Terraform state locked

```bash
# Force unlock (CAREFUL)
terraform force-unlock <lock-id>
```

### Cost unexpectedly high

```bash
# Check what's running
aws ec2 describe-instances --query 'Reservations[].Instances[].[InstanceId,State.Name,InstanceType]'
aws s3 ls
aws rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceStatus]'

# Destroy immediately
terraform destroy -auto-approve
```

## 📚 References

- [AWS Free Tier](https://aws.amazon.com/free/)
- [MITRE ATT&CK Cloud Matrix](https://attack.mitre.org/matrices/enterprise/cloud/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SOC 2 Trust Services Criteria](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/trustdataintegritytaskforce)
- [Corsair Documentation](../README.md)

---

**Remember**: This infrastructure is intentionally insecure. Use responsibly, test thoroughly, and destroy after validation.

🏴‍☠️ **May the winds of testing be ever in your favor, Captain!**
