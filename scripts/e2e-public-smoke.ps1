#Requires -Version 5.1
<#
.SYNOPSIS
  Windows-safe focused public/protected Playwright smoke (Node 22 + ASCII cwd).

.DESCRIPTION
  Playwright workers can hang with zero reporter output when the monorepo root
  path contains non-ASCII characters. This script mirrors e2e/config into an
  ASCII workspace and junctions node_modules/client/server to the real repo.

  Safety (fail-closed):
  - Only removes paths that are proven Directory Junctions whose target is
    exactly this repository's corresponding folder.
  - Never rmdir /s, never recursive delete, never overwrite plain directories.
  - ASCII root must carry a marker file proving harness ownership, or be absent
    (then created empty).

  Evidence:
  - Sets E2E_SCREENSHOT_DIR to the repo evidence screenshots absolute path.
  - Appends focused run output to docs/evidence/.../test-output.txt when
    -EvidenceDir is used (default: this slice's harness evidence folder).

.EXAMPLE
  powershell -NoProfile -File scripts/e2e-public-smoke.ps1 -Twice
  powershell -NoProfile -File scripts/e2e-public-smoke.ps1 -SelfTest
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = '',
  [string]$AsciiRoot = 'C:\work\77hk-e2e',
  [string]$Node22Home = '',
  [string]$EvidenceDir = '',
  [switch]$Twice,
  [switch]$WithWebServer,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$MarkerName = '.77hk-e2e-harness-marker'
$ToolId = '77hk-e2e-public-smoke-v2'

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
  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw 'Get-FullPathNormalized: empty path'
  }
  return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Get-Node22Exe {
  param([string]$HomeDir)
  if ($HomeDir -and (Test-Path -LiteralPath (Join-Path $HomeDir 'node.exe'))) {
    $exe = Join-Path $HomeDir 'node.exe'
    $ver = & $exe --version 2>&1
    if ($ver -notmatch '^v22\.') {
      throw "Node22Home points to non-22 runtime: $ver ($exe)"
    }
    return $exe
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw 'Node 22 not found. Expected portable install under LOCALAPPDATA\nodejs-versions\node-v22.23.1-win-x64 or node 22.x on PATH.'
  }
  $ver = & $cmd.Source --version 2>&1
  if ($ver -notmatch '^v22\.') {
    throw "Need Node 22.x for this baseline; got $ver from $($cmd.Source). Refusing to run on non-22."
  }
  return $cmd.Source
}

function Test-IsDirectoryJunction {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $item = Get-Item -LiteralPath $Path -Force
  if (-not $item.PSIsContainer) { return $false }
  $isReparse = ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
  if (-not $isReparse) { return $false }
  # Prefer LinkType when available (Windows PowerShell 5+ / PS7)
  if ($null -ne $item.LinkType -and $item.LinkType -ne '' -and $item.LinkType -ne 'Junction') {
    return $false
  }
  return $true
}

function Get-JunctionTargetPath {
  param([Parameter(Mandatory)][string]$Path)
  $item = Get-Item -LiteralPath $Path -Force
  $t = $item.Target
  if ($null -eq $t) {
    throw "Cannot resolve junction target for: $Path (Target empty). Refusing to remove."
  }
  if ($t -is [System.Array]) {
    if ($t.Count -lt 1) { throw "Junction target array empty: $Path" }
    $t = $t[0]
  }
  $s = [string]$t
  if ([string]::IsNullOrWhiteSpace($s)) {
    throw "Junction target blank: $Path"
  }
  return (Get-FullPathNormalized $s)
}

