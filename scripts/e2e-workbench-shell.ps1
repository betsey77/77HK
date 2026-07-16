#Requires -Version 5.1
<#
.SYNOPSIS
  Local workbench shell smoke: mock auth + isolated Vite :5174 + no remote network.

.DESCRIPTION
  Uses Node 22 + ASCII cwd C:\work\77hk-workbench-e2e (independent of public-smoke mirror).
  Starts client/vite.e2e.config.ts (Auth/Supabase fixtures via alias).
  Playwright blocks non-localhost hosts.
  Spec covers desktop/mobile shell smoke plus local case-library CRUD
  (memory mock GET/POST/PATCH/DELETE; dark + light screenshots).

.EXAMPLE
  powershell -File scripts/e2e-workbench-shell.ps1 -SelfTest
  powershell -File scripts/e2e-workbench-shell.ps1 -Twice
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = '',
  [string]$AsciiRoot = 'C:\work\77hk-workbench-e2e',
  [string]$Node22Home = '',
  [string]$EvidenceDir = '',
  # Default 5184: avoid clashing with common 5173 (user Vite) and any stuck 5174 listeners.
  [int]$E2ePort = 5184,
  [switch]$Twice,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$MarkerName = '.77hk-workbench-e2e-harness-marker'
$ToolId = '77hk-workbench-shell-smoke-v1'

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}
if ([string]::IsNullOrWhiteSpace($Node22Home)) {
  $Node22Home = Join-Path $env:LOCALAPPDATA 'nodejs-versions\node-v22.23.1-win-x64'
}

