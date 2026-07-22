[CmdletBinding()]
param(
  [string]$ExpectedProjectRef = 'wzpaghnxlpfjojvuxplx'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectRefPath = Join-Path $projectRoot 'supabase/.temp/project-ref'
$actualProjectRef = (Get-Content -LiteralPath $projectRefPath -Raw -Encoding UTF8).Trim()
if ($actualProjectRef -ne $ExpectedProjectRef) {
  throw "Refusing dry-run: linked project '$actualProjectRef' does not match staging '$ExpectedProjectRef'"
}

Write-Host "Target confirmed: 77HK-staging ($actualProjectRef)"
$securePassword = Read-Host 'Supabase staging Database Password' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)

  Write-Host '=== migration list ==='
  & npx supabase migration list --linked
  if ($LASTEXITCODE -ne 0) {
    throw 'migration list failed; dry-run was not executed'
  }

  Write-Host '=== db push dry-run (no remote writes) ==='
  & npx supabase db push --linked --dry-run
  if ($LASTEXITCODE -ne 0) {
    throw 'db push dry-run failed'
  }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  $securePassword = $null
  $passwordPtr = [IntPtr]::Zero
}