function Remove-HarnessJunctionFailClosed {
  <#
    Removes $LinkPath only when it is a Directory Junction whose resolved
    target equals $ExpectedTarget exactly. Never recursive.
  #>
  param(
    [Parameter(Mandatory)][string]$LinkPath,
    [Parameter(Mandatory)][string]$ExpectedTarget
  )
  $expected = Get-FullPathNormalized $ExpectedTarget
  if (-not (Test-Path -LiteralPath $LinkPath)) {
    return
  }
  if (-not (Test-IsDirectoryJunction -Path $LinkPath)) {
    throw @"
REFUSE: path is not a verified Directory Junction (will not rmdir):
  path=$LinkPath
  expectedTarget=$expected
If this is a real folder or wrong link type, fix or choose a new -AsciiRoot.
"@
  }
  $actual = Get-JunctionTargetPath -Path $LinkPath
  if ($actual -ne $expected) {
    throw @"
REFUSE: junction target mismatch (will not rmdir):
  path=$LinkPath
  actualTarget=$actual
  expectedTarget=$expected
"@
  }
  # Junction-only remove: rmdir without /s removes the link, not target contents.
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'rmdir', "`"$LinkPath`"") -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) {
    throw "rmdir junction failed exit=$($p.ExitCode) path=$LinkPath"
  }
  if (Test-Path -LiteralPath $LinkPath) {
    throw "rmdir reported success but path still exists: $LinkPath"
  }
}

function Test-ExistingLinkSafeForRepo {
  param(
    [Parameter(Mandatory)][string]$LinkPath,
    [Parameter(Mandatory)][string]$ExpectedTarget
  )
  if (-not (Test-Path -LiteralPath $LinkPath)) {
    return $true
  }
  if (-not (Test-IsDirectoryJunction -Path $LinkPath)) {
    return $false
  }
  try {
    $actual = Get-JunctionTargetPath -Path $LinkPath
    return ($actual -eq (Get-FullPathNormalized $ExpectedTarget))
  } catch {
    return $false
  }
}

function Assert-AsciiRootOwnedOrAbsent {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$Repo
  )
  $rootFull = Get-FullPathNormalized $Root
  $repoFull = Get-FullPathNormalized $Repo
  $markerPath = Join-Path $rootFull $MarkerName

  if (-not (Test-Path -LiteralPath $rootFull)) {
    return
  }

  if (Test-Path -LiteralPath $markerPath -PathType Leaf) {
    $meta = Get-Content -LiteralPath $markerPath -Raw -ErrorAction Stop
    if ($meta -notmatch [regex]::Escape("tool=$ToolId")) {
      throw "REFUSE: marker tool id mismatch at $markerPath"
    }
    if ($meta -notmatch [regex]::Escape("repo=$repoFull")) {
      throw @"
REFUSE: marker repo path mismatch at $markerPath
  expected repo=$repoFull
  marker content:
$meta
"@
    }
    return
  }

  # No marker: reclaim only when ownership is proven by correct junctions.
  # Existing empty/unknown directories without junctions are refused
  # (new roots must be created by this tool on a non-existent path).
  $provenJunction = 0
  foreach ($name in @('node_modules', 'client', 'server')) {
    $link = Join-Path $rootFull $name
    $target = Join-Path $repoFull $name
    if (-not (Test-Path -LiteralPath $link)) {
      continue
    }
    if (-not (Test-ExistingLinkSafeForRepo -LinkPath $link -ExpectedTarget $target)) {
      throw @"
REFUSE: ASCII root exists without harness marker, and path is not a safe junction.
  root=$rootFull
  problemPath=$link
  expectedTarget=$target
Choose a new -AsciiRoot that does not exist yet, or fix the mirror manually.
This tool will not clear or rmdir unknown directories.
"@
    }
    $provenJunction++
  }
  if ($provenJunction -lt 1) {
    throw @"
REFUSE: ASCII root already exists without harness marker and without proven junctions.
  root=$rootFull
  expectedMarker=$markerPath
Use a path that does not exist yet (tool will create it), or a legacy mirror whose
node_modules/client/server junctions already point at this repository.
"@
  }
  Write-Host "Reclaiming unmarked ASCII root after verifying $provenJunction junction(s) -> $repoFull"
  Write-HarnessMarker -Root $rootFull -Repo $repoFull
}

function Write-HarnessMarker {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$Repo
  )
  $rootFull = Get-FullPathNormalized $Root
  $repoFull = Get-FullPathNormalized $Repo
  $markerPath = Join-Path $rootFull $MarkerName
  $body = @(
    "tool=$ToolId"
    "repo=$repoFull"
    "createdUtc=$((Get-Date).ToUniversalTime().ToString('o'))"
  ) -join "`n"
  Set-Content -LiteralPath $markerPath -Value $body -Encoding UTF8
}

