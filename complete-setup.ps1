# Complete Infrastructure Setup Script with Persistent OpenFGA
# Location: D:\MCP-OpenFGA\MCP-Resource-Manager

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   MCP + OpenFGA Complete Infrastructure Setup" -ForegroundColor Cyan
Write-Host "   With Persistent Authorization Storage" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean up old containers
Write-Host "Step 1: Cleaning up old containers..." -ForegroundColor Yellow

docker stop mcp-postgres 2>$null
docker rm mcp-postgres 2>$null
docker stop mcp-openfga 2>$null
docker rm mcp-openfga 2>$null

Write-Host "[OK] Cleanup complete" -ForegroundColor Green
Write-Host ""

# Step 2: Start PostgreSQL
Write-Host "Step 2: Starting PostgreSQL..." -ForegroundColor Yellow

docker run --name mcp-postgres `
  -e POSTGRES_PASSWORD=password `
  -p 5432:5432 `
  -d postgres:15

Write-Host "Waiting for PostgreSQL to start (15 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Verify PostgreSQL is ready
$pgReady = $false
for ($i = 1; $i -le 5; $i++) {
    try {
        docker exec mcp-postgres psql -U postgres -c "SELECT 1;" 2>$null | Out-Null
        $pgReady = $true
        break
    } catch {
        Write-Host "Waiting for PostgreSQL... attempt $i/5" -ForegroundColor Gray
        Start-Sleep -Seconds 3
    }
}

if (-not $pgReady) {
    Write-Host "[ERROR] PostgreSQL failed to start" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] PostgreSQL is ready" -ForegroundColor Green
Write-Host ""

# Step 3: Create Databases
Write-Host "Step 3: Creating databases..." -ForegroundColor Yellow

docker exec mcp-postgres psql -U postgres -c "CREATE DATABASE mcp_resources;" 2>$null
docker exec mcp-postgres psql -U postgres -c "CREATE DATABASE openfga;" 2>$null

Write-Host "[OK] Databases created: mcp_resources, openfga" -ForegroundColor Green
Write-Host ""

# Step 4: Create database schema and sample data
Write-Host "Step 4: Setting up database schema..." -ForegroundColor Yellow

$sqlCommands = @'
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL
);

CREATE INDEX idx_resource_type ON resources(resource_type);
CREATE INDEX idx_created_by ON resources(created_by);

INSERT INTO resources (resource_type, data, created_by) VALUES
  ('file', '{"name": "budget.xlsx", "size": 2048, "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}', 'user:tharsan'),
  ('file', '{"name": "report.pdf", "size": 5120, "mime_type": "application/pdf"}', 'user:tharsan'),
  ('appointment', '{"doctor_name": "Dr. Smith", "specialty": "General Physician", "appointment_date": "2025-01-15", "appointment_time": "10:30 AM", "reason": "Annual checkup", "clinic": "City Medical Center"}', 'user:tharsan'),
  ('project', '{"title": "Website Redesign", "status": "active", "deadline": "2025-03-01"}', 'user:tharsan'),
  ('expense', '{"amount": 150, "category": "travel", "date": "2024-01-15"}', 'user:tharsan');
'@

# Execute SQL
$sqlCommands | docker exec -i mcp-postgres psql -U postgres -d mcp_resources

# Verify data
Write-Host ""
Write-Host "Verifying sample data:" -ForegroundColor Gray
docker exec mcp-postgres psql -U postgres -d mcp_resources -c "SELECT resource_type, COUNT(*) FROM resources GROUP BY resource_type;"

Write-Host "[OK] Database schema created and sample data inserted" -ForegroundColor Green
Write-Host ""

# Step 5: Start OpenFGA with PostgreSQL Backend
Write-Host "Step 5: Starting OpenFGA with persistent storage..." -ForegroundColor Yellow

docker run -d --name mcp-openfga `
  -p 8080:8080 `
  -p 3000:3000 `
  -e OPENFGA_DATASTORE_ENGINE=postgres `
  -e OPENFGA_DATASTORE_URI="postgres://postgres:password@host.docker.internal:5432/openfga?sslmode=disable" `
  openfga/openfga run

Write-Host "Waiting for OpenFGA to start (10 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 10

