<#
.SYNOPSIS
    Automated, safe, local PostgreSQL backup for the DataLink database.

.DESCRIPTION
    Creates a compressed custom-format backup (pg_dump -F c -b) of the local
    PostgreSQL 'datalink' database to D:\backups\, verifies file integrity,
    maintains a local execution log, and enforces a configurable retention policy.

.PARAMETER BackupDir
    Target directory for backup dumps. Default: D:\backups

.PARAMETER LogDir
    Directory for backup logs. Default: D:\backups\logs

.PARAMETER RetentionCount
    Number of recent successful backups to retain. Default: 7

.PARAMETER HostName
    PostgreSQL host. Strictly localhost. Default: 127.0.0.1

.PARAMETER Port
    PostgreSQL port. Default: 5432

.PARAMETER Username
    PostgreSQL database user. Default: postgres

.PARAMETER Database
    PostgreSQL database name. Default: datalink
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$BackupDir = "D:\backups",

    [Parameter()]
    [string]$LogDir = "D:\backups\logs",

    [Parameter()]
    [int]$RetentionCount = 7,

    [Parameter()]
    [string]$HostName = "127.0.0.1",

    [Parameter()]
    [int]$Port = 5432,

    [Parameter()]
    [string]$Username = "postgres",

    [Parameter()]
    [string]$Database = "datalink"
)

# Strict error handling
$ErrorActionPreference = "Stop"

# Ensure host is strictly local
if ($HostName -ne "127.0.0.1" -and $HostName -ne "localhost") {
    Write-Error "CRITICAL: Backups can only connect to localhost (127.0.0.1). Specified host '$HostName' is not permitted."
    exit 1
}