function Get-FullPathNormalized([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'empty path' }
  return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Get-Node22Exe {
  param([string]$HomeDir)
  if ($HomeDir -and (Test-Path -LiteralPath (Join-Path $HomeDir 'node.exe'))) {
    $exe = Join-Path $HomeDir 'node.exe'
    $ver = & $exe --version 2>&1
    if ($ver -notmatch '^v22\.') { throw "Need Node 22.x; got $ver ($exe)" }
    return $exe
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { throw 'Node 22 not found' }
  $ver = & $cmd.Source --version 2>&1
  if ($ver -notmatch '^v22\.') { throw "Need Node 22.x; got $ver from $($cmd.Source)" }
  return $cmd.Source
}

function Test-IsDirectoryJunction([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $item = Get-Item -LiteralPath $Path -Force
  if (-not $item.PSIsContainer) { return $false }
  $isReparse = ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
  if (-not $isReparse) { return $false }
  if ($null -ne $item.LinkType -and $item.LinkType -ne '' -and $item.LinkType -ne 'Junction') {
    return $false
  }
  return $true
}

function Get-JunctionTargetPath([string]$Path) {
  $item = Get-Item -LiteralPath $Path -Force
  $t = $item.Target
  if ($null -eq $t) { throw "Cannot resolve junction target: $Path" }
  if ($t -is [System.Array]) { $t = $t[0] }
  return (Get-FullPathNormalized ([string]$t))
}

function Remove-HarnessJunctionFailClosed {
  param([string]$LinkPath, [string]$ExpectedTarget)
  $expected = Get-FullPathNormalized $ExpectedTarget
  if (-not (Test-Path -LiteralPath $LinkPath)) { return }
  if (-not (Test-IsDirectoryJunction -Path $LinkPath)) {
    throw "REFUSE: not a Directory Junction: $LinkPath"
  }
  $actual = Get-JunctionTargetPath -Path $LinkPath
  if ($actual -ne $expected) {
    throw "REFUSE: junction target mismatch path=$LinkPath actual=$actual expected=$expected"
  }
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'rmdir', "`"$LinkPath`"") -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { throw "rmdir junction failed: $LinkPath" }
  if (Test-Path -LiteralPath $LinkPath) { throw "junction still exists: $LinkPath" }
}

function Write-HarnessMarker([string]$Root, [string]$Repo) {
  $body = @(
    "tool=$ToolId"
    "repo=$(Get-FullPathNormalized $Repo)"
    "createdUtc=$((Get-Date).ToUniversalTime().ToString('o'))"
  ) -join "`n"
  Set-Content -LiteralPath (Join-Path $Root $MarkerName) -Value $body -Encoding UTF8
}

function Assert-AsciiRootOwnedOrAbsent([string]$Root, [string]$Repo) {
  $rootFull = Get-FullPathNormalized $Root
  $repoFull = Get-FullPathNormalized $Repo
  $markerPath = Join-Path $rootFull $MarkerName
  if (-not (Test-Path -LiteralPath $rootFull)) { return }

  if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
    $meta = Get-Content -LiteralPath $markerPath -Raw
    if ($meta -notmatch [regex]::Escape("tool=$ToolId")) { throw "REFUSE: marker tool mismatch $markerPath" }
    if ($meta -notmatch [regex]::Escape("repo=$repoFull")) { throw "REFUSE: marker repo mismatch $markerPath" }
    return
  }

  $proven = 0
  foreach ($name in @('node_modules', 'client', 'server')) {
    $link = Join-Path $rootFull $name
    $target = Join-Path $repoFull $name
    if (-not (Test-Path -LiteralPath $link)) { continue }
    if (-not (Test-IsDirectoryJunction -Path $link)) {
      throw "REFUSE: unmarked root has non-junction $link"
    }
    if ((Get-JunctionTargetPath -Path $link) -ne (Get-FullPathNormalized $target)) {
      throw "REFUSE: unmarked root junction mismatch $link"
    }
    $proven++
  }
  if ($proven -lt 1) {
    throw "REFUSE: ASCII root exists without marker/proven junctions: $rootFull (use a non-existent path)"
  }
  Write-Host "Reclaiming workbench ASCII root after $proven junction(s)"
  Write-HarnessMarker -Root $rootFull -Repo $repoFull
}

function Ensure-AsciiWorkspace([string]$Root, [string]$Repo) {
  $rootFull = Get-FullPathNormalized $Root
  $repoFull = Get-FullPathNormalized $Repo
  Assert-AsciiRootOwnedOrAbsent -Root $rootFull -Repo $repoFull
  if (-not (Test-Path -LiteralPath $rootFull)) {
    New-Item -ItemType Directory -Path $rootFull | Out-Null
  }
  $e2eDir = Join-Path $rootFull 'e2e'
  if (-not (Test-Path -LiteralPath $e2eDir)) {
    New-Item -ItemType Directory -Path $e2eDir | Out-Null
  }
  Copy-Item (Join-Path $repoFull 'package.json') $rootFull -Force
  Copy-Item (Join-Path $repoFull 'playwright.workbench-local.config.mjs') $rootFull -Force
  Copy-Item (Join-Path $repoFull 'e2e\workbench-shell-local.spec.ts') $e2eDir -Force
  if (Test-Path (Join-Path $repoFull 'package-lock.json')) {
    Copy-Item (Join-Path $repoFull 'package-lock.json') $rootFull -Force
  }
  foreach ($name in @('node_modules', 'client', 'server')) {
    $link = Join-Path $rootFull $name
    $target = Get-FullPathNormalized (Join-Path $repoFull $name)
    if (-not (Test-Path -LiteralPath $target)) { throw "missing $target" }
    if (Test-Path -LiteralPath $link) {
      Remove-HarnessJunctionFailClosed -LinkPath $link -ExpectedTarget $target
    }
    $mk = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'mklink', '/J', "`"$link`"", "`"$target`"") -Wait -PassThru -NoNewWindow
    if ($mk.ExitCode -ne 0) { throw "mklink failed $link" }
  }
  Write-HarnessMarker -Root $rootFull -Repo $repoFull
}

function Test-PortFree([int]$Port) {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    throw "Port $Port is already in use. Free it or stop the process; this script will not kill it or switch ports."
  }
}

function Test-FixturesLocalOnly([string]$Repo) {
  $files = @(
    (Join-Path $Repo 'client\src\e2e\supabase.fixture.ts'),
    (Join-Path $Repo 'client\src\e2e\authContext.fixture.tsx'),
    (Join-Path $Repo 'client\vite.e2e.config.ts'),
    (Join-Path $Repo 'e2e\workbench-shell-local.spec.ts')
  )
  # Generic production-like markers only — no hard-coded real project ref.
  # Intentionally does NOT flag clearly invalid e2e-local placeholders
  # (e.g. access_token: 'e2e-local-not-a-jwt', provider: 'e2e-local').
  $deny = @(
    'supabase\.co',
    'https?://[a-z0-9]{10,}\.supabase\.',   # hosted project URL shape
    'sb-[a-z0-9]+-auth-token',
    'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',  # real JWT shape (3 segments)
    '(?i)\bservice_role\b',
    '(?i)\bservice[_-]?key\b',
    '(?i)\bproject[_-]?ref\b\s*[:=]\s*[''"]?[a-z0-9]{10,}',
    'VITE_SUPABASE_URL\s*[:=]\s*[''"]https?',
    'VITE_SUPABASE_(?:ANON|PUBLISHABLE|SERVICE)[_A-Z]*\s*[:=]\s*[''"]eyJ'
  )
  foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f)) { throw "missing fixture/spec: $f" }
    $text = Get-Content -LiteralPath $f -Raw
    foreach ($pat in $deny) {
      if ($text -match $pat) {
        throw "REFUSE: production-like pattern /$pat/ found in $f"
      }
    }
    if ($text -notmatch 'e2e@example\.invalid' -and $f -match 'fixture') {
      # supabase + auth fixtures must use .invalid email
      if ($f -match 'supabase\.fixture|authContext\.fixture') {
        throw "REFUSE: fixture must use e2e@example.invalid — $f"
      }
    }
    # e2e-local placeholders must remain obviously non-production
    if ($f -match 'supabase\.fixture|authContext\.fixture') {
      if ($text -notmatch 'e2e-local') {
        throw "REFUSE: fixture should use e2e-local placeholder markers — $f"
      }
    }
  }
  Write-Host 'OK fixtures: no supabase.co / real JWT / service key / project-url patterns (e2e-local placeholders allowed)'
}

