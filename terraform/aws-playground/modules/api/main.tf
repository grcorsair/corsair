# API MODULE: API Gateway
# Vulnerabilities: No authentication, wide-open CORS

variable "name_prefix" { type = string }
variable "tags" { type = map(string) }

# 🔴 API Gateway with no authentication (CRITICAL)
resource "aws_apigatewayv2_api" "unauthenticated" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]  # Allow all origins
    allow_methods = ["*"]  # Allow all methods
    allow_headers = ["*"]
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-api"
    Vulnerability = "CRITICAL-no-auth"
  })
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.unauthenticated.id
  name        = "$default"
  auto_deploy = true
}

output "api_endpoint" { value = aws_apigatewayv2_api.unauthenticated.api_endpoint }
output "vulnerabilities" {
  value = {
    CRITICAL = [{
      id = "api-no-auth"
      resource = aws_apigatewayv2_api.unauthenticated.id
      description = "API Gateway has no authentication"
      mitre = "T1190"
    }]
  }
}
