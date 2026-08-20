# KhataGST Backup & Disaster Recovery Runbook

## Overview

KhataGST uses **Neon Serverless PostgreSQL** as its primary database. This document covers backup strategy, restore procedures, and disaster recovery (DR) planning.

---

## 1. Neon Built-in Protection

Neon provides automatic protection out of the box:

| Feature | Detail |
|---------|--------|
| **Point-in-Time Restore (PITR)** | Available on paid plans (up to 30 days retention) |
| **Automatic Branching** | Create instant DB branches for testing or restore |
| **WAL Archiving** | Continuous Write-Ahead Log archival to object storage |

### Verify Your Neon Plan
1. Go to [Neon Console](https://console.neon.tech/)
2. Open your project → Settings → Plan
3. Ensure PITR is enabled (Scale or Business plan)

---

## 2. Manual Backup Strategy

Even with Neon's built-in protection, maintain independent backups:

### Weekly pg_dump Export
```bash
# Run this weekly (or add to cron)
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file="backup_khatagst_$(date +%Y%m%d).dump"
```

### Store Backups Off-Platform
Upload dumps to a separate cloud storage (not the same provider as Neon):
- AWS S3 bucket with versioning enabled
- Google Cloud Storage with lifecycle policies
- Any S3-compatible storage (Cloudflare R2, Backblaze B2)

---

## 3. Restore Procedures

### Option A: Neon Point-in-Time Restore
1. Go to Neon Console → Your Project → Branches
2. Click "Create Branch" → Select "From a point in time"
3. Pick the timestamp just before the incident
4. Update `DATABASE_URL` to point to the new branch
5. Verify data integrity
6. Promote the branch to main

### Option B: Restore from pg_dump
```bash
# Create a new Neon branch for restore
# Update DATABASE_URL to the new branch
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  backup_khatagst_20260820.dump
```

---

## 4. Recovery Targets

| Metric | Target | Current |
|--------|--------|---------|
| **RPO** (Recovery Point Objective) | < 1 hour | Neon WAL = near-zero data loss |
| **RTO** (Recovery Time Objective) | < 30 minutes | Branch restore = ~2 min |

---

## 5. Disaster Scenarios

### Scenario 1: Accidental Data Deletion
- **Action**: Use Neon PITR to branch from before deletion timestamp
- **Time to recover**: ~5 minutes

### Scenario 2: Neon Outage
- **Action**: Restore from latest pg_dump to a different PostgreSQL provider
- **Time to recover**: ~30 minutes (depends on dump size)

### Scenario 3: Corrupted Schema Migration
- **Action**: Neon branch from before migration, fix migration script, re-apply
- **Time to recover**: ~10 minutes

---

## 6. Testing Schedule

| What | Frequency |
|------|-----------|
| Verify Neon PITR works | Monthly |
| Test pg_dump restore | Quarterly |
| Review backup retention | Quarterly |

---

*Last updated: August 2026*
