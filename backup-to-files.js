#!/usr/bin/env node

/**
 * VRAI backup vers fichiers pour GitHub Actions
 * Crée les fichiers JSON/SQL que Claude pourra lire pour restaurer
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Configuration via variables d'environnement (pour GitHub Actions)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkbchdhbgdynxwfhpxbw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getTableStructure(tableName) {
    console.log(`📋 Structure: ${tableName}`);

    try {
        // Essayer d'obtenir la structure en récupérant un échantillon
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (error) {
            console.error(`❌ Erreur structure ${tableName}:`, error);
            return null;
        }

        if (!data || data.length === 0) {
            return []; // Table vide
        }

        // Déduire la structure depuis l'échantillon
        const sample = data[0];
        const structure = Object.keys(sample).map(col => ({
            column_name: col,
            data_type: typeof sample[col] === 'object' && sample[col] !== null
                ? (Array.isArray(sample[col]) ? 'array' : 'jsonb')
                : typeof sample[col],
            is_nullable: sample[col] === null ? 'YES' : 'NO',
            column_default: null
        }));

        return structure;
    } catch (err) {
        console.error(`❌ Erreur structure ${tableName}:`, err.message);
        return null;
    }
}

async function getTableData(tableName) {
    console.log(`📊 Données: ${tableName}`);

    let allData = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + limit - 1);

        if (error) {
            console.error(`❌ Erreur données ${tableName}:`, error);
            break;
        }

        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        from += limit;

        if (data.length < limit) break;
    }

    console.log(`  ✅ ${tableName}: ${allData.length} enregistrements`);
    return allData;
}

async function getAllTables() {
    console.log('📋 Découverte automatique des tables...');

    try {
        // Utiliser une requête SQL directe pour éviter les problèmes de schéma
        const { data, error } = await supabase.rpc('get_tables');

        if (error) {
            console.error('❌ Erreur RPC get_tables:', error.message);
            // Fallback: essayer une méthode alternative
            return await getTablesAlternative();
        }

        const tables = data.map(row => row.table_name);
        console.log(`📋 ${tables.length} tables découvertes via RPC`);
        return tables;

    } catch (error) {
        console.error('❌ Erreur RPC:', error.message);
        return await getTablesAlternative();
    }
}

async function getTablesAlternative() {
    console.log('🔄 Méthode alternative: test des tables une par une...');

    // Liste probable des tables basée sur le contexte
    const probableTables = [
        'lieux', 'quiz_categories', 'users', 'textes_references',
        'absences_formateurs', 'admin_sessions', 'messages',
        'planning_hebdomadaire', 'planning_formateurs_hebdo',
        'planning_type_formateurs', 'planning_apprenants',
        'absences_apprenants', 'presence_formateurs', 'suspensions_parcours',
        'quiz', 'quiz_sessions', 'imagiers', 'imagier_elements',
        'groupes_sens', 'mots_extraits', 'syllabes', 'syllabes_mots',
        'mots_classifies', 'corrections_demandees', 'paniers_syllabes',
        'signalements_syllabification', 'corrections_syllabification',
        'corrections_mono_multi'
    ];

    const existingTables = [];

    for (const tableName of probableTables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (!error) {
                existingTables.push(tableName);
                console.log(`  ✅ ${tableName} existe`);
            } else {
                console.log(`  ❌ ${tableName} n'existe pas`);
            }
        } catch (err) {
            console.log(`  ❌ ${tableName} erreur: ${err.message}`);
        }
    }

    console.log(`📋 ${existingTables.length} tables confirmées par test`);
    return existingTables;
}

async function main() {
    console.log('🚀 Début du VRAI backup vers fichiers...');
    console.log('🔗 Connection à Supabase...');

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupDir = `backups/${timestamp}`;

    await fs.mkdir(backupDir, { recursive: true });

    try {
        // 1. Lister toutes les tables
        const tables = await getAllTables();
        console.log(`📋 ${tables.length} tables trouvées`);

        // 2. Pour chaque table : structure + données
        const fullBackup = {
            timestamp: new Date().toISOString(),
            tables: {}
        };

        let totalRecords = 0;

        for (const tableName of tables) {
            console.log(`\n🔄 Traitement: ${tableName}`);

            // Structure de la table
            const structure = await getTableStructure(tableName);

            // Données de la table
            const data = await getTableData(tableName);
            totalRecords += data.length;

            // Sauvegarder dans l'objet complet
            fullBackup.tables[tableName] = {
                structure: structure,
                data: data,
                count: data.length
            };

            // Sauvegarder chaque table individuellement aussi
            await fs.writeFile(
                path.join(backupDir, `${tableName}.json`),
                JSON.stringify({
                    table: tableName,
                    structure: structure,
                    data: data,
                    count: data.length,
                    timestamp: new Date().toISOString()
                }, null, 2)
            );
        }

        // 3. Sauvegarder le backup complet
        await fs.writeFile(
            path.join(backupDir, 'complete-backup.json'),
            JSON.stringify(fullBackup, null, 2)
        );

        // 4. Créer le manifest
        const manifest = {
            timestamp: new Date().toISOString(),
            date: timestamp,
            totalTables: tables.length,
            totalRecords: totalRecords,
            tables: Object.keys(fullBackup.tables).map(name => ({
                name: name,
                records: fullBackup.tables[name].count
            })),
            files: {
                complete: 'complete-backup.json',
                individual: tables.map(name => `${name}.json`)
            }
        };

        await fs.writeFile(
            path.join(backupDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        console.log('\n🎉 BACKUP TERMINÉ !');
        console.log(`📁 Répertoire: ${backupDir}`);
        console.log(`📊 ${manifest.totalTables} tables, ${totalRecords} enregistrements`);
        console.log(`📄 Fichiers créés:`);
        console.log(`  - complete-backup.json (backup complet)`);
        console.log(`  - manifest.json (informations)`);
        console.log(`  - ${tables.length} fichiers individuels .json`);

        return backupDir;

    } catch (error) {
        console.error('❌ ERREUR BACKUP:', error.message);
        process.exit(1);
    }
}

// Lancer directement au lieu d'utiliser import.meta.url
console.log('📍 Script démarré...');
main().catch(error => {
    console.error('❌ ERREUR FATALE:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});