# Ensure destination directories exist
try {
    if (-not (Test-Path -Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    if (-not (Test-Path -Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
} catch {
    Write-Error "Failed to create backup or log directory: $_"
    exit 1
}

$logFilePath = Join-Path -Path $LogDir -ChildPath "backup.log"

function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [string]$Level = "INFO"
    )
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    try {
        Add-Content -Path $logFilePath -Value $line -Encoding utf8
    } catch {
        Write-Warning "Could not write to log file '$logFilePath': $_"
    }
}

# Locate pg_dump.exe
$pgDumpCandidatePaths = @(
    "D:\PostgreSQL18\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
)

$pgDumpPath = $null
$systemPgDump = Get-Command "pg_dump.exe" -ErrorAction SilentlyContinue
if ($systemPgDump) {
    $pgDumpPath = $systemPgDump.Source
} else {
    foreach ($cand in $pgDumpCandidatePaths) {
        if (Test-Path -Path $cand) {
            $pgDumpPath = $cand
            break
        }
    }
}

if (-not $pgDumpPath) {
    Write-Log "pg_dump.exe could not be found in PATH or standard installation directories." "ERROR"
    exit 1
}

Write-Log "Backup process initiated." "INFO"
Write-Log "pg_dump binary: $pgDumpPath" "INFO"
Write-Log "Target database: $Database at $HostName`:$Port as user $Username" "INFO"

# Credential verification (uses dedicated %APPDATA%\postgresql\pgpass.conf or existing $env:PGPASSWORD)
$pgPassPath = Join-Path -Path $env:APPDATA -ChildPath "postgresql\pgpass.conf"
if (Test-Path -Path $pgPassPath) {
    Write-Log "Authentication credentials resolved from dedicated pgpass ($pgPassPath)." "INFO"
} elseif ($env:PGPASSWORD) {
    Write-Log "Authentication credentials resolved from environment variable PGPASSWORD." "INFO"
} else {
    Write-Log "Notice: No pgpass.conf found at '$pgPassPath' and PGPASSWORD is unset. pg_dump will attempt default/trust authentication." "WARNING"
}

$dateStamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$finalDumpName = "${Database}_${dateStamp}.dump"
$finalDumpPath = Join-Path -Path $BackupDir -ChildPath $finalDumpName
$tempDumpPath = Join-Path -Path $BackupDir -ChildPath "${finalDumpName}.tmp"

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$backupSuccess = $false

try {
    Write-Log "Starting pg_dump to temporary spool: $tempDumpPath" "INFO"

    $dumpArguments = @(
        "-h", $HostName,
        "-p", $Port,
        "-U", $Username,
        "-d", $Database,
        "-F", "c",
        "-b",
        "-f", $tempDumpPath
    )

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $pgDumpPath
    $processInfo.Arguments = ($dumpArguments -join " ")
    $processInfo.RedirectStandardError = $true
    $processInfo.RedirectStandardOutput = $false
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($processInfo)
    $stdErrOutput = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode

    $stopwatch.Stop()
    $durationSeconds = [math]::Round($stopwatch.Elapsed.TotalSeconds, 2)

    if ($exitCode -ne 0) {
        Write-Log "pg_dump failed with exit code $exitCode. Error: $stdErrOutput" "ERROR"
        if (Test-Path -Path $tempDumpPath) {
            Remove-Item -Path $tempDumpPath -Force -ErrorAction SilentlyContinue
        }
        exit $exitCode
    }

    # Verify temp dump exists and has non-zero size
    if (-not (Test-Path -Path $tempDumpPath)) {
        Write-Log "Verification failed: Temporary dump file was not created." "ERROR"
        exit 1
    }

    $fileItem = Get-Item -Path $tempDumpPath
    if ($fileItem.Length -le 0) {
        Write-Log "Verification failed: Dump file size is 0 bytes." "ERROR"
        Remove-Item -Path $tempDumpPath -Force -ErrorAction SilentlyContinue
        exit 1
    }

    # Atomically rename temp file to final dump file
    Move-Item -Path $tempDumpPath -Destination $finalDumpPath -Force
    $finalItem = Get-Item -Path $finalDumpPath
    $sizeMB = [math]::Round($finalItem.Length / 1MB, 2)
    $sizeGB = [math]::Round($finalItem.Length / 1GB, 3)

    Write-Log "Backup completed successfully in $durationSeconds seconds." "INFO"
    Write-Log "Output file: $finalDumpPath (Size: $sizeMB MB / $sizeGB GB)" "INFO"
    $backupSuccess = $true

    # Enforce retention policy
    if ($RetentionCount -gt 0) {
        Write-Log "Evaluating retention policy (Retain most recent: $RetentionCount backups)." "INFO"
        
        $allDumps = Get-ChildItem -Path $BackupDir -Filter "${Database}_*.dump" |
            Where-Object { 
                -not $_.PSIsContainer -and 
                $_.Name -match "^${Database}_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.dump$" 
            } |
            Sort-Object -Property Name -Descending

        if ($allDumps.Count -gt $RetentionCount) {
            $dumpsToDelete = $allDumps | Select-Object -Skip $RetentionCount
            foreach ($oldDump in $dumpsToDelete) {
                # Safety guarantee: never delete if it's the only remaining backup
                $remainingCount = (Get-ChildItem -Path $BackupDir -Filter "${Database}_*.dump").Count
                if ($remainingCount -gt 1) {
                    $oldSizeMB = [math]::Round($oldDump.Length / 1MB, 2)
                    Write-Log "Retention cleanup: Removing old backup '$($oldDump.Name)' ($oldSizeMB MB)." "INFO"
                    Remove-Item -Path $oldDump.FullName -Force -ErrorAction SilentlyContinue
                } else {
                    Write-Log "Retention safety triggered: Preserving '$($oldDump.Name)' as last remaining backup." "WARNING"
                }
            }
        } else {
            Write-Log "Total backups ($($allDumps.Count)) within retention limit ($RetentionCount). No files purged." "INFO"
        }
    }

} catch {
    Write-Log "Unhandled exception during backup: $_" "ERROR"
    if (Test-Path -Path $tempDumpPath) {
        Remove-Item -Path $tempDumpPath -Force -ErrorAction SilentlyContinue
    }
}

if ($backupSuccess) {
    exit 0
} else {
    exit 1
}
