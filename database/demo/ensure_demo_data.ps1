param(
    [string]$ContainerName = "web-hotel-mis-sqlserver-1433",
    [string]$Database = "QLKS",
    [string]$Username = "sa",
    [string]$Password = $(if ($env:MSSQL_SA_PASSWORD) { $env:MSSQL_SA_PASSWORD } elseif ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "Hotel_Mis_SqlServer_2026!" })
)

$ErrorActionPreference = "Stop"
$resetFile = Join-Path $PSScriptRoot "reset_demo.sql"

if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    throw "Tên database không hợp lệ. Chỉ chấp nhận chữ cái, số và dấu gạch dưới."
}
if (-not (Test-Path -LiteralPath $resetFile)) {
    throw "Không tìm thấy $resetFile"
}

$containerState = docker inspect $ContainerName --format '{{.State.Status}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $containerState -ne "running") {
    throw "SQL Server container '$ContainerName' chưa chạy. Chạy: docker compose up -d"
}
$health = docker inspect $ContainerName --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}'
if ($health -eq "unhealthy") {
    throw "SQL Server container '$ContainerName' đang unhealthy. Không seed để tránh ghi dữ liệu vào DB lỗi."
}

$sqlcmd = "/opt/mssql-tools18/bin/sqlcmd"
function Invoke-SqlQuery([string]$Query) {
    $result = docker exec $ContainerName $sqlcmd -S localhost -U $Username -P $Password -C -d $Database -b -h -1 -W -s "|" -Q $Query
    if ($LASTEXITCODE -ne 0) {
        throw "Không truy cập được database $Database trên container $ContainerName."
    }
    return $result
}

$tablesQuery = @"
SET NOCOUNT ON;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = N'dbo'
  AND table_type = N'BASE TABLE'
  AND table_name <> N'flyway_schema_history'
ORDER BY table_name;
"@
$tablesRaw = Invoke-SqlQuery $tablesQuery
$tableNames = @($tablesRaw -split '\r?\n' | ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^[A-Za-z0-9_]+$' })
if ($tableNames.Count -eq 0) {
    throw "Database chưa được Flyway tạo đủ bảng từ baseline V1. Hãy khởi động backend 8080 một lần rồi chạy lại script."
}

$requiredTables = @('Phong', 'DichVu', 'NhanVien', 'TaiKhoanKhachHang')
if (@($requiredTables | Where-Object { $_ -notin $tableNames }).Count -gt 0) {
    throw "Database $Database chưa có đủ bảng nghiệp vụ từ baseline V1. Hãy khởi động backend để Flyway hoàn tất migration."
}

$countSelects = @($tableNames | ForEach-Object {
    "SELECT N'$_' + N'|' + CONVERT(varchar(30), COUNT_BIG(*)) FROM dbo.[$_]"
})
$countsQuery = "SET NOCOUNT ON; " + ($countSelects -join ' UNION ALL ')
$countsRaw = Invoke-SqlQuery $countsQuery
$rowCounts = @{}
foreach ($line in ($countsRaw -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
    $parts = $line.Trim() -split '\|'
    if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[A-Za-z0-9_]+$' -or $parts[1] -notmatch '^\d+$') {
        throw "Không đọc được kết quả kiểm tra bảng; từ chối reset để tránh mất dữ liệu."
    }
    $rowCounts[$parts[0]] = [long]$parts[1]
}
if ($rowCounts.Count -ne $tableNames.Count) {
    throw "Chưa xác minh được số dòng của mọi bảng trong $Database; từ chối reset để tránh mất dữ liệu."
}

$rooms = $rowCounts['Phong']
$services = $rowCounts['DichVu']
$employees = $rowCounts['NhanVien']
$customers = $rowCounts['TaiKhoanKhachHang']
$nonEmptyTables = @($rowCounts.Keys | Where-Object { $rowCounts[$_] -gt 0 })
$nonEmptyBusinessTables = @($nonEmptyTables | Where-Object { $_ -ne 'NhomKhoaChongTrung' })
$bootstrapBucketCount = $rowCounts['NhomKhoaChongTrung']

if ($nonEmptyBusinessTables.Count -eq 0 -and ($bootstrapBucketCount -eq 0 -or $bootstrapBucketCount -eq 64)) {
    docker cp $resetFile "${ContainerName}:/tmp/reset_demo.sql" | Out-Null
    docker exec $ContainerName $sqlcmd -S localhost -U $Username -P $Password -C -d $Database -b -I -i /tmp/reset_demo.sql
    if ($LASTEXITCODE -ne 0) {
        throw "Nạp reset_demo.sql thất bại."
    }
    Write-Output "Đã nạp dữ liệu demo vào $Database trên SQL Server."
    exit 0
}

if ($rooms -gt 0 -and $services -gt 0 -and $employees -gt 0 -and $customers -gt 0) {
    Write-Output "Database $Database đã có dữ liệu; không reset và không xóa dữ liệu."
    exit 0
}

$nonEmptySummary = $nonEmptyTables -join ', '
throw "Database đang có dữ liệu nhưng chưa đủ fixture demo (Phong=$rooms, DichVu=$services, NhanVien=$employees, TaiKhoanKhachHang=$customers; bảng có dữ liệu: $nonEmptySummary). Không tự reset để tránh mất dữ liệu; cần kiểm tra thủ công."
