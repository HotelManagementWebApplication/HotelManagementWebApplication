[CmdletBinding()]
param(
    [switch]$ResetExistingDemo,
    [string]$BackupDirectory = (Join-Path $env:USERPROFILE '.codex\backups\web-hotel-mis')
)

$ErrorActionPreference = 'Stop'
if (-not $ResetExistingDemo) {
    throw 'Dùng -ResetExistingDemo khi chủ repo yêu cầu thay dữ liệu demo QLKS local.'
}

# Cố định đích local; script không nhận URL, database hay container khác.
$containerName = 'web-hotel-mis-sqlserver-1433'
$sqlcmd = '/opt/mssql-tools18/bin/sqlcmd'
$state = docker inspect $containerName --format '{{.State.Status}}'
if ($LASTEXITCODE -ne 0 -or $state -ne 'running') { throw 'SQL Server demo local chưa chạy.' }
$demoSqlPassword = (docker exec $containerName printenv MSSQL_SA_PASSWORD).Trim()
if (-not $demoSqlPassword) { throw 'Không lấy được cấu hình kết nối SQL Server demo.' }

function Invoke-DemoSql([string]$Query) {
    $output = docker exec -e "SQLCMDPASSWORD=$demoSqlPassword" $containerName $sqlcmd -S localhost -U sa -C -d master -b -I -Q $Query
    if ($LASTEXITCODE -ne 0) { throw 'Lệnh SQL trên QLKS demo local thất bại.' }
    $output
}

Invoke-DemoSql "IF DB_ID(N'QLKS') IS NULL THROW 51000, N'Không có QLKS demo local.', 1;
IF (SELECT COUNT(*) FROM QLKS.dbo.flyway_schema_history WHERE success = 1 AND version IN ('1','2','3','4','5','6')) <> 6
    THROW 51000, N'QLKS chưa chạy đủ Flyway V1-V6.', 1;
IF NOT EXISTS (SELECT 1 FROM QLKS.dbo.NhanVien WHERE maNhanVien=N'HOUSEKEEP')
    THROW 51000, N'QLKS không có tài khoản demo đã biết; từ chối reset.', 1;"

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupName = "QLKS-before-demo-reset-$stamp.bak"
$containerBackupPath = "/var/opt/mssql/backup/$backupName"
New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$localBackupPath = Join-Path $BackupDirectory $backupName
$taskTempSql = Join-Path ([System.IO.Path]::GetTempPath()) ("hotel-demo-reset-" + [guid]::NewGuid() + '.sql')

$wrapper = @"
USE [QLKS];
ALTER DATABASE [QLKS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
BACKUP DATABASE [QLKS] TO DISK = N'$containerBackupPath' WITH COPY_ONLY, INIT, CHECKSUM;
RESTORE VERIFYONLY FROM DISK = N'$containerBackupPath' WITH CHECKSUM;
GO
:r /tmp/reset_demo.sql
GO
USE [master];
ALTER DATABASE [QLKS] SET MULTI_USER WITH ROLLBACK IMMEDIATE;
GO
"@

try {
    docker exec $containerName mkdir -p /var/opt/mssql/backup
    if ($LASTEXITCODE -ne 0) { throw 'Không tạo được thư mục backup trong container.' }
    [System.IO.File]::WriteAllText($taskTempSql, $wrapper, (New-Object System.Text.UTF8Encoding($false)))
    docker cp (Join-Path $PSScriptRoot 'reset_demo.sql') "${containerName}:/tmp/reset_demo.sql"
    if ($LASTEXITCODE -ne 0) { throw 'Không sao chép được dữ liệu demo.' }
    docker cp $taskTempSql "${containerName}:/tmp/reset_demo_wrapper.sql"
    if ($LASTEXITCODE -ne 0) { throw 'Không sao chép được lệnh reset.' }
    # Một kết nối giữ quyền truy cập QLKS trong lúc backup/reset, chặn các writer đồng thời.
    $resetOutput = docker exec -e "SQLCMDPASSWORD=$demoSqlPassword" $containerName $sqlcmd -S localhost -U sa -C -d QLKS -b -I -i /tmp/reset_demo_wrapper.sql
    $resetExit = $LASTEXITCODE
    # Giữ backup ngoài working tree kể cả khi reset bị rollback bởi kiểm tra dữ liệu.
    docker cp "${containerName}:$containerBackupPath" $localBackupPath
    if ($LASTEXITCODE -ne 0) { throw "Không sao chép được backup; bản trong container: $containerBackupPath" }
    if ($resetExit -ne 0) {
        $resetOutput | Select-Object -Last 15 | Write-Output
        throw "Reset demo bị rollback. Backup: $localBackupPath"
    }
    Write-Output "Đã reset dữ liệu QLKS local. Backup đã kiểm tra: $localBackupPath"
}
finally {
    Invoke-DemoSql 'ALTER DATABASE [QLKS] SET MULTI_USER WITH ROLLBACK IMMEDIATE;' | Out-Null
    if (Test-Path -LiteralPath $taskTempSql) { Remove-Item -LiteralPath $taskTempSql }
}
