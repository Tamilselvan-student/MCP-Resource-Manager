# Phase 2: Authentication Backend - Testing Guide

## Quick Test Commands

### 1. Test Login Endpoint

```powershell
# Login as tharsan
$response = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"tharsan@example.com","password":"changeme123"}' `
    -SessionVariable session

# View response
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Cookie should be set
$session.Cookies.GetCookies("http://localhost:3002")
```

### 2. Test /me Endpoint (with cookie)

```powershell
# Get current user info
$meResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/me" `
    -Method GET `
    -WebSession $session

$meResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### 3. Test Change Password

```powershell
# Change password
$changeResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/change-password" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"currentPassword":"changeme123","newPassword":"NewPassword123!"}' `
    -WebSession $session

$changeResponse.Content | ConvertFrom-Json
```

### 4. Test Logout

```powershell
# Logout
$logoutResponse = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/logout" `
    -Method POST `
    -WebSession $session

$logoutResponse.Content | ConvertFrom-Json
```

### 5. Test All Users

```powershell
# Test login for all users
$users = @(
    @{email="tharsan@example.com"; password="changeme123"},
    @{email="Sarah@example.com"; password="changeme123"},
    @{email="admin@example.com"; password="changeme123"},
    @{email="John@example.com"; password="changeme123"}
)

foreach ($user in $users) {
    Write-Host "`n=== Testing login for $($user.email) ===" -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/api/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body ($user | ConvertTo-Json)
        
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✅ Login successful" -ForegroundColor Green
        Write-Host "User: $($result.user.username)" -ForegroundColor White
        Write-Host "Role: $($result.user.role)" -ForegroundColor White
        Write-Host "Must change password: $($result.user.must_change_password)" -ForegroundColor Yellow
    } catch {
        Write-Host "❌ Login failed: $_" -ForegroundColor Red
    }
}
```

## Expected Results

### Login Response
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "user_id": "user:tharsan",
    "username": "tharsan",
    "email": "tharsan@example.com",
    "role": "admin",
    "must_change_password": true
  }
}
```

### /me Response
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "user_id": "user:tharsan",
    "username": "tharsan",
    "email": "tharsan@example.com",
    "role": "admin",
    "must_change_password": true,
    "last_login": "2026-01-17T15:30:00.000Z",
    "is_active": true
  }
}
```

### Change Password Response
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Logout Response
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Verification Checklist

- [ ] Login endpoint returns user object
- [ ] HTTP-only cookie is set after login
- [ ] /me endpoint returns user info with valid cookie
- [ ] /me endpoint returns 401 without cookie
- [ ] Change password works with correct current password
- [ ] Change password fails with incorrect current password
- [ ] Logout clears the cookie
- [ ] All 4 users can login successfully
- [ ] must_change_password is TRUE for all users

## Error Cases to Test

### Invalid Credentials
```powershell
# Wrong password
Invoke-WebRequest -Uri "http://localhost:3002/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"tharsan@example.com","password":"wrongpassword"}'
# Expected: 401 Unauthorized
```

### Missing Token
```powershell
# Access /me without cookie
Invoke-WebRequest -Uri "http://localhost:3002/api/auth/me" -Method GET
# Expected: 401 Unauthorized
```

### Weak Password
```powershell
# Try to change to weak password
Invoke-WebRequest -Uri "http://localhost:3002/api/auth/change-password" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"currentPassword":"changeme123","newPassword":"weak"}' `
    -WebSession $session
# Expected: 400 Bad Request (password too short)
```

## Next Steps After Testing

If all tests pass:
1. ✅ Phase 2 complete
2. 🚀 Ready for Phase 3: Login Frontend
3. Create login.html page
4. Implement login form
5. Add password visibility toggle
6. Implement "remember me"