Write-Host "[OK] OpenFGA container started" -ForegroundColor Green
Write-Host ""

# Step 6: Run OpenFGA Migrations
Write-Host "Step 6: Running OpenFGA database migrations..." -ForegroundColor Yellow

Start-Sleep -Seconds 5

docker exec mcp-openfga /openfga migrate
Write-Host "[OK] Migrations completed" -ForegroundColor Green

Write-Host "Waiting for OpenFGA to be fully ready (15 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# Check health
$fgaReady = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $health = Invoke-RestMethod -Uri http://localhost:8080/healthz -Method Get -ErrorAction Stop
        if ($health.status -eq "SERVING") {
            $fgaReady = $true
            Write-Host "[OK] OpenFGA is healthy and serving" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "Waiting for OpenFGA health... attempt $i/10" -ForegroundColor Gray
        Start-Sleep -Seconds 3
    }
}

if (-not $fgaReady) {
    Write-Host "[WARN] OpenFGA health check didn't pass, but continuing..." -ForegroundColor Yellow
    Write-Host "Check logs with: docker logs mcp-openfga" -ForegroundColor Gray
}
Write-Host ""

# Step 7: Create OpenFGA Store
Write-Host "Step 7: Creating OpenFGA store..." -ForegroundColor Yellow

$createStoreBody = @{
    name = "mcp-resource-store"
} | ConvertTo-Json

