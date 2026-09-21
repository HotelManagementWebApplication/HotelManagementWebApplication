param(
    [string]$ContainerName = "web-hotel-mis-mysql-3307",
    [string]$Database = "QLKS",
    [string]$Username = "root",
    [string]$Password = $(if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { "hotel_mis_local" })
)

$ErrorActionPreference = "Stop"
$resetFile = Join-Path $PSScriptRoot "reset_demo.sql"

if (-not (Test-Path -LiteralPath $resetFile)) {
    throw "Không tìm thấy $resetFile"
}

$containerState = docker inspect $ContainerName --format '{{.State.Status}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $containerState -ne "running") {
    throw "MySQL container '$ContainerName' chưa chạy. Chạy: docker compose up -d mysql"
}

$health = docker inspect $ContainerName --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}'
if ($health -eq "unhealthy") {
    throw "MySQL container '$ContainerName' đang unhealthy. Không seed để tránh ghi dữ liệu vào DB lỗi."
}

$query = @"
SELECT CONCAT(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_name='rooms'), '|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_name='services'), '|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_name='employees'), '|',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_name='customer_accounts'), '|',
    (SELECT COUNT(*) FROM $Database.rooms), '|',
    (SELECT COUNT(*) FROM $Database.services), '|',
    (SELECT COUNT(*) FROM $Database.employees), '|',
    (SELECT COUNT(*) FROM $Database.customer_accounts)
);
"@

$mysqlArgs = @("-u$Username", "-Nse", $query)
$raw = docker exec -e "MYSQL_PWD=$Password" $ContainerName mysql @mysqlArgs
if ($LASTEXITCODE -ne 0) {
    throw "Không truy cập được database $Database trên container $ContainerName."
}

$values = $raw.Trim() -split '\|'
if ($values.Count -ne 8) {
    throw "Database chưa được Flyway tạo đủ bảng. Hãy khởi động backend 8080 một lần để chạy migration rồi chạy lại script."
}

$tableRooms, $tableServices, $tableEmployees, $tableCustomers, $rooms, $services, $employees, $customers = $values | ForEach-Object { [int]$_ }
if (($tableRooms + $tableServices + $tableEmployees + $tableCustomers) -lt 4) {
    throw "Database $Database chưa có đủ bảng nghiệp vụ. Hãy khởi động backend để Flyway hoàn tất migration."
}

if ($rooms -eq 0 -and $services -eq 0 -and $employees -eq 0 -and $customers -eq 0) {
    docker cp $resetFile "${ContainerName}:/tmp/reset_demo.sql" | Out-Null
    docker exec -e "MYSQL_PWD=$Password" $ContainerName sh -c "mysql -u$Username $Database < /tmp/reset_demo.sql"
    if ($LASTEXITCODE -ne 0) {
        throw "Nạp reset_demo.sql thất bại."
    }
    Write-Output "Đã nạp dữ liệu demo vào $Database."
    exit 0
}

if ($rooms -gt 0 -and $services -gt 0 -and $employees -gt 0 -and $customers -gt 0) {
    Write-Output "Database $Database đã có dữ liệu; không reset và không xóa dữ liệu."
    exit 0
}

throw "Database đang ở trạng thái dữ liệu không đầy đủ (rooms=$rooms, services=$services, employees=$employees, customer_accounts=$customers). Không tự reset để tránh mất dữ liệu; cần kiểm tra thủ công."
