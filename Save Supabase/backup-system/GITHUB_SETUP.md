# Configuration GitHub Actions pour le Backup ACLEF Planning

## 📋 Prérequis

Pour utiliser le workflow automatisé de sauvegarde, vous devez configurer les secrets GitHub.

## 🔑 Configuration des Secrets GitHub

1. **Accéder aux Settings du Repository**
   - Aller sur votre repository GitHub
   - Cliquer sur `Settings` (onglet en haut)
   - Dans le menu de gauche, cliquer sur `Secrets and variables` > `Actions`

2. **Ajouter les Secrets Requis**

   Cliquer sur `New repository secret` et ajouter :

   ### `SUPABASE_PLANNING_URL`
   ```
   https://mkbchdhbgdynxwfhpxbw.supabase.co
   ```

   ### `SUPABASE_PLANNING_SERVICE_KEY`
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw
   ```

## 🚀 Utilisation du Workflow

### Sauvegarde Automatique
- **Fréquence** : Tous les jours à 2h00 UTC (3h00 CET / 4h00 CEST)
- **Action** : Le workflow se déclenche automatiquement
- **Résultat** : Les fichiers de backup sont committés dans le repo

### Sauvegarde Manuelle
1. Aller sur l'onglet `Actions` de votre repository
2. Cliquer sur `ACLEF Planning Database Backup`
3. Cliquer sur `Run workflow`
4. (Optionnel) Ajouter une raison pour la sauvegarde manuelle
5. Cliquer sur `Run workflow` pour confirmer

## 📊 Résultats du Workflow

Le workflow génère automatiquement :

### Fichiers Créés
```
backups/
├── schema_discovery.json          # Schéma de la base découvert
└── complete_backup_YYYY-MM-DD.json # Sauvegarde complète avec données
```

### Commit Automatique
```
🔄 ACLEF Planning Database Backup - 2025-09-26 02:00:00 UTC

Backup Details:
- Reason: Scheduled automatic backup
- Tables: 30
- Total rows: 1,247
- File size: 2.4 MB
- Backup file: complete_backup_2025-09-26_02-00-15.json

🤖 Generated with Claude Code
```

## 🔧 Maintenance

### Nettoyage Automatique
- Le workflow garde automatiquement les **7 dernières sauvegardes**
- Les anciennes sauvegardes sont supprimées automatiquement
- Cela évite que le repository devienne trop volumineux

### Monitoring
- Les échecs de backup génèrent des erreurs visibles dans l'onglet Actions
- Configurez les notifications GitHub pour être alerté en cas d'échec

## ⚠️ Sécurité

- ✅ Les secrets sont chiffrés par GitHub
- ✅ Les SERVICE_KEY ne sont jamais affichées dans les logs
- ✅ Seuls les administrateurs du repo peuvent voir les secrets
- ✅ Les commits incluent un co-auteur Claude pour traçabilité

## 🛠️ Dépannage

### Erreur "Schema discovery failed"
- Vérifier que `SUPABASE_PLANNING_URL` est correct
- Vérifier que `SUPABASE_PLANNING_SERVICE_KEY` a les bonnes permissions

### Erreur "Permission denied"
- Vérifier que le token GitHub a les permissions `contents: write`
- Le workflow utilise automatiquement `GITHUB_TOKEN` pour les commits

### Workflow ne se déclenche pas
- Vérifier que le fichier est dans `.github/workflows/backup.yml`
- Vérifier la syntaxe YAML du workflow
- Les workflows sur les repos privés peuvent avoir des limitations

## 📞 Support

En cas de problème, vérifiez :
1. Les logs détaillés dans l'onglet Actions
2. Que tous les secrets sont configurés
3. Que le repository a les bonnes permissions