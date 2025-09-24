# Guide d'utilisation MCP Supabase ACLEF

## Configuration terminée ✅

Votre serveur MCP Supabase est maintenant configuré et prêt à être utilisé avec Claude Code.

## Fichiers créés

1. **`mcp-supabase-server.js`** - Serveur MCP personnalisé
2. **`package.json`** - Configuration des dépendances Node.js
3. **`C:\Users\ACLEF25\.mcp.json`** - Configuration MCP pour Claude Code

## Redémarrage requis

**IMPORTANT** : Pour que Claude Code reconnaisse le nouveau serveur MCP, vous devez :

1. Fermer complètement Claude Code
2. Redémarrer Claude Code
3. Le serveur MCP `supabase-aclef` sera automatiquement disponible

## Outils disponibles après redémarrage

Une fois Claude Code redémarré, vous aurez accès aux outils MCP suivants :

### 🔍 Exploration de la base
- **`list_tables`** - Liste toutes les tables
- **`describe_table`** - Décrit la structure d'une table
- **`get_table_data`** - Récupère les données avec pagination

### 📝 Manipulation des données
- **`insert_data`** - Insère de nouvelles données
- **`update_data`** - Met à jour des données existantes
- **`delete_data`** - Supprime des données

### ⚡ Requêtes SQL
- **`query_database`** - Exécute des requêtes SQL personnalisées

## Exemples d'utilisation

Après redémarrage, vous pourrez demander :

```
"Liste-moi toutes les tables de ma base Supabase"
"Montre-moi les 10 premiers utilisateurs"
"Décris la structure de la table planning_formateurs"
"Exécute cette requête SQL : SELECT * FROM users WHERE role = 'admin'"
```

## Sécurité

- Le serveur utilise votre clé `SERVICE_ROLE` pour un accès complet
- Les clés sont stockées dans la configuration MCP
- Toutes les opérations sont sécurisées via Supabase

## Statut

✅ Serveur MCP créé et testé
✅ Configuration MCP installée
✅ Dépendances installées
⏳ **Redémarrage de Claude Code requis**

## Prochaines étapes

1. **Redémarrez Claude Code maintenant**
2. Testez avec : `"Liste les tables de ma base Supabase"`
3. Explorez vos données via les outils MCP

---
*Guide créé le 23/09/2025 - Serveur MCP Supabase ACLEF v1.0*