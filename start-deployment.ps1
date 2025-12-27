# start-deployment.ps1
# Automates the deployment by reading config, uploading scripts, and executing setup.

$ErrorActionPreference = "Stop"

$ConfigPath = "deploy-config.json"

if (-not (Test-Path $ConfigPath)) {
    Write-Error "Configuration file '$ConfigPath' not found. Please copy 'deploy-config.example.json' to '$ConfigPath' and fill in your details."
}

$Config = Get-Content $ConfigPath | ConvertFrom-Json

# Validate Config
$Required = @("host", "username", "password", "remotePath", "repoUrl", "githubToken")
foreach ($Key in $Required) {
    if (-not $Config.$Key) {
        Write-Error "Missing required config key: $Key"
    }
}

$User = $Config.username
$HostName = $Config.host
$Pass = $Config.password
# Note: Using password directly in script is tricky with standard ssh/scp without key.
# We will check if 'sshpass' or 'plink' is available, or guide user to use keys.
# Since the user specifically mentioned providing credentials, they might expect us to use them.
# The template used 'plink -pw $Pass'. We will stick to that if available, or warn.

# Check for plink
if (Get-Command "plink.exe" -ErrorAction SilentlyContinue) {
    Write-Host "Using plink for connection..."
    $UsePlink = $true
}
else {
    Write-Warning "plink.exe not found. Falling back to standard scp/ssh. You may be prompted for password multiple times."
    $UsePlink = $false
}

$RemoteTmp = "/tmp"
$SetupScript = "setup-server.sh"
$SyncScript = "auto-sync.sh"

Write-Host "🚀 Starting Deployment to $HostName..."

# 1. Upload Scripts
Write-Host "Uploading scripts..."
if ($UsePlink) {
    echo y | pscp -P 22 -pw $Pass $SetupScript "$User@$HostName`:$RemoteTmp/$SetupScript"
    echo y | pscp -P 22 -pw $Pass $SyncScript "$User@$HostName`:$RemoteTmp/$SyncScript"
}
else {
    scp $SetupScript "$User@$HostName`:$RemoteTmp/$SetupScript"
    scp $SyncScript "$User@$HostName`:$RemoteTmp/$SyncScript"
}

# 2. Execute Setup
Write-Host "Executing setup on remote server..."
$AppDir = $Config.remotePath
$Repo = $Config.repoUrl
$Token = $Config.githubToken

# Make scripts executable and run setup
$RemoteCmd = "chmod +x $RemoteTmp/$SetupScript $RemoteTmp/$SyncScript; $RemoteTmp/$SetupScript '$Repo' '$AppDir' '$Token'; rm $RemoteTmp/$SetupScript"

if ($UsePlink) {
    echo y | plink -ssh -P 22 -t -pw $Pass "$User@$HostName" $RemoteCmd
}
else {
    ssh -t "$User@$HostName" $RemoteCmd
}

Write-Host "🎉 Deployment command sent!"
