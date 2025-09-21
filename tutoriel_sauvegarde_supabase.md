# Tutoriel Complet : Sauvegarde et Restauration Automatiques de Base de Données Supabase

## Partie 1 : Configuration des Sauvegardes Automatiques

### Introduction

Votre base de données Supabase se sauvegarde-t-elle automatiquement ? Savez-vous comment la configurer gratuitement en quelques minutes ? Et plus important encore, si quelque chose se casse, savez-vous comment la restaurer comme un professionnel ?

Si vous avez répondu non à l'une de ces questions, restez avec nous. À la fin de cette vidéo, vous aurez non seulement des sauvegardes automatiques qui fonctionnent comme une horloge, mais vous saurez aussi comment restaurer votre base de données étape par étape, de la bonne manière.

### Qu'est-ce qu'une GitHub Action ?

Avant de plonger dans la configuration, faisons un petit détour. Que sont exactement les GitHub Actions ? Pensez-y comme à des workflows programmables qui s'exécutent chaque fois que quelque chose se passe dans votre dépôt :
- Poussez du code → une action peut le tester
- Ouvrez une pull request → une action peut la déployer

Dans notre cas, nous créerons et exécuterons une GitHub Action qui travaillera selon un planning pour sauvegarder notre base de données chaque nuit comme une horloge. C'est comme avoir un assistant personnel pour votre dépôt : efficace, fiable et toujours à l'heure.

Le meilleur ? Cela fonctionne dans l'environnement cloud de GitHub gratuitement, donc vous n'avez besoin d'aucun serveur supplémentaire ou configuration compliquée.

### Configuration de la GitHub Action

Voici la configuration : notre GitHub Action sauvegardera automatiquement notre base de données Supabase chaque nuit à minuit et créera un nouveau commit avec ces nouveaux fichiers. Une fois configurée, vous n'avez plus besoin d'y toucher - elle continuera à fonctionner pour toujours.

#### Structure des Fichiers

Nous devons avoir un dossier appelé `.github` dans notre dépôt et à l'intérieur, un dossier appelé `workflows`. Tout fichier YAML valide que nous plaçons ici sera reconnu comme une action par GitHub.

#### Configuration du Fichier YAML

Dans ce fichier YAML, nous avons défini :

**Nom de l'action :**
```yaml
name: supabase-backup
```

**Déclencheurs :**
- Push ou pull request sur les branches Main et Dev
- **Planification** (le principal qui nous intéresse) : utilisation d'une définition cron pour définir des périodes arbitraires (chaque minute, chaque heure, toutes les 12 heures, etc.)

**Section Jobs :**
- **run-on :** `ubuntu-latest` (environnement virtuel Linux propre)
- **permissions :** `contents: write` (pour pousser les fichiers de sauvegarde)
- **variables d'environnement :** `SUPABASE_DB_URL` (tiré des secrets GitHub pour la sécurité)

#### Variable d'Environnement du Dépôt

Pour contrôler les sauvegardes sans modifier le code, nous utilisons une variable `BACKUP_ENABLED` :
- `true` : active les sauvegardes
- `false` : désactive les sauvegardes

**Configuration :**
1. Allez dans l'onglet Settings de votre dépôt
2. Sidebar gauche → "Secrets and variables" → "Actions"
3. Cliquez sur "New repository variable"
4. Nom : `BACKUP_ENABLED`
5. Valeur : `true` ou `false`

### Code de la GitHub Action

#### Étapes du Workflow

1. **Checkout** : Récupère la dernière version du code
2. **Configuration Supabase CLI** : Installe l'outil de dump de base de données
3. **Création du répertoire** : Stockage des fichiers de sauvegarde (ex: `prisma-backups`)
4. **Dump de la base de données** (en 3 étapes modulaires) :
   - Rôles
   - Schéma
   - Données
5. **Commit automatique** : Utilise une action pour commiter les fichiers avec le message "supabase backup"

### Chaîne de Connexion Supabase

Pour faire fonctionner notre GitHub Action, nous avons besoin de l'URL de la base de données Supabase :

