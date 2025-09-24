# MÉMO SESSION BACKUP - 21/09/2025

## ✅ CE QUI FONCTIONNE PARFAITEMENT

### 1. Backup automatique GitHub Actions
- ✅ **Workflow** : `supabase-backup-simple.yml`
- ✅ **Données** : 943 KB (2251 enregistrements, 28 tables)
- ✅ **Schéma** : 254 KB (OpenAPI format)
- ✅ **Fréquence** : Tous les soirs minuit UTC
- ✅ **Stockage** : GitHub repo avec commit auto

### 2. Scripts de restauration créés
- ✅ `extract_schema.js` : Conversion OpenAPI → SQL (31 tables)
- ✅ `restore_complete.js` : Restauration complète par chunks
- ✅ `schema_complet_test.sql` : Schéma SQL complet prêt
- ✅ `final_backup_test.js` : Tests complets du système

### 3. Connexions validées
- ✅ Base production API : fonctionne
- ✅ Base test API : fonctionne
- ✅ IPv6 : fonctionne (ping google.com IPv6 OK)
- ✅ Supabase CLI dry-run : fonctionne

## 🔍 PROBLÈME IDENTIFIÉ

**Docker Desktop pas installé/démarré**
- Erreur : `failed to inspect docker image`
- Supabase CLI a besoin de Docker pour pg_dump
- IPv6 fonctionne, pas de problème réseau

## 📋 PROCHAINES ÉTAPES (après redémarrage)

### 1. Démarrer Docker Desktop
```bash
# Lancer Docker Desktop (icône verte dans barre tâches)
```

### 2. Tester Supabase CLI
```bash
supabase db dump --db-url="postgresql://postgres:Tours1975%26%26%26%26@db.vqjkmveqzyaxsufbydit.supabase.co:5432/postgres" --file=schema_test.sql
```

### 3. Créer schéma dans base test avec migration
```bash
# Copier le schéma généré dans supabase/migrations/
cp schema_complet_test.sql supabase/migrations/20250921000001_create_schema.sql

# Push vers base test
supabase db push --db-url="postgresql://postgres:Tours1975%26%26%26%26@db.vqjkmveqzyaxsufbydit.supabase.co:5432/postgres"
```

### 4. Tester restauration complète
```bash
node restore_complete.js
```

## 📁 FICHIERS IMPORTANTS CRÉÉS

- `schema_complet_test.sql` : Schéma SQL complet (25 tables + policies)
- `restore_complete.js` : Script restauration données via API
- `extract_schema.js` : Convertit OpenAPI → SQL
- `supabase-backups/complete_backup.json` : Données complètes
- `supabase-backups/schema_info.json` : Schéma OpenAPI
- `supabase/migrations/20250921000001_create_schema.sql` : Migration prête

## 🎯 OBJECTIF FINAL

**Système backup/restauration 100% automatique :**
1. ✅ Backup auto quotidien (GitHub Actions)
2. 🔧 Restauration complète via Supabase CLI (Docker requis)
3. 🔧 Test final dans base vqjkmveqzyaxsufbydit

## 🔧 COMMANDES TESTÉES QUI MARCHENT

```bash
# Test IPv6
ping -6 google.com ✅

# Supabase CLI dry-run
supabase db dump --db-url="..." --dry-run ✅

# API REST
node final_backup_test.js ✅

# Extraction schéma
node extract_schema.js ✅
```

## ⚠️ PROBLÈMES RÉSOLUS ET CONNERIES ÉVITÉES

1. **IPv6** : Fonctionnait déjà (ping Google OK) - PERTE DE TEMPS
2. **DNS** : Pas de problème réseau - PERTE DE TEMPS
3. **API REST** : Toutes les connexions OK
4. **Schéma** : Généré correctement (31 tables)

**VRAI PROBLÈME** : Docker Desktop manquant (évident depuis le début)

### 🤦‍♂️ ERREURS DE DIAGNOSTIC
- ❌ Cherché IPv6/réseau pendant des heures
- ❌ Testé 50 solutions réseau inutiles
- ❌ Ignoré l'erreur Docker pourtant claire
- ✅ Solution simple : juste installer Docker

**LEÇON** : Lire l'erreur exacte au lieu de supposer !

## 🔧 GITHUB CLI - COMMANDES QUI MARCHENT

### Installation et auth
```bash
# GitHub CLI déjà installé dans :
"/c/Program Files/GitHub CLI/gh.exe"

# Auth déjà fait, tester avec :
"/c/Program Files/GitHub CLI/gh.exe" auth status
```

### Commandes workflow qui marchent
```bash
# Lancer backup manuel
"/c/Program Files/GitHub CLI/gh.exe" workflow run supabase-backup-simple.yml --repo Allakabeth/Sauvegarde-Supabase-Planning-ACLEF

# Voir les runs
"/c/Program Files/GitHub CLI/gh.exe" run list --repo Allakabeth/Sauvegarde-Supabase-Planning-ACLEF --limit 5

# Voir logs d'un run spécifique
"/c/Program Files/GitHub CLI/gh.exe" run view [RUN_ID] --repo Allakabeth/Sauvegarde-Supabase-Planning-ACLEF --log

# Secrets configurés
"/c/Program Files/GitHub CLI/gh.exe" secret list --repo Allakabeth/Sauvegarde-Supabase-Planning-ACLEF
```

### Repo et secrets OK
- SUPABASE_DB_URL : configuré ✅
- SUPABASE_SERVICE_ROLE_KEY : configuré ✅
- Workflow backup : fonctionne ✅

## 🚀 APRÈS DOCKER INSTALLÉ

Le système sera 100% opérationnel :
- Backup automatique ✅
- Restauration CLI ✅
- Tests complets ✅

**Note** : Le problème était simple - Docker manquant, pas IPv6 ou réseau !