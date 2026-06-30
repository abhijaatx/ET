#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
PROJECT_NAME="${PROJECT_NAME:-et}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t4g.small}"
VOLUME_SIZE_GB="${VOLUME_SIZE_GB:-30}"
REPO_URL="${REPO_URL:-https://github.com/abhijaatx/ET.git}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.production}"
CREATE_EIP="${CREATE_EIP:-true}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.production.example to ${ENV_FILE} and fill it first." >&2
  exit 1
fi

POSTGRES_PASSWORD_VALUE="$(awk -F= '/^POSTGRES_PASSWORD=/{print substr($0, index($0, "=") + 1)}' "${ENV_FILE}")"
if [[ -z "${POSTGRES_PASSWORD_VALUE}" || ! "${POSTGRES_PASSWORD_VALUE}" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "POSTGRES_PASSWORD in ${ENV_FILE} must use only URL-safe characters: A-Z a-z 0-9 . _ ~ -" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BACKUP_BUCKET:-${PROJECT_NAME}-prod-backups-${ACCOUNT_ID}-${AWS_REGION}}"
PARAM_NAME="${PARAM_NAME:-/${PROJECT_NAME}/prod/env}"
ROLE_NAME="${PROJECT_NAME}-prod-ec2-role"
PROFILE_NAME="${PROJECT_NAME}-prod-ec2-profile"
POLICY_NAME="${PROJECT_NAME}-prod-instance-policy"
SG_NAME="${PROJECT_NAME}-prod-sg"

VPC_ID="$(aws ec2 describe-vpcs --region "${AWS_REGION}" --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
SUBNET_ID="$(aws ec2 describe-subnets --region "${AWS_REGION}" --filters Name=vpc-id,Values="${VPC_ID}" Name=default-for-az,Values=true --query 'Subnets[0].SubnetId' --output text)"
AMI_ID="$(aws ssm get-parameter --region "${AWS_REGION}" --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query 'Parameter.Value' --output text)"

if ! aws s3api head-bucket --bucket "${BUCKET}" >/dev/null 2>&1; then
  if [[ "${AWS_REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket --region "${AWS_REGION}" --bucket "${BUCKET}"
  else
    aws s3api create-bucket \
      --region "${AWS_REGION}" \
      --bucket "${BUCKET}" \
      --create-bucket-configuration LocationConstraint="${AWS_REGION}"
  fi
  aws s3api put-public-access-block \
    --bucket "${BUCKET}" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

ENV_VALUE="$(cat "${ENV_FILE}")"
aws ssm put-parameter \
  --region "${AWS_REGION}" \
  --name "${PARAM_NAME}" \
  --type SecureString \
  --overwrite \
  --value "${ENV_VALUE}" >/dev/null

if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  TRUST_POLICY="$(mktemp)"
  cat > "${TRUST_POLICY}" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON
  aws iam create-role --role-name "${ROLE_NAME}" --assume-role-policy-document "file://${TRUST_POLICY}" >/dev/null
  rm -f "${TRUST_POLICY}"
fi

aws iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore >/dev/null 2>&1 || true

INSTANCE_POLICY="$(mktemp)"
cat > "${INSTANCE_POLICY}" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter${PARAM_NAME}"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${BUCKET}",
        "arn:aws:s3:::${BUCKET}/*"
      ]
    }
  ]
}
JSON
aws iam put-role-policy --role-name "${ROLE_NAME}" --policy-name "${POLICY_NAME}" --policy-document "file://${INSTANCE_POLICY}" >/dev/null
rm -f "${INSTANCE_POLICY}"

if ! aws iam get-instance-profile --instance-profile-name "${PROFILE_NAME}" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "${PROFILE_NAME}" >/dev/null
fi
aws iam add-role-to-instance-profile --instance-profile-name "${PROFILE_NAME}" --role-name "${ROLE_NAME}" >/dev/null 2>&1 || true
sleep 10

SG_ID="$(aws ec2 describe-security-groups --region "${AWS_REGION}" --filters Name=group-name,Values="${SG_NAME}" Name=vpc-id,Values="${VPC_ID}" --query 'SecurityGroups[0].GroupId' --output text)"
if [[ "${SG_ID}" == "None" ]]; then
  SG_ID="$(aws ec2 create-security-group --region "${AWS_REGION}" --group-name "${SG_NAME}" --description "ET production web ingress" --vpc-id "${VPC_ID}" --query GroupId --output text)"
fi
aws ec2 authorize-security-group-ingress --region "${AWS_REGION}" --group-id "${SG_ID}" --ip-permissions IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0,Description="HTTP"}]' >/dev/null 2>&1 || true
aws ec2 authorize-security-group-ingress --region "${AWS_REGION}" --group-id "${SG_ID}" --ip-permissions IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges='[{CidrIp=0.0.0.0/0,Description="HTTPS"}]' >/dev/null 2>&1 || true

