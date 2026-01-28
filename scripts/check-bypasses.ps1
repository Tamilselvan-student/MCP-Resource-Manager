Write-Host "=== Authorization Bypass Detection ==="

Write-Host "Checking for role-based bypasses..."
$roleBypass = Select-String -Path "src\*.ts" -Pattern "role === 'viewer'", "role === 'editor'" | Where-Object { $_.Line -notmatch "// admin" }
if ($roleBypass) {
    Write-Host "❌ FAIL: Found role-based bypasses"
    $roleBypass
}
else {
    Write-Host "✅ PASS: No role bypasses"
}

Write-Host "`nChecking for database flag bypasses..."
$flagBypass = Select-String -Path "src\*.ts" -Pattern "visible_to_viewer", "is_public" | Where-Object { $_.Line -match "if|return" }
if ($flagBypass) {
    Write-Host "❌ FAIL: Found potential flag bypasses"
    $flagBypass
}
else {
    Write-Host "✅ PASS: No flag bypasses"
}

Write-Host "`nChecking OpenFGA object format..."
$nameUsage = Select-String -Path "src\*.ts" -Pattern "resource:\${.*\.name}"
if ($nameUsage) {
    Write-Host "❌ FAIL: Using resource names instead of IDs"
    $nameUsage
}
else {
    Write-Host "✅ PASS: Using resource IDs"
}

Write-Host "`n=== Summary ==="
if (-not $roleBypass -and -not $flagBypass -and -not $nameUsage) {
    Write-Host "✅ All checks passed - No bypasses detected"
}
else {
    Write-Host "❌ Bypasses detected - Fix required"
}
