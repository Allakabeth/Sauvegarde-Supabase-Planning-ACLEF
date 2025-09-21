# Guide de Sauvegarde et Restauration Supabase

## Nouvelle Méthode Recommandée (Supabase CLI)

Ce projet utilise maintenant la méthode recommandée par Supabase pour les sauvegardes automatiques.

### Configuration GitHub Actions

1. **Variables requises dans GitHub** :
   - `BACKUP_ENABLED` : `true` ou `false` (variable)
   - `SUPABASE_DB_URL` : URL complète de connexion (secret)

2. **Fichiers de sauvegarde générés** :
   - `supabase-backups/roles.sql` : Rôles et permissions
   - `supabase-backups/schema.sql` : Structure de la base
   - `supabase-backups/data.sql` : Données des tables

### Installation des Outils (si non installés)

**Windows (avec Scoop) :**
```powershell
# Installation de Scoop d'abord
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod get.scoop.sh | Invoke-Expression

# Installation des outils
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
scoop install postgresql
```

**macOS :**
```bash
brew install supabase/tap/supabase
brew install postgresql
```

### Restauration

**Méthode 1 - Script Node.js :**
```bash
node scripts/restore-database.js
```

**Méthode 2 - Script PowerShell (Windows) :**
```powershell
.\scripts\restore-database.ps1
```

**Méthode 3 - Manuelle :**
```bash
# 1. Réinitialiser la base
supabase db reset --db-url="VOTRE_SUPABASE_DB_URL"

# 2. Restaurer les rôles
supabase db psql --db-url="VOTRE_SUPABASE_DB_URL" -f supabase-backups/roles.sql

# 3. Restaurer le schéma
supabase db psql --db-url="VOTRE_SUPABASE_DB_URL" -f supabase-backups/schema.sql

# 4. Restaurer les données
supabase db psql --db-url="VOTRE_SUPABASE_DB_URL" -f supabase-backups/data.sql
```

### Avantages de cette méthode

✅ **Backup complet** - Contourne les limitations RLS
✅ **Séparation claire** - Rôles, schéma et données séparés
✅ **Restauration progressive** - Contrôle total du processus
✅ **Outils officiels** - Utilise Supabase CLI natif
✅ **Format standard** - Fichiers SQL PostgreSQL standard

### Migration depuis l'ancien système

L'ancien système JSON est maintenant obsolète. Cette nouvelle méthode :
- Évite les problèmes de permissions RLS
- Garantit un backup complet de toutes les tables
- Permet une restauration propre sans erreurs de schéma

### Planification

- **Fréquence** : Quotidienne à minuit UTC
- **Stockage** : Commits automatiques dans le dépôt GitHub
- **Rétention** : Historique complet via Git