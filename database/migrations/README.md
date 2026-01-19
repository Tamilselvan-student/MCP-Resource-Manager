# Database Migration Scripts - Authentication System

## Overview

Production-ready SQL migration scripts for adding authentication to the MCP-Resource-Manager system.

## Files

1. **`00_backup_users_table.sql`** - Creates timestamped backup
2. **`01_add_authentication_columns.sql`** - Adds authentication columns (5 phases)
3. **`99_rollback_authentication_migration.sql`** - Complete rollback
4. **`TEST_migration.sql`** - Comprehensive 7-stage test workflow

## Quick Start

### Option 1: Run Complete Test (Recommended)

```powershell
# Using Docker
Get-Content database\migrations\TEST_migration.sql | docker exec -i mcp-postgres psql -U postgres -d mcp_resources

# Using psql directly
psql -U postgres -d mcp_resources -f database/migrations/TEST_migration.sql
```

This runs all 7 stages interactively:
1. Pre-migration state
2. Backup
3. Migration
4. Login simulation
5. Rollback test
6. Final migration
7. Summary report

### Option 2: Manual Step-by-Step

```powershell
# Step 1: Backup
Get-Content database\migrations\00_backup_users_table.sql | docker exec -i mcp-postgres psql -U postgres -d mcp_resources

# Step 2: Migrate
Get-Content database\migrations\01_add_authentication_columns.sql | docker exec -i mcp-postgres psql -U postgres -d mcp_resources

# Step 3: Verify
docker exec mcp-postgres psql -U postgres -d mcp_resources -c "SELECT user_id, username, email, must_change_password, is_active FROM users;"
```

## Migration Details

### Backup Script (`00_backup_users_table.sql`)

**Features:**
- ✅ Dynamic timestamp: `users_backup_YYYYMMDD_HH24MISS`
- ✅ Idempotent (checks if backup exists)
- ✅ Row count verification
- ✅ Success message with backup table name

**Output:**
```
✓ Backup created: users_backup_20260117_143022
✓ Verified: 3 rows copied from users table
```

### Migration Script (`01_add_authentication_columns.sql`)

**5 Phases:**

1. **Add columns as NULLABLE**
   - `email`, `password_hash`, `must_change_password`, `last_login`, `is_active`

2. **Populate with defaults**
   - Email: `{username}@example.com`
   - Password: `changeme123` (bcrypt hash)
   - Must change: `TRUE`
   - Active: `TRUE`

3. **Add constraints**
   - NOT NULL on required fields
   - UNIQUE constraint on email

4. **Create indexes**
   - Index on email for fast lookups

5. **Verification**
   - Display all migrated users
   - Success message

**Transaction-wrapped** - All or nothing!

### Rollback Script (`99_rollback_authentication_migration.sql`)

**Actions:**
- Drops index `idx_users_email`
- Drops constraint `users_email_unique`
- Drops all 5 authentication columns
- Preserves original data (user_id, username, role, etc.)
- Shows table structure and data

**Output:**
```
✓ Rollback completed. Table restored to original state.
```

### Test Script (`TEST_migration.sql`)

**7 Interactive Stages:**

1. **Pre-Migration State** - Shows current table structure
2. **Run Backup** - Creates timestamped backup
3. **Run Migration** - Adds authentication columns
4. **Login Simulation** - Tests login readiness
5. **Test Rollback** - Verifies rollback works
6. **Final Migration** - Re-applies migration
7. **Summary Report** - Complete status overview

**Features:**
- ✅ Interactive prompts between stages
- ✅ Emoji indicators (✅ ❌ ⚠️ ℹ️)
- ✅ Clear section headers
- ✅ Comprehensive verification
- ✅ Final summary with login credentials

## Default Credentials After Migration

All users will have:
- **Email**: `{username}@example.com`
- **Password**: `changeme123`
- **Must Change Password**: `TRUE`

**Examples:**
- `tharsan@example.com` / `changeme123`
- `sarah@example.com` / `changeme123`
- `admin@example.com` / `changeme123`

## Verification Queries

```sql
-- Check all users have authentication
SELECT 
    user_id,
    username,
    email,
    CASE WHEN password_hash IS NOT NULL THEN '✅ CAN LOGIN' ELSE '❌ NO PASSWORD' END as login_status,
    CASE WHEN must_change_password THEN '⚠️ MUST CHANGE' ELSE '✅ PASSWORD OK' END as password_status
FROM users;

-- Count statistics
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as users_with_email,
    COUNT(CASE WHEN password_hash IS NOT NULL THEN 1 END) as users_with_password,
    COUNT(CASE WHEN must_change_password = TRUE THEN 1 END) as must_change_count
FROM users;
```

## Rollback Procedure

If something goes wrong:

```powershell
Get-Content database\migrations\99_rollback_authentication_migration.sql | docker exec -i mcp-postgres psql -U postgres -d mcp_resources
```

## Safety Features

✅ **Transaction-wrapped** - Migration is atomic
✅ **Idempotent** - Safe to run multiple times
✅ **Dynamic timestamps** - No hardcoded dates
✅ **Backup verification** - Row counts checked
✅ **Complete rollback** - Restore to original state
✅ **Comprehensive testing** - 7-stage test workflow

## Password Hash

The default password hash is:
```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

This is bcrypt hash of `changeme123` with 10 salt rounds.

## Troubleshooting

**Issue**: Backup table already exists
- **Solution**: Script skips backup creation, uses existing backup

**Issue**: Migration fails mid-way
- **Solution**: Transaction rolls back automatically, no partial state

**Issue**: Need to undo migration
- **Solution**: Run rollback script to restore original state

**Issue**: Want to test without affecting production
- **Solution**: Run `TEST_migration.sql` which tests rollback before final migration

## Next Steps

After successful migration:
1. ✅ Users table has authentication columns
2. ✅ All users can login with default credentials
3. ✅ Backup table exists for safety
4. 🚀 Proceed to Phase 2: Authentication Backend
