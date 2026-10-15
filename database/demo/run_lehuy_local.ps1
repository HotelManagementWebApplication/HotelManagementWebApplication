param(
    [string]$JdbcAuthDirectory = (Join-Path $PSScriptRoot '..\..\..\jdbc-auth\x64')
)
$ErrorActionPreference = 'Stop'
$repoDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$authDirectory = (Resolve-Path -LiteralPath $JdbcAuthDirectory).Path
if (-not (Test-Path (Join-Path $authDirectory 'mssql-jdbc_auth-12.8.1.x64.dll'))) {
    throw 'Thiếu Microsoft JDBC Windows Authentication 12.8.1 x64. Truyền -JdbcAuthDirectory tới thư mục driver đã cài.'
}
# Only this process and its child backend use the dedicated local database.
$env:DB_URL = 'jdbc:sqlserver://localhost:1433;databaseName=QLKS_LeHuy_Local;encrypt=true;trustServerCertificate=true;integratedSecurity=true'
$env:PATH = $authDirectory + ';' + $env:PATH
Push-Location (Join-Path $repoDirectory 'backend')
try {
    & mvn.cmd spring-boot:run
    if ($LASTEXITCODE -ne 0) { throw "Backend kết thúc với mã $LASTEXITCODE" }
} finally {
    Pop-Location
}
