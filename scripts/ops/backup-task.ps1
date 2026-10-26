# The Windows scheduled task that opens the weekly backup window (weekly-backup.ps1).
#
#   npm run backup:task -- -Register   # create it, DISABLED (Sundays 21:00)
#   npm run backup:task -- -Enable     # switch it on
#   npm run backup:task -- -Disable    # switch it off
#   npm run backup:task -- -Remove     # delete it
#   npm run backup:task                # show its state
#
# It runs only while you are signed in to Windows, in a visible window, because the
# backup asks for the service-account passphrase. If the laptop is off at 21:00 it
# runs at the next sign-in.
param([switch]$Register, [switch]$Enable, [switch]$Disable, [switch]$Remove)

$ErrorActionPreference = 'Stop'
$name = 'Volley Skills weekly backup'

if ($Register) {
  $script = Join-Path $PSScriptRoot 'weekly-backup.ps1'
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '21:00'
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Description 'Encrypted production backup (scripts/ops/README.md).' -Force | Out-Null
  Disable-ScheduledTask -TaskName $name | Out-Null
  Write-Host "Registered '$name' (disabled). Enable it with: npm run backup:task -- -Enable"
} elseif ($Enable) {
  Enable-ScheduledTask -TaskName $name | Out-Null
} elseif ($Disable) {
  Disable-ScheduledTask -TaskName $name | Out-Null
} elseif ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Host "Removed '$name'."
  exit 0
}

$task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if (-not $task) { Write-Host "'$name' is not registered. Create it with: npm run backup:task -- -Register"; exit 0 }
$next = (Get-ScheduledTaskInfo -TaskName $name).NextRunTime
Write-Host "'$name': $($task.State)$(if ($task.State -ne 'Disabled' -and $next) { ", next run $next" })"
