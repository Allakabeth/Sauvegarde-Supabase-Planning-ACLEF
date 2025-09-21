# MÉMO - État des Sauvegardes Supabase

## Situation actuelle
- ✅ Docker installé (nécessite redémarrage)
- ✅ Backup automatique JSON fonctionne (GitHub Actions)
- ❌ Manque le schéma complet pour restauration

## Après redémarrage

### 1. Lancer Docker Desktop
- Menu Démarrer → Docker Desktop
- Attendre icône verte dans barre des tâches

### 2. Tester Supabase CLI
```bash
supabase db dump --db-url="postgresql://postgres:Tours1975%26%26%26%26@db.mkbchdhbgdynxwfhpxbw.supabase.co:5432/postgres" --file=backup_complet.sql
```

### 3. Si ça marche
Le fichier `backup_complet.sql` contiendra TOUT (schéma + données).
Alors on pourra restaurer dans la base test.

## Informations importantes
- **Base production** : mkbchdhbgdynxwfhpxbw.supabase.co
- **Base test** : vqjkmveqzyaxsufbydit.supabase.co
- **Password** : Tours1975&&&&
- **Service role key** : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw

## Backup automatique qui fonctionne
- Workflow : `supabase-backup-simple.yml`
- Fréquence : Tous les soirs à minuit UTC
- Fichiers créés : `supabase-backups/complete_backup.json` + `data.sql`

## Problème à résoudre
Il nous faut le schéma complet (CREATE TABLE...) pour pouvoir restaurer dans une base vide.
Docker + Supabase CLI devrait résoudre ça.

## Test final nécessaire
1. Récupérer schéma complet avec Supabase CLI
2. Restaurer dans base test vqjkmveqzyaxsufbydit
3. Vérifier que la restauration fonctionne

**L'objectif : backup complet + restauration complète qui marche !**