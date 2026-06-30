#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
PROJECT_NAME="${PROJECT_NAME:-et}"
STATIC_BUCKET="${STATIC_BUCKET:-}"
API_ORIGIN_DOMAIN="${API_ORIGIN_DOMAIN:-}"
DISTRIBUTION_ID="${DISTRIBUTION_ID:-}"
COMMENT="${COMMENT:-${PROJECT_NAME}-static-cloudfront}"
OAC_NAME="${OAC_NAME:-${PROJECT_NAME}-static-oac}"
FUNCTION_NAME="${FUNCTION_NAME:-${PROJECT_NAME}-static-router}"
OUT_DIR="${OUT_DIR:-apps/web/out}"

CACHE_POLICY_CACHING_OPTIMIZED="658327ea-f89d-4fab-a63d-7e88639e58f6"
CACHE_POLICY_CACHING_DISABLED="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
ORIGIN_REQUEST_ALL_VIEWER_EXCEPT_HOST="b689b0a8-53d0-40ab-baf2-68738e2966ac"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

if [[ -z "${STATIC_BUCKET}" ]]; then
  STATIC_BUCKET="${PROJECT_NAME}-static-${ACCOUNT_ID}-${AWS_REGION}"
fi

if [[ -z "${API_ORIGIN_DOMAIN}" ]]; then
  API_ORIGIN_DOMAIN="$(aws ec2 describe-instances \
    --region "${AWS_REGION}" \
    --filters "Name=tag:Project,Values=${PROJECT_NAME}" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text)"
fi

if [[ -z "${API_ORIGIN_DOMAIN}" || "${API_ORIGIN_DOMAIN}" == "None" ]]; then
  API_ORIGIN_IP="$(aws ec2 describe-instances \
    --region "${AWS_REGION}" \
    --filters "Name=tag:Project,Values=${PROJECT_NAME}" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)"

  if [[ -z "${API_ORIGIN_IP}" || "${API_ORIGIN_IP}" == "None" ]]; then
    echo "Could not discover the API EC2 public DNS name. Set API_ORIGIN_DOMAIN." >&2
    exit 1
  fi

  API_ORIGIN_DOMAIN="ec2-${API_ORIGIN_IP//./-}.${AWS_REGION}.compute.amazonaws.com"
fi

echo "Using API origin ${API_ORIGIN_DOMAIN}."

echo "Building static frontend..."
NEXT_OUTPUT=export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" npm run build --workspace apps/web

if ! aws s3api head-bucket --bucket "${STATIC_BUCKET}" >/dev/null 2>&1; then
  echo "Creating S3 bucket ${STATIC_BUCKET}..."
  if [[ "${AWS_REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "${STATIC_BUCKET}" >/dev/null
  else
    aws s3api create-bucket \
      --bucket "${STATIC_BUCKET}" \
      --create-bucket-configuration "LocationConstraint=${AWS_REGION}" >/dev/null
  fi
fi

aws s3api put-public-access-block \
  --bucket "${STATIC_BUCKET}" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true >/dev/null

echo "Publishing static files to s3://${STATIC_BUCKET}..."
aws s3 sync "${OUT_DIR}/" "s3://${STATIC_BUCKET}/" \
  --delete \
  --exclude "_next/static/*" \
  --cache-control "public,max-age=60" >/dev/null

if [[ -d "${OUT_DIR}/_next/static" ]]; then
  aws s3 sync "${OUT_DIR}/_next/static/" "s3://${STATIC_BUCKET}/_next/static/" \
    --delete \
    --cache-control "public,max-age=31536000,immutable" >/dev/null
fi

OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id | [0]" \
  --output text)"

if [[ -z "${OAC_ID}" || "${OAC_ID}" == "None" ]]; then
  OAC_CONFIG="$(mktemp)"
  cat > "${OAC_CONFIG}" <<JSON
{
  "Name": "${OAC_NAME}",
  "Description": "Private S3 access for ${PROJECT_NAME} static site",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
JSON
  OAC_ID="$(aws cloudfront create-origin-access-control \
    --origin-access-control-config "file://${OAC_CONFIG}" \
    --query 'OriginAccessControl.Id' \
    --output text)"
  rm -f "${OAC_CONFIG}"
fi

FUNCTION_CODE="$(mktemp)"
cat > "${FUNCTION_CODE}" <<'JS'
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.indexOf('/briefing/') === 0 && uri !== '/briefing/') {
    request.uri = '/briefing/index.html';
    return request;
  }

  if (uri === '/') {
    request.uri = '/index.html';
  } else if (uri.slice(-1) === '/') {
    request.uri = uri + 'index.html';
  } else if (uri.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }

  return request;
}
JS

if aws cloudfront describe-function --name "${FUNCTION_NAME}" --stage DEVELOPMENT >/dev/null 2>&1; then
  DEV_ETAG="$(aws cloudfront describe-function --name "${FUNCTION_NAME}" --stage DEVELOPMENT --query ETag --output text)"
  aws cloudfront update-function \
    --name "${FUNCTION_NAME}" \
    --if-match "${DEV_ETAG}" \
    --function-config "Comment=Static route rewrites for ${PROJECT_NAME},Runtime=cloudfront-js-2.0" \
    --function-code "fileb://${FUNCTION_CODE}" >/dev/null
