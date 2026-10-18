[CmdletBinding()]
param(
    [switch]$PopulateExistingDemo,
    [string]$BackupDirectory = (Join-Path $env:USERPROFILE '.codex\backups\web-hotel-mis')
)

$ErrorActionPreference = 'Stop'
if (-not $PopulateExistingDemo) {
    throw 'Chỉ chạy với -PopulateExistingDemo khi chủ repo yêu cầu bổ sung dữ liệu demo QLKS local.'
}

# Đích local cố định; chỉ bổ sung dữ liệu, không sửa schema hoặc Flyway history.
$demoContainer = 'web-hotel-mis-sqlserver-1433'
$demoSqlcmd = '/opt/mssql-tools18/bin/sqlcmd'
$demoSeedFile = Join-Path $PSScriptRoot 'populate_operating_demo.sql'
$demoVerifyFile = Join-Path $PSScriptRoot 'verify_operating_demo.sql'
if (-not (Test-Path -LiteralPath $demoSeedFile)) { throw 'Không tìm thấy dữ liệu demo bổ sung.' }
if (-not (Test-Path -LiteralPath $demoVerifyFile)) { throw 'Không tìm thấy kiểm tra dữ liệu demo.' }
$demoState = docker inspect $demoContainer --format '{{.State.Status}}'
if ($LASTEXITCODE -ne 0 -or $demoState -ne 'running') { throw 'SQL Server demo local chưa chạy.' }
$demoSqlPassword = (docker exec $demoContainer printenv MSSQL_SA_PASSWORD).Trim()
if (-not $demoSqlPassword) { throw 'Không lấy được cấu hình kết nối SQL Server demo.' }

function Invoke-OperatingDemoSql([string]$Query) {
    $demoResult = docker exec -e "SQLCMDPASSWORD=$demoSqlPassword" $demoContainer $demoSqlcmd -S localhost -U sa -C -d QLKS -b -I -W -Q $Query
    if ($LASTEXITCODE -ne 0) { throw 'Lệnh kiểm tra/backup dữ liệu QLKS local thất bại.' }
    $demoResult
}

Invoke-OperatingDemoSql "IF DB_NAME()<>N'QLKS' OR NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=N'HOUSEKEEP')
    THROW 51000,N'Không đúng database demo local đã biết.',1;
IF (SELECT COUNT(*) FROM dbo.flyway_schema_history WHERE success=1 AND version IN('1','2','3','4','5','6'))<>6
    THROW 51000,N'Database chưa có đủ Flyway V1-V6.',1;"

$demoAlreadyLoaded = Invoke-OperatingDemoSql "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.NhatKyKiemSoat WHERE khoaLienKet=N'OPERATING-DEMO-V1-COMPLETE';"
if ($demoAlreadyLoaded -match '^\s*1\s*$') {
    Write-Output 'Bộ dữ liệu hoạt động đã có trong QLKS; không nạp trùng hoặc ghi đè dữ liệu.'
    exit 0
}

$demoStamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss') + 'Z'
$demoBackupName = "QLKS-before-operating-demo-$demoStamp.bak"
$demoContainerBackup = "/var/opt/mssql/backup/$demoBackupName"
New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$demoLocalBackup = Join-Path $BackupDirectory $demoBackupName
docker exec $demoContainer mkdir -p /var/opt/mssql/backup
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được thư mục backup trong container.' }
Invoke-OperatingDemoSql "BACKUP DATABASE [QLKS] TO DISK=N'$demoContainerBackup' WITH COPY_ONLY,INIT,CHECKSUM;
    RESTORE VERIFYONLY FROM DISK=N'$demoContainerBackup' WITH CHECKSUM;"
docker cp "${demoContainer}:$demoContainerBackup" $demoLocalBackup
if ($LASTEXITCODE -ne 0) { throw "Không chép được backup ra máy; dữ liệu chưa được bổ sung. Backup container: $demoContainerBackup" }

docker cp $demoSeedFile "${demoContainer}:/tmp/populate_operating_demo.sql"
if ($LASTEXITCODE -ne 0) { throw 'Không sao chép được bộ dữ liệu demo.' }
docker cp $demoVerifyFile "${demoContainer}:/tmp/verify_operating_demo.sql"
if ($LASTEXITCODE -ne 0) { throw 'Không sao chép được kiểm tra dữ liệu demo.' }
$demoSeedOutput = docker exec -e "SQLCMDPASSWORD=$demoSqlPassword" $demoContainer $demoSqlcmd -S localhost -U sa -C -d QLKS -b -I -i /tmp/populate_operating_demo.sql
$demoSeedExit = $LASTEXITCODE
$demoSeedLog = Join-Path $BackupDirectory "QLKS-operating-demo-$demoStamp.log"
[System.IO.File]::WriteAllLines($demoSeedLog, [string[]]$demoSeedOutput, (New-Object System.Text.UTF8Encoding($false)))
if ($demoSeedExit -ne 0) {
    $demoSeedOutput | Select-Object -Last 15 | Write-Output
    throw "Nạp demo thất bại; transaction đã rollback. Backup: $demoLocalBackup. Log: $demoSeedLog"
}
$demoSeedOutput | Select-Object -Last 10 | Write-Output
docker exec -e "SQLCMDPASSWORD=$demoSqlPassword" $demoContainer $demoSqlcmd -S localhost -U sa -C -d QLKS -b -I -W -i /tmp/verify_operating_demo.sql
if ($LASTEXITCODE -ne 0) { throw "Dữ liệu đã nạp nhưng kiểm tra chưa qua. Backup: $demoLocalBackup. Log: $demoSeedLog" }
Write-Output "Đã bổ sung dữ liệu hoạt động vào QLKS. Backup đã kiểm tra: $demoLocalBackup"

Invoke-OperatingDemoSql "SET NOCOUNT ON;
SELECT trangThai AS BookingStatus,COUNT(*) AS Qty FROM dbo.PhieuDatPhong GROUP BY trangThai;
SELECT hangThanhVien AS Membership,COUNT(*) AS Qty FROM dbo.KhachLuuTru GROUP BY hangThanhVien;
SELECT N'Employees' AS Item,COUNT(*) AS Qty FROM dbo.NhanVien
UNION ALL SELECT N'Invoices',COUNT(*) FROM dbo.HoaDon
UNION ALL SELECT N'Payments',COUNT(*) FROM dbo.GiaoDichThanhToan
UNION ALL SELECT N'HousekeepingTasks',COUNT(*) FROM dbo.NhiemVuBuongPhong
UNION ALL SELECT N'TechnicalOrders',COUNT(*) FROM dbo.PhieuCongViecKyThuat;"
