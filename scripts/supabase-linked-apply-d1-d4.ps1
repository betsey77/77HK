[CmdletBinding()]
param(
  [string]$ExpectedProjectRef = 'wzpaghnxlpfjojvuxplx'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectRefPath = Join-Path $projectRoot 'supabase/.temp/project-ref'
$actualProjectRef = (Get-Content -LiteralPath $projectRefPath -Raw -Encoding UTF8).Trim()
$expectedMigrations = @(
  '20260719090000_slice_d1_checkin_rewards.sql',
  '20260719120000_slice_d4_activity_model_telemetry.sql'
)

if ($actualProjectRef -ne $ExpectedProjectRef) {
  throw "Refusing migration: linked project '$actualProjectRef' does not match staging '$ExpectedProjectRef'"
}

foreach ($migration in $expectedMigrations) {
  $migrationPath = Join-Path $projectRoot "supabase/migrations/$migration"
  if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) {
    throw "Refusing migration: expected file is missing: $migration"
  }
}

Write-Host "Target confirmed: 77HK-staging ($actualProjectRef)"
Write-Host "Authorized migrations: $($expectedMigrations -join ', ')"
$securePassword = Read-Host 'Supabase staging Database Password' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)

  Write-Host '=== final pre-push dry-run ==='
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $dryRunOutput = & npx supabase db push --linked --dry-run 2>&1
    $dryRunExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  $dryRunOutput | ForEach-Object { Write-Host $_ }
  if ($dryRunExitCode -ne 0) {
    throw 'Final dry-run failed; no migration was applied'
  }

  $migrationPattern = '\d{14}_[A-Za-z0-9_-]+\.sql'
  $actualMigrations = @(
    [regex]::Matches(($dryRunOutput -join "`n"), $migrationPattern) |
      ForEach-Object { $_.Value } |
      Sort-Object -Unique
  )
  $migrationDiff = @(Compare-Object -ReferenceObject $expectedMigrations -DifferenceObject $actualMigrations)
  if ($migrationDiff.Count -ne 0) {
    throw "Refusing migration: final dry-run does not contain exactly the two authorized files (actual: $($actualMigrations -join ', '))"
  }

  Write-Host '=== applying authorized migrations once ==='
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & npx supabase db push --linked --yes
    $pushExitCode = $LASTEXITCODE

    Write-Host '=== post-push migration list (read-only) ==='
    & npx supabase migration list --linked
    $historyExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($pushExitCode -ne 0) {
    throw 'db push returned an error; do not retry until the migration history above is inspected'
  }
  if ($historyExitCode -ne 0) {
    throw 'db push returned success but post-push history check failed; do not retry'
  }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  $securePassword = $null
  $passwordPtr = [IntPtr]::Zero
}
