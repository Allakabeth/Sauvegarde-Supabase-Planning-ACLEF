# Script de restauration de base de données Supabase pour Windows
# Basé sur le tutoriel : utilise les fichiers roles.sql, schema.sql, data.sql

param(
    [string]$BackupDir = "supabase-backups",
    [string]$EnvFile = ".env"
)

Write-Host "🔄 Début de la restauration de la base de données..." -ForegroundColor Cyan

# Charger les variables d'environnement depuis .env
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
} else {
    Write-Host "❌ Fichier .env non trouvé" -ForegroundColor Red
    exit 1
}

$DB_URL = $env:SUPABASE_DB_URL
if (-not $DB_URL) {
    Write-Host "❌ SUPABASE_DB_URL non définie dans .env" -ForegroundColor Red
    exit 1
}

# Vérifier que les fichiers de backup existent
$requiredFiles = @("roles.sql", "schema.sql", "data.sql")
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $BackupDir $file
    if (-not (Test-Path $filePath)) {
        Write-Host "❌ Fichier manquant: $filePath" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Tous les fichiers de backup sont présents`n" -ForegroundColor Green

try {
    # Étape 1: Réinitialisation de la base de données
    Write-Host "🗑️  Réinitialisation de la base de données..." -ForegroundColor Yellow
    supabase db reset --db-url="$DB_URL"
    Write-Host "✅ Base de données réinitialisée`n" -ForegroundColor Green

    # Étape 2: Restauration des rôles
    Write-Host "👥 Restauration des rôles..." -ForegroundColor Yellow
    supabase db psql --db-url="$DB_URL" -f (Join-Path $BackupDir "roles.sql")
    Write-Host "✅ Rôles restaurés`n" -ForegroundColor Green

    # Étape 3: Restauration du schéma
    Write-Host "🏗️  Restauration du schéma..." -ForegroundColor Yellow
    supabase db psql --db-url="$DB_URL" -f (Join-Path $BackupDir "schema.sql")
    Write-Host "✅ Schéma restauré`n" -ForegroundColor Green

    # Étape 4: Restauration des données
    Write-Host "📊 Restauration des données..." -ForegroundColor Yellow
    supabase db psql --db-url="$DB_URL" -f (Join-Path $BackupDir "data.sql")
    Write-Host "✅ Données restaurées`n" -ForegroundColor Green

    Write-Host "🎉 Restauration terminée avec succès !" -ForegroundColor Green
    Write-Host "💡 Vérifiez votre tableau de bord Supabase pour confirmer la restauration." -ForegroundColor Cyan

} catch {
    Write-Host "❌ Erreur durante la restauration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}