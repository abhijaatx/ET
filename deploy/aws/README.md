# ET AWS Deployment

This deployment targets the lowest-cost production setup that still keeps the full app running:

- One ARM EC2 instance in `ap-south-1`
- Docker Compose for `web`, `api`, `worker`, `postgres`, `redis`, and `caddy`
- Caddy for automatic HTTPS, so there is no Application Load Balancer cost
- Postgres/Redis on Docker volumes backed by gp3 EBS
- SSM Session Manager access, so there is no SSH key and no port 22
- Nightly Postgres dumps to S3

This is the right first production shape for a low-traffic app. Move Postgres to RDS, Redis to ElastiCache, and the app containers to ECS only after traffic or reliability requirements justify the added monthly baseline.

## Expected Baseline Cost

In Mumbai (`ap-south-1`), AWS pricing returned these Linux ARM on-demand rates:

- `t4g.micro`: `$0.0056/hour`, about `$4.09/month` before storage, IPv4, backups, and data transfer
- `t4g.small`: `$0.0112/hour`, about `$8.18/month` before storage, IPv4, backups, and data transfer
- `t4g.medium`: `$0.0224/hour`, about `$16.35/month` before storage, IPv4, backups, and data transfer

Use `t4g.micro` first with the script's default 2 GB swap file. The app runs Next.js, the API, a worker, Postgres, and Redis on one box; swap gives Docker builds and Postgres enough headroom for low traffic without paying for `t4g.small` all month. If memory pressure shows up under real traffic, move only the instance size to `t4g.small`. With 30 GB gp3, public IPv4, S3 backups, and light traffic, expect the practical floor to be roughly `$9-14/month`. Avoiding ALB, RDS, and ElastiCache saves the largest fixed costs.

## Prerequisites

1. A domain or subdomain, for example `news.example.com`.
2. AWS CLI configured for the target account.
3. The deployment changes committed and pushed to the branch the instance will clone.
4. A filled `.env.production` file created from `.env.production.example`.

For production HTTPS, set:

```dotenv
SITE_ADDRESS=news.example.com
PUBLIC_BASE_URL=https://news.example.com
ACME_EMAIL=admin@example.com
```

For a temporary HTTP-only smoke test, you can use:

```dotenv
SITE_ADDRESS=:80
PUBLIC_BASE_URL=http://<elastic-ip-after-launch>
ACME_EMAIL=admin@example.com
```

The domain path is cleaner because the frontend API URL is baked at build time.

## First Deploy

This command creates billable AWS resources. Review `.env.production` before running it.

```bash
AWS_REGION=ap-south-1 ./deploy/aws/provision-ec2.sh
```

Optional overrides:

```bash
INSTANCE_TYPE=t4g.small VOLUME_SIZE_GB=50 ./deploy/aws/provision-ec2.sh
```

The script creates:

- S3 backup bucket
- SSM SecureString parameter for `.env.production`
- EC2 IAM role and instance profile
- Security group with public `80` and `443`
- Amazon Linux 2023 ARM instance
- Optional Elastic IP

After it prints the public IP, point the domain A record to that IP. Caddy will request the certificate once DNS resolves to the instance.

## Verify

```bash
curl -I https://news.example.com/health
```

Check services through SSM:

```bash
aws ssm start-session --region ap-south-1 --target <instance-id>
cd /opt/et
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

## Update Deploys

After pushing changes to the deploy branch:

```bash
./deploy/aws/update-instance.sh <instance-id>
```

If `.env.production` exists locally, the update script also refreshes the SSM SecureString before rebuilding containers.

## Backups

The instance installs a nightly cron job:

```text
17 2 * * * /usr/local/bin/et-backup
```

Backups are written to:

```text
s3://<backup-bucket>/postgres/
```

Run one manually through SSM:

```bash
sudo /usr/local/bin/et-backup
```

## Scale-Up Triggers

Move off the single-instance setup when one of these becomes true:

- The database needs point-in-time recovery or independent scaling: move Postgres to RDS.
- Redis loss would be unacceptable: move Redis to ElastiCache.
- You need zero-downtime deploys or multiple app instances: move web/API/worker to ECS behind an ALB.
- Static traffic dominates: add CloudFront in front of Caddy or move the Next.js frontend to a managed/static hosting path.
