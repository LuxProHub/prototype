<#
.SYNOPSIS
    Installs or uninstalls the Windows Scheduled Task for automated DataLink PostgreSQL backups.

.DESCRIPTION
    Configures a weekly Windows Scheduled Task named 'DataLink-Weekly-Backup' that runs
    every Sunday at 02:00 AM using scripts\backup-datalink.ps1.

.PARAMETER Action
    Install or Uninstall the scheduled task. Default: Install

.PARAMETER TaskName
    Name of the scheduled task. Default: DataLink-Weekly-Backup

.PARAMETER DayOfWeek
    Day of the week to run the backup. Default: Sunday

.PARAMETER AtTime
    Time to trigger the backup. Default: 02:00AM
#>

[CmdletBinding()]
param(
    [ValidateSet("Install", "Uninstall", "Status")]
    [string]$Action = "Install",

    [string]$TaskName = "DataLink-Weekly-Backup",

    [string]$DayOfWeek = "Sunday",

    [string]$AtTime = "02:00AM"
)

$scriptDir = $PSScriptRoot
$backupScript = Join-Path -Path $scriptDir -ChildPath "backup-datalink.ps1"
$projectRoot = (Get-Item -Path $scriptDir).Parent.FullName

if (-not (Test-Path -Path $backupScript)) {
    Write-Error "Backup script not found at expected path: $backupScript"
    exit 1
}

if ($Action -eq "Uninstall") {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Successfully removed scheduled task '$TaskName'." -ForegroundColor Green
    } else {
        Write-Host "Scheduled task '$TaskName' is not registered." -ForegroundColor Yellow
    }
    exit 0
}

if ($Action -eq "Status") {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Task '$TaskName' is registered." -ForegroundColor Green
        Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State, Description
        Get-ScheduledTaskInfo -TaskName $TaskName | Format-List LastRunTime, LastTaskResult, NextRunTime
    } else {
        Write-Host "Task '$TaskName' is not currently registered." -ForegroundColor Yellow
    }
    exit 0
}

# Action is "Install"
try {
    $taskAction = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`"" `
        -WorkingDirectory $projectRoot

    $taskTrigger = New-ScheduledTaskTrigger `
        -Weekly `
        -DaysOfWeek $DayOfWeek `
        -At $AtTime

    $taskSettings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2)

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $taskAction `
        -Trigger $taskTrigger `
        -Settings $taskSettings `
        -Description "Weekly automated compressed backup of DataLink PostgreSQL database to D:\backups" `
        -Force | Out-Null

    Write-Host "Successfully registered scheduled task '$TaskName'." -ForegroundColor Green
    Write-Host "Schedule: Every $DayOfWeek at $AtTime" -ForegroundColor Cyan
    Write-Host "Command : powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$backupScript`"" -ForegroundColor DarkGray
    Write-Host "Working Directory: $projectRoot" -ForegroundColor DarkGray
} catch {
    Write-Error "Failed to register scheduled task: $_"
    exit 1
}