else
  aws cloudfront create-function \
    --name "${FUNCTION_NAME}" \
    --function-config "Comment=Static route rewrites for ${PROJECT_NAME},Runtime=cloudfront-js-2.0" \
    --function-code "fileb://${FUNCTION_CODE}" >/dev/null
fi

DEV_ETAG="$(aws cloudfront describe-function --name "${FUNCTION_NAME}" --stage DEVELOPMENT --query ETag --output text)"
aws cloudfront publish-function --name "${FUNCTION_NAME}" --if-match "${DEV_ETAG}" >/dev/null
FUNCTION_ARN="$(aws cloudfront describe-function \
  --name "${FUNCTION_NAME}" \
  --stage LIVE \
  --query 'FunctionSummary.FunctionMetadata.FunctionARN' \
  --output text)"
rm -f "${FUNCTION_CODE}"

if [[ -z "${DISTRIBUTION_ID}" ]]; then
  DISTRIBUTION_ID="$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='${COMMENT}'].Id | [0]" \
    --output text)"
fi

if [[ -z "${DISTRIBUTION_ID}" || "${DISTRIBUTION_ID}" == "None" ]]; then
  DIST_CONFIG="$(mktemp)"
  S3_ORIGIN_DOMAIN="${STATIC_BUCKET}.s3.${AWS_REGION}.amazonaws.com"
  cat > "${DIST_CONFIG}" <<JSON
{
  "CallerReference": "${COMMENT}-$(date +%s)",
  "Comment": "${COMMENT}",
  "Enabled": true,
  "Aliases": { "Quantity": 0 },
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "s3-static",
        "DomainName": "${S3_ORIGIN_DOMAIN}",
        "S3OriginConfig": { "OriginAccessIdentity": "" },
        "OriginAccessControlId": "${OAC_ID}",
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10
      },
      {
        "Id": "api-origin",
        "DomainName": "${API_ORIGIN_DOMAIN}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 5
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-static",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "TrustedSigners": { "Enabled": false, "Quantity": 0 },
    "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
    "Compress": true,
    "CachePolicyId": "${CACHE_POLICY_CACHING_OPTIMIZED}",
    "LambdaFunctionAssociations": { "Quantity": 0 },
    "FunctionAssociations": {
      "Quantity": 1,
      "Items": [
        { "EventType": "viewer-request", "FunctionARN": "${FUNCTION_ARN}" }
      ]
    },
    "FieldLevelEncryptionId": ""
  },
  "CacheBehaviors": {
    "Quantity": 2,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "api-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "TrustedSigners": { "Enabled": false, "Quantity": 0 },
        "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
        "Compress": true,
        "CachePolicyId": "${CACHE_POLICY_CACHING_DISABLED}",
        "OriginRequestPolicyId": "${ORIGIN_REQUEST_ALL_VIEWER_EXCEPT_HOST}",
        "LambdaFunctionAssociations": { "Quantity": 0 },
        "FunctionAssociations": { "Quantity": 0 },
        "FieldLevelEncryptionId": ""
      },
      {
        "PathPattern": "/health",
        "TargetOriginId": "api-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 3,
          "Items": ["GET", "HEAD", "OPTIONS"],
          "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
        },
        "TrustedSigners": { "Enabled": false, "Quantity": 0 },
        "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
        "Compress": true,
        "CachePolicyId": "${CACHE_POLICY_CACHING_DISABLED}",
        "OriginRequestPolicyId": "${ORIGIN_REQUEST_ALL_VIEWER_EXCEPT_HOST}",
        "LambdaFunctionAssociations": { "Quantity": 0 },
        "FunctionAssociations": { "Quantity": 0 },
        "FieldLevelEncryptionId": ""
      }
    ]
  },
  "CustomErrorResponses": { "Quantity": 0 },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true
  },
  "Restrictions": {
    "GeoRestriction": { "RestrictionType": "none", "Quantity": 0 }
  },
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true
}
JSON
  DISTRIBUTION_ID="$(aws cloudfront create-distribution \
    --distribution-config "file://${DIST_CONFIG}" \
    --query 'Distribution.Id' \
    --output text)"
  rm -f "${DIST_CONFIG}"
else
  echo "Reusing CloudFront distribution ${DISTRIBUTION_ID}."
fi

DISTRIBUTION_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
BUCKET_POLICY="$(mktemp)"
cat > "${BUCKET_POLICY}" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${STATIC_BUCKET}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "${DISTRIBUTION_ARN}"
        }
      }
    }
  ]
}
JSON
aws s3api put-bucket-policy --bucket "${STATIC_BUCKET}" --policy "file://${BUCKET_POLICY}" >/dev/null
rm -f "${BUCKET_POLICY}"

INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)"

echo "Waiting for CloudFront distribution and invalidation..."
aws cloudfront wait distribution-deployed --id "${DISTRIBUTION_ID}"
aws cloudfront wait invalidation-completed --distribution-id "${DISTRIBUTION_ID}" --id "${INVALIDATION_ID}"

DISTRIBUTION_DOMAIN="$(aws cloudfront get-distribution \
  --id "${DISTRIBUTION_ID}" \
  --query 'Distribution.DomainName' \
  --output text)"

echo "Static site deployed:"
echo "https://${DISTRIBUTION_DOMAIN}"