USER_DATA="$(mktemp)"
cat > "${USER_DATA}" <<EOF
#!/bin/bash
set -euxo pipefail
dnf update -y
dnf install -y docker git awscli cronie curl
arch="\$(uname -m)"
case "\${arch}" in
  aarch64|arm64) compose_arch="aarch64"; buildx_arch="arm64" ;;
  x86_64|amd64) compose_arch="x86_64"; buildx_arch="amd64" ;;
  *) echo "Unsupported architecture for Docker Compose: \${arch}" >&2; exit 1 ;;
esac
if ! dnf install -y docker-compose-plugin; then
  mkdir -p /usr/local/lib/docker/cli-plugins /usr/libexec/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-\${compose_arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/libexec/docker/cli-plugins/docker-compose
fi
buildx_version="\$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | sed -n 's/.*\"tag_name\": \"\\(v[^\"]*\\)\".*/\\1/p' | head -n 1)"
curl -fsSL "https://github.com/docker/buildx/releases/download/\${buildx_version}/buildx-\${buildx_version}.linux-\${buildx_arch}" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
ln -sf /usr/local/lib/docker/cli-plugins/docker-buildx /usr/libexec/docker/cli-plugins/docker-buildx
docker compose version
docker buildx version
systemctl enable --now docker
systemctl enable --now crond

mkdir -p /opt
if [ ! -d /opt/et/.git ]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" /opt/et
else
  cd /opt/et
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
fi

cd /opt/et
aws ssm get-parameter --region "${AWS_REGION}" --name "${PARAM_NAME}" --with-decryption --query Parameter.Value --output text > .env.production
grep -q '^BACKUP_S3_BUCKET=' .env.production || echo 'BACKUP_S3_BUCKET=${BUCKET}' >> .env.production

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

cat > /usr/local/bin/et-backup <<'BACKUP'
#!/bin/bash
set -euo pipefail
cd /opt/et
set -a
. ./.env.production
set +a
timestamp="\$(date -u +%Y%m%dT%H%M%SZ)"
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_dump -U "\${POSTGRES_USER:-myet}" "\${POSTGRES_DB:-myet}" \
  | gzip \
  | aws s3 cp - "s3://\${BACKUP_S3_BUCKET}/postgres/myet-\${timestamp}.sql.gz"
BACKUP
chmod 0755 /usr/local/bin/et-backup
echo '17 2 * * * root /usr/local/bin/et-backup >> /var/log/et-backup.log 2>&1' > /etc/cron.d/et-backup
EOF

INSTANCE_ID="$(aws ec2 run-instances \
  --region "${AWS_REGION}" \
  --image-id "${AMI_ID}" \
  --instance-type "${INSTANCE_TYPE}" \
  --iam-instance-profile Name="${PROFILE_NAME}" \
  --security-group-ids "${SG_ID}" \
  --subnet-id "${SUBNET_ID}" \
  --associate-public-ip-address \
  --block-device-mappings "DeviceName=/dev/xvda,Ebs={VolumeSize=${VOLUME_SIZE_GB},VolumeType=gp3,DeleteOnTermination=true}" \
  --user-data "file://${USER_DATA}" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}-prod},{Key=Project,Value=${PROJECT_NAME}}]" \
  --query 'Instances[0].InstanceId' \
  --output text)"
rm -f "${USER_DATA}"

aws ec2 wait instance-running --region "${AWS_REGION}" --instance-ids "${INSTANCE_ID}"

PUBLIC_IP="$(aws ec2 describe-instances --region "${AWS_REGION}" --instance-ids "${INSTANCE_ID}" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
if [[ "${CREATE_EIP}" == "true" ]]; then
  ALLOCATION_ID="$(aws ec2 allocate-address --region "${AWS_REGION}" --domain vpc --query AllocationId --output text)"
  aws ec2 associate-address --region "${AWS_REGION}" --instance-id "${INSTANCE_ID}" --allocation-id "${ALLOCATION_ID}" >/dev/null
  PUBLIC_IP="$(aws ec2 describe-addresses --region "${AWS_REGION}" --allocation-ids "${ALLOCATION_ID}" --query 'Addresses[0].PublicIp' --output text)"
fi

cat <<OUT
Instance: ${INSTANCE_ID}
Region:   ${AWS_REGION}
PublicIP: ${PUBLIC_IP}
Backups:  s3://${BUCKET}/postgres/

Point your domain A record at ${PUBLIC_IP}, then check:
  https://<your-domain>/health

For logs:
  aws ssm start-session --region ${AWS_REGION} --target ${INSTANCE_ID}
  cd /opt/et && docker compose -f docker-compose.prod.yml logs -f
OUT
