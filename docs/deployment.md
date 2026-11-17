# Deploying KELU

Everything runs on AWS (Sydney), paid from the free plan's credit:

```
 Browser ──HTTPS──▶ EC2 server: Caddy ─┬─ /          React site (built into the Caddy image)
                                       └─ /api/*  ─▶ backend (FastAPI) ─▶ MySQL 8, Qdrant  (all in Docker)
                                                   │
                                                   ├─▶ S3  kelu-files-v1   uploads, OCR pages, photos, DB backups
                                                   ├─▶ Bedrock             embeddings (Tamil + English)
                                                   ├─▶ OpenRouter          tutor / quiz / OCR models
                                                   └─▶ Brevo SMTP          email
```

Site and API share one address, so the session cookie is first-party and no CORS is needed.
Files: `infra/Dockerfile` (backend), `infra/Dockerfile.web` (site + Caddy), `infra/Caddyfile`,
`infra/docker-compose.prod.yml`.

Secrets live in **one place**: `infra/.env.prod` on the server (git-ignored). Never in code, never in git.

---

## 1. AWS: permissions for the backend

The AWS free plan keeps everything in **Sydney (ap-southeast-2)**.

S3 bucket `kelu-files-v1`: private, versioning off, SSE-S3 encryption (already created).

IAM → Policies → Create policy → JSON, name `kelu-backend`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::kelu-files-v1" },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::kelu-files-v1/*" },
    { "Effect": "Allow", "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:ap-southeast-2::foundation-model/*" }
  ]
}
```

IAM → Users → `kelu-backend` (no console access) → attach the policy → Security credentials →
Create access key → "Application running outside AWS". Keep the two keys for step 4.

Check from your laptop once the keys are in `backend/.env` (prints no secrets):

```
cd backend
.venv\Scripts\python -m app.manage check-aws
```

If Bedrock says `AccessDeniedException` for the Cohere model, open **Bedrock → Model catalog →
Cohere Embed Multilingual** in Sydney and request access, or switch to Amazon's own model with
`BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0`.

## 2. AWS: the server

EC2 → Launch instance (Sydney):

| Setting | Value |
|---|---|
| Image | Ubuntu Server 24.04 LTS, **64-bit (Arm)** |
| Type | `t4g.small` (2 GB RAM) |
| Key pair | create one, keep the `.pem` file safe |
| Storage | 30 GB gp3 |
| Security group | SSH 22 from **My IP** only; HTTP 80 and HTTPS 443 from anywhere |

Then EC2 → Elastic IPs → Allocate → Associate with the instance, so the address never changes.
Your site's host name is that IP with dashes plus `.sslip.io`, e.g. `3.104.12.34` → `3-104-12-34.sslip.io`
(no domain needed; Caddy gets a real HTTPS certificate for it).

On the server (`ssh -i key.pem ubuntu@<elastic-ip>`):

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker

# 2 GB swap: headroom for MySQL + Qdrant + backend on a 2 GB machine
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# The code
git clone <your-repo-url> kelu && cd kelu
nano infra/.env.prod          # fill in from step 4, then Ctrl+O, Enter, Ctrl+X
chmod 600 infra/.env.prod

docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build
curl https://<site-host>/health                 # {"status":"ok"}; the site is https://<site-host>
```

## 3. Google sign-in for the new address

**Google Cloud Console → Credentials → your OAuth client → Authorized JavaScript origins**:
add `https://<site-host>` (e.g. `https://3-104-12-34.sslip.io`). With a real domain later,
add that too and change `SITE_HOST`, `APP_URL` and `CORS_ORIGINS`.

## 4. `infra/.env.prod` (on the server only)

Placeholders only; type the real values on the server yourself.

```
# Site
SITE_HOST=3-104-12-34.sslip.io
APP_URL=https://3-104-12-34.sslip.io
CORS_ORIGINS=https://3-104-12-34.sslip.io

# Database (MySQL runs in Docker; host/port are set by docker-compose.prod.yml). Don't set DATABASE_URL.
DATABASE_NAME=kelu
DATABASE_USER=kelu
DATABASE_PASSWORD=choose_a_long_random_password
MYSQL_ROOT_PASSWORD=choose_another_long_random_password
JWT_SECRET=at_least_32_random_characters

# Qdrant (runs in Docker)
VECTOR_DB_API_KEY=choose_a_long_random_key

# AWS (S3 + Bedrock)
S3_BUCKET=kelu-files-v1
S3_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
BEDROCK_EMBEDDING_MODEL=cohere.embed-multilingual-v3

# AI, sign-in, email, payments: same names as backend/.env
LLM_API_KEY=your_openrouter_key_here
LLM_API_KEY2=your_admin_openrouter_key_here
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_login_here
SMTP_PASSWORD=your_brevo_smtp_key_here
MAIL_FROM=KELU <your_verified_sender_address>
```

Make random values with `openssl rand -hex 32` on the server.
`EMBEDDING_PROVIDER=bedrock`, `STORAGE_BACKEND=s3` and `COOKIE_SECURE=true` are fixed in the compose file.

## 5. First run

```bash
# 1. Sign up on the website, then make yourself admin
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec backend python -m app.manage make-admin you@example.com
```

2. **Knowledge base.** The server uses Bedrock vectors, so the old local BGE-M3 index can't be reused.
   First copy the OCR text you already paid for, from your laptop:
   `.venv\Scripts\python -m app.manage push-ocr-cache`
   Then upload the PDFs again in **Admin → Knowledge base**: their text is found in S3, so only
   embedding runs (cents, no OCR).

## 6. Daily database backup to S3

`crontab -e` on the server, add one line (03:00 Sri Lanka time = 21:30 UTC):

```
30 21 * * * cd ~/kelu && docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec -T mysql sh -c 'mysqldump --single-transaction -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' | gzip | docker run --rm -i --env-file infra/.env.prod -e AWS_DEFAULT_REGION=ap-southeast-2 amazon/aws-cli s3 cp - s3://kelu-files-v1/backups/kelu-$(date +\%F).sql.gz
```

In S3 → `kelu-files-v1` → Management → Lifecycle rule: prefix `backups/`, expire after 30 days.
Backups contain students' data: the bucket stays private.

## 7. Updating

```bash
cd ~/kelu && git pull
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build
```

This rebuilds both the site and the backend. Database migrations run automatically when the backend starts.

## Costs and limits

- Covered by the AWS free plan's credit; the plan ends **16 May 2027**: upgrade before then or the
  account (and bucket) is closed. Roughly: `t4g.small` + 30 GB disk + Elastic IP ≈ USD 20–25/month,
  S3 and Bedrock embeddings cents. Check AWS Billing monthly.
- Data is stored in Australia: a cross-border transfer under Sri Lanka's PDPA 2022 (include in the
  pre-launch legal review).
- Long admin AI calls (feedback review) wait inside the request; Caddy has no timeout, but a
  browser or network may give up after a few minutes.