function Invoke-FailClosedSelfTest([string]$Repo) {
  Write-Host '===== SelfTest: workbench harness ====='
  Test-FixturesLocalOnly -Repo $Repo

  $tmp = Join-Path $env:TEMP ("77hk-wb-selftest-" + [guid]::NewGuid().ToString('n'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    $plain = Join-Path $tmp 'client'
    New-Item -ItemType Directory -Path $plain | Out-Null
    $threw = $false
    try { Remove-HarnessJunctionFailClosed -LinkPath $plain -ExpectedTarget (Join-Path $tmp 'x') } catch { $threw = $true }
    if (-not $threw) { throw 'plain dir not refused' }
    if (-not (Test-Path $plain)) { throw 'plain dir destroyed' }
    Write-Host 'OK refuse plain directory'

    $alien = Join-Path $tmp 'alien'
    New-Item -ItemType Directory -Path $alien | Out-Null
    $threw2 = $false
    try { Assert-AsciiRootOwnedOrAbsent -Root $alien -Repo $Repo } catch { $threw2 = $true }
    if (-not $threw2) { throw 'unmarked root not refused' }
    Write-Host 'OK refuse unmarked ASCII root'

    # Spec must declare network guard
    $spec = Get-Content (Join-Path $Repo 'e2e\workbench-shell-local.spec.ts') -Raw
    if ($spec -notmatch 'blockedHosts' -or $spec -notmatch 'isLocalHost') {
      throw 'spec missing non-localhost network guard'
    }
    if ($spec -match 'user-authored-review-queue') {
      throw 'spec must not reference user-authored-review-queue'
    }
    Write-Host 'OK spec network guard present; no review-queue reuse'
    Write-Host '===== SelfTest PASS ====='
  } finally {
    if ($tmp -like (Join-Path $env:TEMP '77hk-wb-selftest-*')) {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-PlaywrightCliPids {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -match 'playwright\.workbench-local' -or
        ($_.CommandLine -match '@playwright\\test\\cli' -and $_.CommandLine -match 'workbench-shell-local')
      )
    } |
    ForEach-Object { $_.ProcessId }
}

function Get-ViteE2ePids([int]$Port) {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and $_.CommandLine -match 'vite\.e2e\.config' -and $_.CommandLine -match "$Port"
    } |
    ForEach-Object { $_.ProcessId }
}

function Stop-PidTree([int]$ProcId) {
  if ($ProcId -le 0) { return }
  Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/F', '/T', '/PID', "$ProcId") -Wait -NoNewWindow -ErrorAction SilentlyContinue | Out-Null
}

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return }
    } catch {
      Start-Sleep -Milliseconds 400
    }
  }
  throw "Timed out waiting for $Url"
}

