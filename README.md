# Sauvegarde BDD Planning ACLEF

Backup automatique de la base de données Planning ACLEF.

## 🎯 Fonctionnalités

- **Backup automatique** tous les jours à 2h du matin
- **Découverte dynamique** de toutes les tables
- **Déclenchement manuel** possible via GitHub Actions
- **Sauvegarde complète** : structure + données

## 🚀 Utilisation

### Backup automatique
Le backup se lance automatiquement chaque nuit à 2h.

### Backup manuel
1. Aller sur GitHub Actions
2. Sélectionner "Backup Planning ACLEF"
3. Cliquer "Run workflow"
4. Cliquer "Run workflow" pour confirmer

## 📁 Structure des backups

```
backup-YYYY-MM-DD/
├── manifest.json           # Informations du backup
├── complete-backup.json    # Backup complet
├── table1.json            # Données table 1
├── table2.json            # Données table 2
└── ...                    # Une table par fichier
```

## ⚙️ Configuration

Le script utilise les variables d'environnement :
- `SUPABASE_URL` : URL de la base Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service (dans GitHub Secrets)

## 📊 Statut

- ✅ Découverte automatique des tables
- ✅ Backup complet des données
- ✅ Déclenchement manuel possible
- ✅ Commits automatiques sur GitHub