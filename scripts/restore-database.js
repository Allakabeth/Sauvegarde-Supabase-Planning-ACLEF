#!/usr/bin/env node

/**
 * Script de restauration de base de données Supabase
 * Basé sur le tutoriel : utilise les fichiers roles.sql, schema.sql, data.sql
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const BACKUP_DIR = 'supabase-backups';
const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
    console.error('❌ SUPABASE_DB_URL non définie dans .env');
    process.exit(1);
}

console.log('🔄 Début de la restauration de la base de données...\n');

try {
    // Vérifier que les fichiers de backup existent
    const requiredFiles = ['roles.sql', 'schema.sql', 'data.sql'];
    for (const file of requiredFiles) {
        const filePath = path.join(BACKUP_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Fichier manquant: ${filePath}`);
            process.exit(1);
        }
    }

    console.log('✅ Tous les fichiers de backup sont présents\n');

    // Étape 1: Réinitialisation de la base de données
    console.log('🗑️  Réinitialisation de la base de données...');
    execSync(`supabase db reset --db-url="${DB_URL}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
    });
    console.log('✅ Base de données réinitialisée\n');

    // Étape 2: Restauration des rôles
    console.log('👥 Restauration des rôles...');
    execSync(`supabase db psql --db-url="${DB_URL}" -f ${path.join(BACKUP_DIR, 'roles.sql')}`, {
        stdio: 'inherit',
        cwd: process.cwd()
    });
    console.log('✅ Rôles restaurés\n');

    // Étape 3: Restauration du schéma
    console.log('🏗️  Restauration du schéma...');
    execSync(`supabase db psql --db-url="${DB_URL}" -f ${path.join(BACKUP_DIR, 'schema.sql')}`, {
        stdio: 'inherit',
        cwd: process.cwd()
    });
    console.log('✅ Schéma restauré\n');

    // Étape 4: Restauration des données
    console.log('📊 Restauration des données...');
    execSync(`supabase db psql --db-url="${DB_URL}" -f ${path.join(BACKUP_DIR, 'data.sql')}`, {
        stdio: 'inherit',
        cwd: process.cwd()
    });
    console.log('✅ Données restaurées\n');

    console.log('🎉 Restauration terminée avec succès !');
    console.log('💡 Vérifiez votre tableau de bord Supabase pour confirmer la restauration.');

} catch (error) {
    console.error('❌ Erreur durante la restauration:', error.message);
    process.exit(1);
}