# ---- SelfTest ----
$RepoRoot = Get-FullPathNormalized $RepoRoot
if ($SelfTest) {
  Invoke-FailClosedSelfTest -Repo $RepoRoot
  exit 0
}

# ---- Main ----
$AsciiRoot = Get-FullPathNormalized $AsciiRoot
if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
  $EvidenceDir = Join-Path $RepoRoot 'docs\evidence\2026-07-15\workbench-shell-local-smoke'
}
$EvidenceDir = Get-FullPathNormalized $EvidenceDir
$ShotDir = Join-Path $EvidenceDir 'screenshots'
$TestOutputPath = Join-Path $EvidenceDir 'test-output.txt'
New-Item -ItemType Directory -Force -Path $ShotDir | Out-Null

$nodeExe = Get-Node22Exe -HomeDir $Node22Home
$nodeDir = Split-Path $nodeExe -Parent
$env:PATH = "$nodeDir;C:\Windows\System32;C:\Windows;$env:PATH"
$nodeVer = & $nodeExe --version

Write-Host "node=$nodeVer path=$nodeExe"
Write-Host "repo=$RepoRoot"
Write-Host "asciiCwd=$AsciiRoot"
Write-Host "e2ePort=$E2ePort"
Write-Host "evidence=$EvidenceDir"

Test-PortFree -Port $E2ePort
Ensure-AsciiWorkspace -Root $AsciiRoot -Repo $RepoRoot
Set-Location -LiteralPath $AsciiRoot

$env:E2E_SCREENSHOT_DIR = $ShotDir
$env:E2E_WORKBENCH_BASE_URL = "http://127.0.0.1:$E2ePort"

$logHeader = @"
# workbench-shell local smoke
# utc=$((Get-Date).ToUniversalTime().ToString('o'))
# node=$nodeVer
# nodePath=$nodeExe
# repo=$RepoRoot
# asciiCwd=$AsciiRoot
# baseURL=$($env:E2E_WORKBENCH_BASE_URL)
# E2E_SCREENSHOT_DIR=$ShotDir
# NOTE: local mock shell only — not real Auth/RLS/payment

"@
Set-Content -LiteralPath $TestOutputPath -Value $logHeader -Encoding UTF8

