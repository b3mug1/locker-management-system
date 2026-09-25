<#
.SYNOPSIS
    Automated deployment script for Locker Management System to Microsoft Azure.
.DESCRIPTION
    Provisions Azure Container Apps Environment, Azure Container Registry (ACR),
    builds Backend and Frontend container images via ACR Tasks,
    configures PostgreSQL, and deploys both microservices with WebSockets and reverse proxy.
#>

[CmdletBinding()]
param(
    [string]$ResourceGroupName = "rg-locker-system",
    [string]$Location = "northeurope",
    [string]$AcrPrefix = "acrlocker",
    [string]$EnvName = "cae-locker-system",
    [string]$BackendAppName = "locker-backend",
    [string]$FrontendAppName = "locker-frontend",
    [string]$PostgresUser = "locker_admin",
    [string]$PostgresPassword = "LockerSecretPass2026!",
    [string]$PostgresDb = "locker_db"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   Deploying Locker Management System to Microsoft Azure" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verify az cli login
Write-Host "[1/7] Checking Azure CLI authentication..." -ForegroundColor Yellow
$currentAccount = az account show --output json 2>$null | ConvertFrom-Json
if (-not $currentAccount) {
    Write-Error "Not authenticated in Azure CLI. Please run 'az login' first."
}
Write-Host "Logged in to subscription: $($currentAccount.name) ($($currentAccount.id))" -ForegroundColor Green

# 2. Register required resource providers
Write-Host "[2/7] Ensuring Azure providers are registered..." -ForegroundColor Yellow
az provider register --namespace Microsoft.App --wait 2>$null
az provider register --namespace Microsoft.OperationalInsights --wait 2>$null
az provider register --namespace Microsoft.ContainerRegistry --wait 2>$null

# 3. Create Resource Group
Write-Host "[3/7] Creating Resource Group: $ResourceGroupName in $Location..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location --output table

# 4. Create Azure Container Registry (ACR)
$uniqueId = (Get-Random -Minimum 1000 -Maximum 9999).ToString()
$AcrName = "$AcrPrefix$uniqueId"
Write-Host "[4/7] Creating Azure Container Registry: $AcrName..." -ForegroundColor Yellow
az acr create --resource-group $ResourceGroupName --name $AcrName --sku Basic --admin-enabled true --location $Location --output table

$acrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroupName --query "loginServer" --output tsv
$acrAdminUser = az acr credential show --name $AcrName --query "username" --output tsv
$acrAdminPass = az acr credential show --name $AcrName --query "passwords[0].value" --output tsv

# 5. Build Container Images in ACR (Cloud Build)
Write-Host "[5/7] Building Backend and Frontend Docker images in ACR..." -ForegroundColor Yellow
Write-Host "-> Building Backend..." -ForegroundColor Cyan
az acr build --registry $AcrName --image "locker-backend:latest" "./backend"

Write-Host "-> Building Frontend..." -ForegroundColor Cyan
az acr build --registry $AcrName --image "locker-frontend:latest" "./frontend"

# 6. Create Azure Container Apps Environment
Write-Host "[6/7] Creating Container Apps Environment: $EnvName..." -ForegroundColor Yellow
az containerapp env create `
    --name $EnvName `
    --resource-group $ResourceGroupName `
    --location $Location `
    --output table

# 7. Deploy PostgreSQL container inside Container Apps
Write-Host "-> Deploying PostgreSQL container app..." -ForegroundColor Cyan
$postgresAppName = "locker-postgres"
az containerapp create `
    --name $postgresAppName `
    --resource-group $ResourceGroupName `
    --environment $EnvName `
    --image "postgres:16-alpine" `
    --target-port 5432 `
    --ingress internal `
    --cpu 0.5 --memory 1.0Gi `
    --env-vars `
        POSTGRES_USER=$PostgresUser `
        POSTGRES_PASSWORD=$PostgresPassword `
        POSTGRES_DB=$PostgresDb `
    --output table

$dbHost = $postgresAppName
$dbUrlSync = "postgresql://${PostgresUser}:${PostgresPassword}@${dbHost}:5432/${PostgresDb}"
$dbUrlAsync = "postgresql+asyncpg://${PostgresUser}:${PostgresPassword}@${dbHost}:5432/${PostgresDb}"

# 8. Deploy Backend Container App
Write-Host "-> Deploying Backend container app ($BackendAppName)..." -ForegroundColor Cyan
az containerapp create `
    --name $BackendAppName `
    --resource-group $ResourceGroupName `
    --environment $EnvName `
    --image "$acrLoginServer/locker-backend:latest" `
    --registry-server $acrLoginServer `
    --registry-username $acrAdminUser `
    --registry-password $acrAdminPass `
    --target-port 8000 `
    --ingress internal `
    --cpu 0.5 --memory 1.0Gi `
    --env-vars `
        POSTGRES_HOST=$dbHost `
        POSTGRES_PORT=5432 `
        POSTGRES_USER=$PostgresUser `
        POSTGRES_PASSWORD=$PostgresPassword `
        POSTGRES_DB=$PostgresDb `
        DATABASE_URL=$dbUrlAsync `
        DATABASE_URL_SYNC=$dbUrlSync `
        SECRET_KEY="locker_secret_production_key_$(Get-Random)" `
        BACKEND_CORS_ORIGINS='["*"]' `
        FIRST_ADMIN_EMAIL="admin@locker.com" `
        FIRST_ADMIN_PASSWORD="admin123" `
    --output table

# 9. Deploy Frontend Container App (External Ingress)
Write-Host "-> Deploying Frontend container app ($FrontendAppName)..." -ForegroundColor Cyan
az containerapp create `
    --name $FrontendAppName `
    --resource-group $ResourceGroupName `
    --environment $EnvName `
    --image "$acrLoginServer/locker-frontend:latest" `
    --registry-server $acrLoginServer `
    --registry-username $acrAdminUser `
    --registry-password $acrAdminPass `
    --target-port 80 `
    --ingress external `
    --cpu 0.5 --memory 1.0Gi `
    --env-vars `
        BACKEND_URL="http://$BackendAppName" `
    --output table

# 10. Get Frontend URL
$frontendFqdn = az containerapp show `
    --name $FrontendAppName `
    --resource-group $ResourceGroupName `
    --query "properties.configuration.ingress.fqdn" `
    --output tsv

Write-Host "============================================================" -ForegroundColor Green
Write-Host "   DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Application URL : https://$frontendFqdn" -ForegroundColor Cyan
Write-Host "Admin Email     : admin@locker.com" -ForegroundColor Cyan
Write-Host "Admin Password  : admin123" -ForegroundColor Cyan
Write-Host "Resource Group  : $ResourceGroupName" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green
