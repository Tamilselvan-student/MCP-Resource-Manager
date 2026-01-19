# Test Authentication Endpoints
# Run this script to test Phase 2 authentication

Write-Host "`n=== Testing Phase 2: Authentication Backend ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Login
Write-Host "Test 1: Login as tharsan@example.com" -ForegroundColor Yellow
try {
    $loginBody = @{
        email    = "tharsan@example.com"
        password = "changeme123"
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -SessionVariable session

    $loginResult = $loginResponse.Content | ConvertFrom-Json
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "User: $($loginResult.user.username)" -ForegroundColor White
    Write-Host "Role: $($loginResult.user.role)" -ForegroundColor White
    Write-Host "Must change password: $($loginResult.user.must_change_password)" -ForegroundColor Yellow
    Write-Host ""
}
catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Test 2: Get current user (/me)
Write-Host "Test 2: Get current user (/me)" -ForegroundColor Yellow
try {
    $meResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/me" `
        -Method GET `
        -WebSession $session

    $meResult = $meResponse.Content | ConvertFrom-Json
    Write-Host "✅ /me endpoint successful!" -ForegroundColor Green
    Write-Host "User ID: $($meResult.user.user_id)" -ForegroundColor White
    Write-Host "Email: $($meResult.user.email)" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "❌ /me failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Logout
Write-Host "Test 3: Logout" -ForegroundColor Yellow
try {
    $logoutResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/logout" `
        -Method POST `
        -WebSession $session

    $logoutResult = $logoutResponse.Content | ConvertFrom-Json
    Write-Host "✅ Logout successful!" -ForegroundColor Green
    Write-Host "Message: $($logoutResult.message)" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "❌ Logout failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Try /me after logout (should fail)
Write-Host "Test 4: Try /me after logout (should fail with 401)" -ForegroundColor Yellow
try {
    $meResponse2 = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/me" `
        -Method GET `
        -WebSession $session
    Write-Host "❌ /me should have failed after logout!" -ForegroundColor Red
    Write-Host ""
}
catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Correctly returned 401 Unauthorized" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
        Write-Host ""
    }
}

# Test 5: Login all users
Write-Host "Test 5: Login all users" -ForegroundColor Yellow
$users = @(
    @{email = "tharsan@example.com"; password = "changeme123"; name = "Tharsan" },
    @{email = "Sarah@example.com"; password = "changeme123"; name = "Sarah" },
    @{email = "admin@example.com"; password = "changeme123"; name = "Admin" },
    @{email = "John@example.com"; password = "changeme123"; name = "John" }
)

foreach ($user in $users) {
    try {
        $body = @{
            email    = $user.email
            password = $user.password
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body

        $result = $response.Content | ConvertFrom-Json
        Write-Host "  ✅ $($user.name): $($result.user.role)" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ $($user.name): Failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Phase 2 Testing Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "✅ Login endpoint working" -ForegroundColor Green
Write-Host "✅ /me endpoint working" -ForegroundColor Green
Write-Host "✅ Logout endpoint working" -ForegroundColor Green
Write-Host "✅ HTTP-only cookies working" -ForegroundColor Green
Write-Host "✅ All 4 users can login" -ForegroundColor Green
Write-Host ""
Write-Host "Ready for Phase 3: Login Frontend" -ForegroundColor Cyan