# Start isolated E2E Vite from the REAL client path (not the ASCII junction).
# On Windows, launching Vite through a junction whose target contains non-ASCII
# characters can corrupt the resolved id (main.tsx 404 / blank page).
# Playwright still runs from $AsciiRoot to avoid the Chinese-path worker hang.
$clientDir = Get-FullPathNormalized (Join-Path $RepoRoot 'client')
$viteJs = Get-FullPathNormalized (Join-Path $RepoRoot 'node_modules\vite\bin\vite.js')
if (-not (Test-Path -LiteralPath $viteJs)) { throw "missing vite: $viteJs" }
if (-not (Test-Path -LiteralPath (Join-Path $clientDir 'vite.e2e.config.ts'))) {
  throw "missing vite.e2e.config.ts under $clientDir"
}
$viteArgs = @(
  $viteJs,
  '--config', 'vite.e2e.config.ts',
  '--host', '127.0.0.1',
  '--port', "$E2ePort",
  '--strictPort'
)
Write-Host "Starting E2E Vite in $clientDir (real repo client path) ..."
$viteProc = Start-Process -FilePath $nodeExe -ArgumentList $viteArgs -WorkingDirectory $clientDir -PassThru -WindowStyle Hidden
$vitePid = $viteProc.Id
Write-Host "vitePid=$vitePid"

try {
  Wait-HttpOk -Url "http://127.0.0.1:$E2ePort/" -TimeoutSec 90

  $pwArgs = @(
    '.\node_modules\@playwright\test\cli.js', 'test',
    '--config=playwright.workbench-local.config.mjs',
    '--project=chromium',
    '--reporter=list',
    '--workers=1'
  )

  function Invoke-Focused([string]$Label) {
    Write-Host "===== $Label ====="
    $before = @(Get-PlaywrightCliPids)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & $nodeExe @pwArgs 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    $sw.Stop()
    $text = ($out -join "`n")
    Add-Content -LiteralPath $TestOutputPath -Value "`n===== $Label =====`nexit=$code`nelapsed_ms=$($sw.ElapsedMilliseconds)`n`n$text`n" -Encoding UTF8
    Write-Host $text
    Write-Host "===== $Label end exit=$code ====="
    Start-Sleep -Milliseconds 400
    $after = @(Get-PlaywrightCliPids)
    $leaked = @($after | Where-Object { $before -notcontains $_ })
    if ($leaked.Count -gt 0) { throw "Playwright CLI leftover after $Label : $($leaked -join ',')" }
    if ($code -ne 0) { throw "Playwright failed $Label exit=$code" }
    if ($text -notmatch '\d+ passed') { throw "No passed summary in $Label output" }
  }

  Invoke-Focused 'RUN1'
  if ($Twice) { Invoke-Focused 'RUN2' }

  $shots = @(Get-ChildItem -LiteralPath $ShotDir -Filter '*.png' -ErrorAction SilentlyContinue)
  Write-Host "screenshots_count=$($shots.Count)"
  # desktop + 3 mobile + case-library-dark + case-library-light
  if ($shots.Count -lt 6) {
    throw "Expected >=6 screenshots (desktop/mobile/case-library dark+light) under $ShotDir; got $($shots.Count)"
  }
  $shotNames = ($shots | ForEach-Object { $_.Name }) -join ' '
  if ($shotNames -notmatch 'case-library-dark') {
    throw "Missing case-library-dark screenshot under $ShotDir"
  }
  if ($shotNames -notmatch 'case-library-light') {
    throw "Missing case-library-light screenshot under $ShotDir"
  }

  Write-Host 'OK workbench shell local smoke finished (mock only; includes case-library E2E).'
}
finally {
  Write-Host "Stopping E2E Vite pid=$vitePid"
  if ($viteProc -and -not $viteProc.HasExited) {
    Stop-PidTree -ProcId $vitePid
  }
  # Also clear any vite.e2e leftovers for this port
  foreach ($p in @(Get-ViteE2ePids -Port $E2ePort)) {
    Write-Host "cleanup vite-e2e pid=$p"
    Stop-PidTree -ProcId $p
  }
  Start-Sleep -Milliseconds 500
  $leftVite = @(Get-ViteE2ePids -Port $E2ePort)
  $leftPw = @(Get-PlaywrightCliPids)
  if ($leftVite.Count -gt 0 -or $leftPw.Count -gt 0) {
    Write-Host "WARN residual vite=$($leftVite -join ',') pw=$($leftPw -join ',')"
  } else {
    Write-Host 'OK no residual workbench vite/playwright CLI'
  }
}
