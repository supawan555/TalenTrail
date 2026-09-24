<#
.SYNOPSIS
    One-command TalenTrail E2E run: disposable Mongo (Docker) + backend + frontend
    + Robot Framework, with full teardown.

.DESCRIPTION
    Steps:
      1. Start a throwaway `mongo` Docker container.
      2. Swap BackEnd/.env for the E2E env (original is backed up and restored).
      3. Seed the admin user (+ demo candidates unless -NoSeed).
      4. Start uvicorn (degraded LLM) and wait for /health = healthy.
      5. Start the Vite dev server and wait for it to serve.
      6. Run `robot` against e2e/  (extra args after `--` are passed through).
      7. Always: stop servers, remove the container, restore BackEnd/.env.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File e2e\run.ps1
    powershell -ExecutionPolicy Bypass -File e2e\run.ps1 -Headed -- --include P0
    powershell -ExecutionPolicy Bypass -File e2e\run.ps1 -NoSeed -- --suite 01_auth
#>
[CmdletBinding()]
param(
    [switch]$Headed,
    [switch]$NoSeed,
    [switch]$KeepServers,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RobotArgs
)

$ErrorActionPreference = 'Stop'
# This shell's inherited PYTHONIOENCODING (often "utf-8:surrogateescape") makes
# Robot Framework's own console writer crash with "unknown encoding" before a
# single test runs. Plain "utf-8" is what actually works here.
$env:PYTHONIOENCODING = 'utf-8'
$repoRoot  = Split-Path -Parent $PSScriptRoot
$e2eDir    = $PSScriptRoot
$resultsDir = Join-Path $e2eDir 'results'
$container = 'talentrail-e2e-mongo'
$mongoPort = 27057   # NOT 27017: a native "MongoDB Server" Windows service already
                      # owns that port on this machine. Docker silently loses that
                      # bind race (docker run still reports success), so anything
                      # pointed at localhost:27017 was hitting the real local Mongo
                      # instead of this disposable container. A dedicated port makes
                      # the container's isolation genuine.
$envFile   = Join-Path $repoRoot 'BackEnd\.env'
$envBackup = Join-Path $repoRoot 'BackEnd\.env.e2e-backup'
$sourceEnv = Join-Path $e2eDir 'env\e2e.env'
if (-not (Test-Path $sourceEnv)) { $sourceEnv = Join-Path $e2eDir 'env\e2e.env.example' }

New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

# --- locate interpreters --------------------------------------------------
$rfPython = Join-Path $repoRoot 'venv\Scripts\python.exe'
if (-not (Test-Path $rfPython)) { throw "Robot venv not found at $rfPython (run the setup steps first)." }

$backendPython = @(
    (Join-Path $repoRoot 'BackEnd\.venv\Scripts\python.exe'),
    (Join-Path $repoRoot 'BackEnd\env\Scripts\python.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $backendPython) {
    throw "No BackEnd virtualenv found. Create one and install BackEnd/requirements.txt (e.g. BackEnd\.venv)."
}

$backend = $null
$frontend = $null
$restoreEnv = $false
$robotExit = 1   # non-zero unless we actually reach and finish the robot run

# PowerShell 5.1 quirk: redirecting a native command's stderr (2>&1, 2>$null, ...)
# wraps each stderr line as an ErrorRecord, and with $ErrorActionPreference='Stop'
# that becomes a terminating exception - even though the command itself exited 0.
# `docker rm -f` on a not-yet-created container, or `taskkill` on an already-exited
# process, both write to stderr in the completely normal case. Swallow it.
function Invoke-Quietly {
    param([Parameter(Mandatory)][scriptblock]$Command)
    try { & $Command 2>&1 | Out-Null } catch { }
}

function Stop-Tree($proc) {
    if ($proc -and -not $proc.HasExited) {
        Invoke-Quietly { taskkill /PID $proc.Id /T /F }
    }
}

function Wait-ForHttp($url, $timeoutSec, $needle) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
            if (-not $needle -or $r.Content -match $needle) { return $true }
        } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