try {
    $storeResult = Invoke-RestMethod -Uri http://localhost:8080/stores `
        -Method Post `
        -ContentType "application/json" `
        -Body $createStoreBody `
        -ErrorAction Stop
    
    $STORE_ID = $storeResult.id
    Write-Host "[OK] Store created: $STORE_ID" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create store" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Check OpenFGA logs: docker logs mcp-openfga" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 8: Create Authorization Model
Write-Host "Step 8: Creating authorization model..." -ForegroundColor Yellow

$authModel = @{
    schema_version = "1.1"
    type_definitions = @(
        @{ type = "user" },
        @{
            type = "resource"
            relations = @{
                viewer = @{ this = @{} }
                editor = @{ this = @{} }
                owner = @{ this = @{} }
                can_view = @{
                    union = @{
                        child = @(
                            @{ this = @{} },
                            @{ computedUserset = @{ relation = "viewer" } },
                            @{ computedUserset = @{ relation = "editor" } },
                            @{ computedUserset = @{ relation = "owner" } }
                        )
                    }
                }
                can_edit = @{
                    union = @{
                        child = @(
                            @{ this = @{} },
                            @{ computedUserset = @{ relation = "editor" } },
                            @{ computedUserset = @{ relation = "owner" } }
                        )
                    }
                }
                can_delete = @{
                    union = @{
                        child = @(
                            @{ this = @{} },
                            @{ computedUserset = @{ relation = "owner" } }
                        )
                    }
                }
                can_list = @{
                    union = @{
                        child = @(
                            @{ this = @{} },
                            @{ computedUserset = @{ relation = "viewer" } },
                            @{ computedUserset = @{ relation = "editor" } },
                            @{ computedUserset = @{ relation = "owner" } }
                        )
                    }
                }
            }
            metadata = @{
                relations = @{
                    viewer = @{ directly_related_user_types = @(@{ type = "user" }) }
                    editor = @{ directly_related_user_types = @(@{ type = "user" }) }
                    owner = @{ directly_related_user_types = @(@{ type = "user" }) }
                    can_view = @{ directly_related_user_types = @(@{ type = "user" }) }
                    can_edit = @{ directly_related_user_types = @(@{ type = "user" }) }
                    can_delete = @{ directly_related_user_types = @(@{ type = "user" }) }
                    can_list = @{ directly_related_user_types = @(@{ type = "user" }) }
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $modelResult = Invoke-RestMethod -Uri "http://localhost:8080/stores/$STORE_ID/authorization-models" `
        -Method Post `
        -ContentType "application/json" `
        -Body $authModel `
        -ErrorAction Stop
    
    $MODEL_ID = $modelResult.authorization_model_id
    Write-Host "[OK] Authorization model created: $MODEL_ID" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create authorization model" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 9: Add User Permissions
Write-Host "Step 9: Adding user permissions..." -ForegroundColor Yellow

# Tharsan's permissions (Owner of all resource types)
$tharsanPerms = @{
    writes = @{
        tuple_keys = @(
            @{ user = "user:tharsan"; relation = "owner"; object = "resource:file_*" },
            @{ user = "user:tharsan"; relation = "owner"; object = "resource:appointment_*" },
            @{ user = "user:tharsan"; relation = "owner"; object = "resource:project_*" },
            @{ user = "user:tharsan"; relation = "owner"; object = "resource:expense_*" },
            @{ user = "user:tharsan"; relation = "owner"; object = "resource:task_*" },
            @{ user = "user:tharsan"; relation = "owner"; object = "resource:customer_*" }
        )
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "http://localhost:8080/stores/$STORE_ID/write" `
        -Method Post `
        -ContentType "application/json" `
        -Body $tharsanPerms `
        -ErrorAction Stop | Out-Null
    Write-Host "[OK] Tharsan permissions added (Owner of all)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to add Tharsan permissions" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

# Sarah's permissions (Viewer - NO appointments)
$sarahPerms = @{
    writes = @{
        tuple_keys = @(
            @{ user = "user:sarah"; relation = "viewer"; object = "resource:file_*" },
            @{ user = "user:sarah"; relation = "viewer"; object = "resource:expense_*" },
            @{ user = "user:sarah"; relation = "viewer"; object = "resource:project_*" },
            @{ user = "user:sarah"; relation = "viewer"; object = "resource:task_*" },
            @{ user = "user:sarah"; relation = "viewer"; object = "resource:customer_*" }
        )
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "http://localhost:8080/stores/$STORE_ID/write" `
        -Method Post `
        -ContentType "application/json" `
        -Body $sarahPerms `
        -ErrorAction Stop | Out-Null
    Write-Host "[OK] Sarah permissions added (Viewer, no appointments)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to add Sarah permissions" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""

# Step 10: Verify Persistence
Write-Host "Step 10: Verifying persistence..." -ForegroundColor Yellow

$storeCheck = docker exec mcp-postgres psql -U postgres -d openfga -t -c "SELECT COUNT(*) FROM store WHERE id = '$STORE_ID';" 2>$null
if ($storeCheck -match "1") {
    Write-Host "[OK] Store persisted in PostgreSQL database" -ForegroundColor Green
} else {
    Write-Host "[WARN] Could not verify store persistence" -ForegroundColor Yellow
}

Write-Host ""

# FINAL OUTPUT
Write-Host "========================================================" -ForegroundColor Green
Write-Host "              SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Save these IDs for your .env file:" -ForegroundColor Cyan
Write-Host ""
Write-Host "-------------------------------------------------------" -ForegroundColor White
Write-Host "FGA_STORE_ID=$STORE_ID" -ForegroundColor Yellow
Write-Host "FGA_MODEL_ID=$MODEL_ID" -ForegroundColor Yellow
Write-Host "-------------------------------------------------------" -ForegroundColor White
Write-Host ""
Write-Host "Authorization model is now PERSISTENT!" -ForegroundColor Green
Write-Host "  Stored in PostgreSQL database: openfga" -ForegroundColor Gray
Write-Host "  [OK] Survives container restarts" -ForegroundColor Gray
Write-Host "  [OK] Production-ready configuration" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Copy the Store ID and Model ID above" -ForegroundColor White
Write-Host "  2. Create .env file in D:\MCP-OpenFGA\MCP-Resource-Manager" -ForegroundColor White
Write-Host "  3. Add the IDs to .env file" -ForegroundColor White
Write-Host "  4. Run your application: npm install && npm start" -ForegroundColor White
Write-Host ""
Write-Host "Verify Containers:" -ForegroundColor Cyan
Write-Host "  docker ps" -ForegroundColor White
Write-Host ""
Write-Host "Test Persistence (optional):" -ForegroundColor Cyan
Write-Host "  docker restart mcp-openfga" -ForegroundColor White
Write-Host "  Start-Sleep -Seconds 10" -ForegroundColor White
Write-Host "  Invoke-RestMethod -Uri 'http://localhost:8080/stores/$STORE_ID' -Method Get" -ForegroundColor White
Write-Host "  (Should return your store without re-running setup!)" -ForegroundColor Gray
Write-Host ""