1. Connectez-vous à votre compte Supabase
2. Sélectionnez votre projet
3. Cliquez sur "Connect" en haut de l'écran
4. Section "Connection string" → copiez la chaîne
5. Si vous n'avez pas le mot de passe : Settings → Database → "Reset database server"

**Stockage sécurisé dans GitHub :**
1. Settings → Secrets and variables → Actions
2. "New repository secret"
3. Nom : `SUPABASE_DB_URL`
4. Valeur : chaîne de connexion avec le vrai mot de passe
5. "Add secret"

### Fichiers de Sauvegarde

Quand cette GitHub Action s'exécute à minuit, trois fichiers seront commités dans votre dépôt dans le dossier `prisma-backups` :

- **`roles.sql`** : Rôles utilisateur et permissions (qui peut accéder à quoi)
- **`schema.sql`** : Structure de la base de données (tables, index, contraintes)
- **`data.sql`** : Données réelles dans vos tables

Ensemble, ces fichiers permettent de reconstruire votre base de données exactement comme elle était.

---

## Partie 2 : Restauration de la Base de Données

### Introduction

Dans la première partie, nous avons appris à créer une GitHub Action qui sauvegarde automatiquement notre base de données à la période désirée. Dans cette partie, nous apprendrons comment restaurer notre base de données en utilisant ces trois fichiers si un accident se produit.

### Installation des Outils Nécessaires

#### Supabase CLI

**MacOS :**
```bash
brew install supabase/tap/supabase
```

**Windows (avec Scoop) :**
```powershell
# Installation de Scoop d'abord (voir scoop.sh)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### PostgreSQL CLI (psql)

**MacOS :**
```bash
brew install postgresql
```

**Windows :**
```bash
scoop install postgresql
```

### Préparation à la Restauration

#### Chaîne de Connexion Supabase

**Important :** GitHub ne permet pas de voir les valeurs des secrets après les avoir définis. Gardez votre chaîne de connexion dans un endroit sûr mais accessible pour les situations d'urgence.

#### Fichiers de Sauvegarde SQL

Récupérez vos fichiers `roles.sql`, `schema.sql` et `data.sql` en clonant votre dépôt au commit que vous voulez restaurer.

### Processus de Restauration

#### 1. Réinitialisation de la Base de Données

**Important :** Les commandes ne remplacent pas la base de données, elles chargent simplement le contenu des fichiers. Il faut d'abord nettoyer la base :

```bash
supabase db reset --db-url="VOTRE_SUPABASE_DB_URL"
```

#### 2. Restauration des Rôles

```bash
supabase db psql --db-url="VOTRE_SUPABASE_DB_URL" -f roles.sql
```

Cette commande restaure tous les rôles utilisateur et permissions.

#### 3. Restauration du Schéma

```bash
supabase db psql --db-url="VOTRE_SUPABASE_DB_URL" -f schema.sql
```

Cette étape reconstruit la structure de votre base de données (tables, index, contraintes).

#### 4. Restauration des Données

```bash
supabase db psql --db-url="VOTRE_SUPABASE_DB_URL" -f data.sql
```

Cette étape finale repopule vos tables avec les données de votre sauvegarde.

### Vérification

1. Retournez sur votre tableau de bord Supabase
2. Vérifiez que vos rôles, schéma et données sont entièrement restaurés
3. Testez quelques requêtes pour confirmer que tout fonctionne comme attendu

## Conclusion

Vous avez maintenant des sauvegardes quotidiennes automatiques de Supabase et une méthode simple et professionnelle pour restaurer votre base de données quand nécessaire.

### Notes Importantes

- Vous pouvez augmenter la fréquence des sauvegardes (ex: toutes les 3 heures) avec la définition cron
- Un compte GitHub gratuit inclut 2 000 minutes d'exécution d'actions par mois (≈ 33 heures)
- Cette configuration fonctionne autant pour les projets de loisir que pour les applications de production

**Gardez vos données en sécurité !** 🚀