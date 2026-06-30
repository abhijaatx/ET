#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
PROJECT_NAME="${PROJECT_NAME:-et}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-.env.production}"
PARAM_NAME="${PARAM_NAME:-/${PROJECT_NAME}/prod/env}"

INSTANCE_ID="${1:-}"
if [[ -z "${INSTANCE_ID}" ]]; then
  INSTANCE_ID="$(aws ec2 describe-instances \
    --region "${AWS_REGION}" \
    --filters "Name=tag:Project,Values=${PROJECT_NAME}" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)"
fi

if [[ -z "${INSTANCE_ID}" || "${INSTANCE_ID}" == "None" ]]; then
  echo "Could not find a running ${PROJECT_NAME} instance. Pass the instance id as the first argument." >&2
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  ENV_VALUE="$(cat "${ENV_FILE}")"
  aws ssm put-parameter \
    --region "${AWS_REGION}" \
    --name "${PARAM_NAME}" \
    --type SecureString \
    --overwrite \
    --value "${ENV_VALUE}" >/dev/null
fi

COMMAND_ID="$(aws ssm send-command \
  --region "${AWS_REGION}" \
  --instance-ids "${INSTANCE_ID}" \
  --document-name AWS-RunShellScript \
  --comment "Deploy ${PROJECT_NAME}" \
  --parameters commands="[
    \"set -euo pipefail\",
    \"cd /opt/et\",
    \"git fetch origin ${BRANCH}\",
    \"git checkout ${BRANCH}\",
    \"git pull --ff-only origin ${BRANCH}\",
    \"aws ssm get-parameter --region ${AWS_REGION} --name ${PARAM_NAME} --with-decryption --query Parameter.Value --output text > .env.production\",
    \"docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build\",
    \"docker compose -f docker-compose.prod.yml ps\"
  ]" \
  --query 'Command.CommandId' \
  --output text)"

aws ssm wait command-executed --region "${AWS_REGION}" --command-id "${COMMAND_ID}" --instance-id "${INSTANCE_ID}"
aws ssm get-command-invocation \
  --region "${AWS_REGION}" \
  --command-id "${COMMAND_ID}" \
  --instance-id "${INSTANCE_ID}" \
  --query '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}' \
  --output text
