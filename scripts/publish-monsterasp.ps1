param(
  [string]$Project = "src/backend/ServiFinance.Api/ServiFinance.Api.csproj",
  [string]$PublishProfile = "site65642-WebDeploy.pubxml",
  [string]$Configuration = "Release",
  [string]$UserName = "site65642"
)

$password = $env:MONSTERASP_MSDEPLOY_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) {
  $securePassword = Read-Host "MonsterASP Web Deploy password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if ([string]::IsNullOrWhiteSpace($password)) {
  throw "MonsterASP Web Deploy password was not provided."
}

$projectPath = Join-Path $PSScriptRoot "..\$Project"
$projectDirectory = Split-Path -Parent $projectPath

Push-Location $projectDirectory
try {
  & dotnet publish $projectPath `
    -c $Configuration `
    -m:1 `
    "-p:PublishProfile=$PublishProfile" `
    "-p:UserName=$UserName" `
    "-p:Password=$password"

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