function Ensure-AsciiWorkspace {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$Repo
  )
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

  Copy-Item -LiteralPath (Join-Path $repoFull 'package.json') -Destination $rootFull -Force
  Copy-Item -LiteralPath (Join-Path $repoFull 'playwright.config.mjs') -Destination $rootFull -Force
  Copy-Item -Path (Join-Path $repoFull 'e2e\*') -Destination $e2eDir -Force
  $lock = Join-Path $repoFull 'package-lock.json'
  if (Test-Path -LiteralPath $lock) {
    Copy-Item -LiteralPath $lock -Destination $rootFull -Force
  }

  foreach ($name in @('node_modules', 'client', 'server')) {
    $link = Join-Path $rootFull $name
    $target = Join-Path $repoFull $name
    if (-not (Test-Path -LiteralPath $target)) {
      throw "Required repo path missing for junction: $target"
    }
    $targetFull = Get-FullPathNormalized $target
    if (Test-Path -LiteralPath $link) {
      Remove-HarnessJunctionFailClosed -LinkPath $link -ExpectedTarget $targetFull
    }
    $mk = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'mklink', '/J', "`"$link`"", "`"$targetFull`"") -Wait -PassThru -NoNewWindow
    if ($mk.ExitCode -ne 0) {
      throw "mklink /J failed exit=$($mk.ExitCode) link=$link target=$targetFull"
    }
    # Verify after create
    if (-not (Test-IsDirectoryJunction -Path $link)) {
      throw "After mklink, path is not a junction: $link"
    }
    $got = Get-JunctionTargetPath -Path $link
    if ($got -ne $targetFull) {
      throw "After mklink, target mismatch: got=$got expected=$targetFull"
    }
  }

  Write-HarnessMarker -Root $rootFull -Repo $repoFull
}

function Test-LocalFrontend {
  param([string]$Url = 'http://localhost:5173')
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
      return
    }
    throw "Unexpected status $($resp.StatusCode)"
  } catch {
    throw @"
Frontend not reachable at $Url ($($_.Exception.Message)).
Start it first: npm run dev:client
This script will not switch to a remote URL.
"@
  }
}

