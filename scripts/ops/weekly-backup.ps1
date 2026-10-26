# The weekly backup routine in one window (scripts/ops/README.md, Weekly).
#
#   npm run backup:weekly                      # by hand
#   (or the scheduled task from backup-task.ps1, Sundays 21:00, disabled until you enable it)
#
# Asks for the service-account passphrase, takes an encrypted production backup into
# -Out (which prunes that folder at 28 days), then copies the new file to every other
# drive that has a \volley-backups folder at its root (your BitLocker external drive)
# and prunes the copies there. Prints counts, names and hashes only, like the scripts.
param(
  [string]$Out = (Join-Path $HOME 'volley-backups')
)

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo
New-Item -ItemType Directory -Force $Out | Out-Null

function Finish([string]$message, [int]$code) {
  Write-Host ''
  Write-Host $message
  Read-Host 'Press Enter to close'
  exit $code
}

Write-Host "Volley Skills weekly backup ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
Write-Host "Backup folder: $Out"
Write-Host ''

$before = @(Get-ChildItem $Out -Filter 'volley-skills-*.vsbackup' -ErrorAction SilentlyContinue | ForEach-Object Name)
npm run backup -- --prod --out "$Out"
if ($LASTEXITCODE -ne 0) { Finish 'Backup FAILED. Nothing was copied.' 1 }

$new = Get-ChildItem $Out -Filter 'volley-skills-*.vsbackup' |
  Where-Object { $before -notcontains $_.Name } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $new) { Finish 'Backup reported success but no new file was found.' 1 }

$outDrive = (Get-Item $Out).PSDrive.Name
$copies = Get-PSDrive -PSProvider FileSystem |
  Where-Object { $_.Name -ne $outDrive -and (Test-Path (Join-Path $_.Root 'volley-backups')) }
if (-not $copies) {
  Finish "Backup done: $($new.Name). No external drive with a \volley-backups folder is connected: copy it later." 0
}
foreach ($drive in $copies) {
  $dir = Join-Path $drive.Root 'volley-backups'
  Copy-Item $new.FullName $dir
  Write-Host "Copied $($new.Name) to $dir"
  npm run backup:prune -- --dir "$dir"
}
Finish 'Backup done.' 0