try {
    # --- 1. Mongo ------------------------------------------------------------
    Write-Host '==> Starting disposable MongoDB container...' -ForegroundColor Cyan
    Invoke-Quietly { docker rm -f $container }   # no-op the first time - container doesn't exist yet
    & docker run -d --name $container -p ${mongoPort}:27017 mongo:7 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'docker run failed - is Docker Desktop running?' }
    # Mongo speaks its own wire protocol, not HTTP, so there's nothing to poll here.
    # A few seconds is enough for mongod to start accepting connections.
    Start-Sleep -Seconds 5

    # --- 2. env swap ------------------------------------------------------------
    Write-Host '==> Installing E2E BackEnd/.env...' -ForegroundColor Cyan
    if (Test-Path $envFile) { Copy-Item $envFile $envBackup -Force }
    Copy-Item $sourceEnv $envFile -Force
    $restoreEnv = $true

    # These two are read via plain os.getenv() in app code (app/ml/health.py,
    # app/routers/auth.py) - NOT declared fields on the pydantic Settings model,
    # which forbids unknown .env keys. They must be real process env vars, set
    # here so every child process (scripts + uvicorn) started below inherits them.
    $env:TALENTRAIL_ALLOW_DEGRADED_LLM = '1'
    $env:TALENTTAIL_TOTP_STATIC_SECRET = 'JBSWY3DPEHPK3PXP'   # must equal ${TOTP_SECRET} in e2e/resources/config.resource
    # Overrides whatever MONGO_DB_URI e2e/env/e2e.env(.example) has on disk - env
    # vars win over .env values in pydantic-settings, so $mongoPort stays the one
    # source of truth instead of two hardcoded copies drifting apart.
    $env:MONGO_DB_URI = "mongodb://localhost:$mongoPort"

    # --- 3. seed ----------------------------------------------------------------
    Write-Host '==> Seeding admin user...' -ForegroundColor Cyan
    Push-Location $repoRoot
    & $backendPython 'scripts\create_admin.py'
    if (-not $NoSeed) {
        Write-Host '==> Seeding demo candidates...' -ForegroundColor Cyan
        & $backendPython 'scripts\seed_candidates.py' '--confirm'
    }
    Pop-Location

    # --- 4. backend -----------------------------------------------------------
    Write-Host '==> Starting backend (uvicorn :8000)...' -ForegroundColor Cyan
    $backend = Start-Process -FilePath $backendPython `
        -ArgumentList '-m', 'uvicorn', 'app.main:app', '--port', '8000' `
        -WorkingDirectory (Join-Path $repoRoot 'BackEnd') `
        -RedirectStandardOutput (Join-Path $resultsDir 'backend.out.log') `
        -RedirectStandardError  (Join-Path $resultsDir 'backend.err.log') `
        -PassThru -NoNewWindow
    if (-not (Wait-ForHttp 'http://127.0.0.1:8000/health' 90 'healthy')) {
        throw "Backend did not become healthy - see $resultsDir\backend.err.log"
    }

    # --- 5. frontend --------------------------------------------------------
    Write-Host '==> Starting frontend (vite :3000)...' -ForegroundColor Cyan
    $env:CI = '1'   # disables vite's auto-open
    $frontend = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList 'run', 'dev', '--', '--port', '3000', '--strictPort' `
        -WorkingDirectory (Join-Path $repoRoot 'font-end') `
        -RedirectStandardOutput (Join-Path $resultsDir 'frontend.out.log') `
        -RedirectStandardError  (Join-Path $resultsDir 'frontend.err.log') `
        -PassThru -NoNewWindow
    if (-not (Wait-ForHttp 'http://localhost:3000' 90 $null)) {
        throw "Frontend did not start - see $resultsDir\frontend.err.log"
    }

    # --- 6. robot ---------------------------------------------------------------
    Write-Host '==> Running Robot Framework...' -ForegroundColor Cyan
    $robot = Join-Path $repoRoot 'venv\Scripts\robot.exe'
    $args = @('--argumentfile', (Join-Path $e2eDir 'args\local.args'))
    if ($Headed) { $args += @('--variable', 'HEADLESS:False') }
    if ($RobotArgs) { $args += $RobotArgs }
    $args += (Join-Path $e2eDir '.')

    Push-Location $repoRoot
    & $robot @args
    $robotExit = $LASTEXITCODE
    Pop-Location
    Write-Host "==> Robot exit code: $robotExit"
}
finally {
    if (-not $KeepServers) {
        Write-Host '==> Teardown...' -ForegroundColor Cyan
        Stop-Tree $frontend
        Stop-Tree $backend
        Invoke-Quietly { docker rm -f $container }
    }
    if ($restoreEnv) {
        if (Test-Path $envBackup) { Move-Item $envBackup $envFile -Force }
        else { Remove-Item $envFile -Force -ErrorAction SilentlyContinue }
    }
}

exit $robotExit