function Invoke-FailClosedSelfTest {
  Write-Host '===== SelfTest: junction fail-closed (non-destructive) ====='
  $tmp = Join-Path $env:TEMP ("77hk-e2e-selftest-" + [guid]::NewGuid().ToString('n'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    # 1) plain directory must refuse
    $plain = Join-Path $tmp 'client'
    New-Item -ItemType Directory -Path $plain | Out-Null
    $threw = $false
    try {
      Remove-HarnessJunctionFailClosed -LinkPath $plain -ExpectedTarget (Join-Path $tmp 'other')
    } catch {
      $threw = $true
      Write-Host "OK refuse plain directory: $($_.Exception.Message.Split([char]10)[0])"
    }
    if (-not $threw) { throw 'SelfTest failed: plain directory was not refused' }
    if (-not (Test-Path -LiteralPath $plain)) {
      throw 'SelfTest failed: plain directory was destroyed'
    }

    # 2) junction with wrong target must refuse
    $realA = Join-Path $tmp 'real-a'
    $realB = Join-Path $tmp 'real-b'
    New-Item -ItemType Directory -Path $realA, $realB | Out-Null
    $wrongLink = Join-Path $tmp 'server'
    $mk = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'mklink', '/J', "`"$wrongLink`"", "`"$realA`"") -Wait -PassThru -NoNewWindow
    if ($mk.ExitCode -ne 0) { throw 'SelfTest setup mklink failed' }
    $threw2 = $false
    try {
      Remove-HarnessJunctionFailClosed -LinkPath $wrongLink -ExpectedTarget $realB
    } catch {
      $threw2 = $true
      Write-Host "OK refuse mismatched junction: $($_.Exception.Message.Split([char]10)[0])"
    }
    if (-not $threw2) { throw 'SelfTest failed: mismatched junction was not refused' }
    if (-not (Test-Path -LiteralPath $wrongLink)) {
      throw 'SelfTest failed: mismatched junction was removed'
    }
    if (-not (Test-Path -LiteralPath $realA)) {
      throw 'SelfTest failed: junction target was damaged'
    }

    # 3) correct junction may be removed without deleting target
    Remove-HarnessJunctionFailClosed -LinkPath $wrongLink -ExpectedTarget $realA
    if (Test-Path -LiteralPath $wrongLink) {
      throw 'SelfTest failed: correct junction still present after remove'
    }
    if (-not (Test-Path -LiteralPath $realA)) {
      throw 'SelfTest failed: target deleted when removing junction'
    }
    Write-Host 'OK remove matching junction leaves target intact'

    # 4) existing root without marker must refuse Ensure
    $alien = Join-Path $tmp 'alien-root'
    New-Item -ItemType Directory -Path $alien | Out-Null
    $threw3 = $false
    try {
      Assert-AsciiRootOwnedOrAbsent -Root $alien -Repo $RepoRoot
    } catch {
      $threw3 = $true
      Write-Host "OK refuse unmarked ASCII root: $($_.Exception.Message.Split([char]10)[0])"
    }
    if (-not $threw3) { throw 'SelfTest failed: unmarked root not refused' }

    Write-Host '===== SelfTest PASS ====='
  } finally {
    # Only delete our temp tree under %TEMP% with known prefix
    if ($tmp -like (Join-Path $env:TEMP '77hk-e2e-selftest-*')) {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-PlaywrightCliPids {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -match '@playwright\\test\\cli\.js' -or
        $_.CommandLine -match '@playwright/test/cli\.js'
      )
    } |
    Select-Object -ExpandProperty ProcessId
}

# ---- SelfTest only ----
if ($SelfTest) {
  Invoke-FailClosedSelfTest
  exit 0
}

# ---- Main run ----
$RepoRoot = Get-FullPathNormalized $RepoRoot
$AsciiRoot = Get-FullPathNormalized $AsciiRoot
if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
  $EvidenceDir = Join-Path $RepoRoot 'docs\evidence\2026-07-15\e2e-harness-hardening'
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
Write-Host "evidence=$EvidenceDir"
Write-Host "screenshots=$ShotDir"

if (-not $WithWebServer) {
  Test-LocalFrontend -Url 'http://localhost:5173'
  $env:E2E_NO_WEBSERVER = '1'
} else {
  Remove-Item Env:E2E_NO_WEBSERVER -ErrorAction SilentlyContinue
}

# Absolute screenshot dir for public-routes.spec.ts
$env:E2E_SCREENSHOT_DIR = $ShotDir

Ensure-AsciiWorkspace -Root $AsciiRoot -Repo $RepoRoot
Set-Location -LiteralPath $AsciiRoot

$pwArgs = @(
  '.\node_modules\@playwright\test\cli.js', 'test',
  'e2e/smoke.spec.ts', 'e2e/public-routes.spec.ts', 'e2e/protected-route.spec.ts',
  '--config=playwright.config.mjs', '--project=chromium', '--reporter=list', '--workers=1'
)

$logHeader = @"
# e2e-public-smoke harness
# utc=$((Get-Date).ToUniversalTime().ToString('o'))
# node=$nodeVer
# nodePath=$nodeExe
# repo=$RepoRoot
# asciiCwd=$AsciiRoot
# E2E_SCREENSHOT_DIR=$env:E2E_SCREENSHOT_DIR
# E2E_NO_WEBSERVER=$env:E2E_NO_WEBSERVER
# WithWebServer=$WithWebServer

"@
Set-Content -LiteralPath $TestOutputPath -Value $logHeader -Encoding UTF8

function Invoke-Focused {
  param([Parameter(Mandatory)][string]$Label)
  Write-Host "===== $Label ====="
  $before = @(Get-PlaywrightCliPids)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  # Native stderr (e.g. Node NO_COLOR warning) must not trip $ErrorActionPreference Stop
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & $nodeExe @pwArgs 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  $sw.Stop()
  $text = ($out -join "`n")
  $block = @"

===== $Label =====
exit=$code
elapsed_ms=$($sw.ElapsedMilliseconds)

$text

"@
  Add-Content -LiteralPath $TestOutputPath -Value $block -Encoding UTF8
  Write-Host $text
  Write-Host "===== $Label end exit=$code elapsed_ms=$($sw.ElapsedMilliseconds) ====="

  Start-Sleep -Milliseconds 400
  $after = @(Get-PlaywrightCliPids)
  $leaked = @($after | Where-Object { $before -notcontains $_ })
  if ($leaked.Count -gt 0) {
    throw "Playwright CLI still running after $Label : PIDs $($leaked -join ',')"
  }

  if ($code -ne 0) {
    throw "Playwright failed ($Label) exit=$code"
  }
  if ($text -notmatch '8 passed') {
    throw "Playwright output for $Label did not contain '8 passed'"
  }
}

Invoke-Focused 'RUN1'
if ($Twice) {
  Invoke-Focused 'RUN2'
}

$shots = @(Get-ChildItem -LiteralPath $ShotDir -Filter '*.png' -ErrorAction SilentlyContinue)
Write-Host "screenshots_count=$($shots.Count) dir=$ShotDir"
if ($shots.Count -lt 1) {
  throw "No screenshots written under $ShotDir (E2E_SCREENSHOT_DIR may be ignored)"
}

Write-Host 'OK focused public/protected smoke finished (fail-closed harness).'
