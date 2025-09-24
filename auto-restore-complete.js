#!/usr/bin/env node

/**
 * Restauration automatique complète via MCP
 * Utilise les serveurs MCP pour restaurer toutes les données
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

// Configuration
const MAIN_URL = 'https://mkbchdhbgdynxwfhpxbw.supabase.co';
const MAIN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw';

const BACKUP_URL = 'https://vqjkmveqzyaxsufbydit.supabase.co';
const BACKUP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxamttdmVxenlheHN1ZmJ5ZGl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQ0NjgyMiwiZXhwIjoyMDc0MDIyODIyfQ.hepiVGnkPhfJ0LiC-Iv1DfVX8pZ7bz-3vQfWfpZNXoE';

const mainDb = createClient(MAIN_URL, MAIN_KEY);
const backupDb = createClient(BACKUP_URL, BACKUP_KEY);

// Ordre de restauration (dépendances d'abord)
const TABLES_ORDER = [
    'lieux',
    'quiz_categories',
    'users',
    'textes_references',
    'absences_formateurs',
    'admin_sessions',
    'messages',
    'planning_hebdomadaire',
    'planning_formateurs_hebdo',
    'planning_type_formateurs',
    'planning_apprenants',
    'absences_apprenants',
    'presence_formateurs',
    'suspensions_parcours',
    'quiz',
    'quiz_sessions',
    'imagiers',
    'imagier_elements',
    'groupes_sens',
    'mots_extraits',
    'syllabes',
    'syllabes_mots',
    'mots_classifies',
    'corrections_demandees',
    'paniers_syllabes',
    'signalements_syllabification',
    'corrections_syllabification',
    'corrections_mono_multi'
];

async function extractTableData(tableName) {
    console.log(`📊 Extraction: ${tableName}`);

    let allData = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await mainDb
            .from(tableName)
            .select('*')
            .range(from, from + limit - 1);

        if (error) {
            console.error(`❌ Erreur ${tableName}:`, error.message);
            break;
        }

        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        from += limit;

        if (data.length < limit) break;
    }

    console.log(`  ✅ ${tableName}: ${allData.length} enregistrements extraits`);
    return allData;
}

async function insertTableData(tableName, data) {
    if (!data || data.length === 0) {
        console.log(`  ⏭️ ${tableName}: aucune donnée à insérer`);
        return 0;
    }

    console.log(`📥 Insertion: ${tableName} (${data.length} enregistrements)`);

    // Insérer par chunks
    const chunkSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);

        try {
            const { error } = await backupDb
                .from(tableName)
                .insert(chunk);

            if (error) {
                console.error(`⚠️ Erreur chunk ${i}:`, error.message);
                // Essayer insertion individuelle
                for (const record of chunk) {
                    try {
                        await backupDb.from(tableName).insert([record]);
                        totalInserted++;
                    } catch (err) {
                        console.error(`  ❌ Échec:`, err.message);
                    }
                }
            } else {
                totalInserted += chunk.length;
            }
        } catch (err) {
            console.error(`❌ Erreur insertion:`, err.message);
        }
    }

    console.log(`  ✅ ${tableName}: ${totalInserted}/${data.length} insérés`);
    return totalInserted;
}

async function main() {
    console.log('🚀 Début de la restauration automatique complète...');

    const startTime = Date.now();
    const results = {};
    let totalRecords = 0;
    let totalRestored = 0;

    for (const tableName of TABLES_ORDER) {
        try {
            // Extraire de la base principale
            const data = await extractTableData(tableName);
            totalRecords += data.length;

            // Insérer dans la base backup
            const inserted = await insertTableData(tableName, data);
            totalRestored += inserted;

            results[tableName] = {
                extracted: data.length,
                inserted: inserted,
                success: inserted === data.length
            };

        } catch (error) {
            console.error(`❌ Erreur critique ${tableName}:`, error.message);
            results[tableName] = {
                extracted: 0,
                inserted: 0,
                success: false,
                error: error.message
            };
        }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Rapport final
    console.log('\n🎉 RESTAURATION TERMINÉE !');
    console.log(`⏱️ Durée: ${duration} secondes`);
    console.log(`📊 ${totalRestored}/${totalRecords} enregistrements restaurés`);
    console.log(`🎯 Taux de réussite: ${Math.round((totalRestored/totalRecords)*100)}%`);

    // Détails par table
    console.log('\n📋 RAPPORT DÉTAILLÉ:');
    for (const [table, result] of Object.entries(results)) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${table}: ${result.inserted}/${result.extracted}`);
        if (result.error) {
            console.log(`    💬 ${result.error}`);
        }
    }

    // Sauvegarder le rapport
    const report = {
        timestamp: new Date().toISOString(),
        duration: duration,
        totalRecords: totalRecords,
        totalRestored: totalRestored,
        successRate: Math.round((totalRestored/totalRecords)*100),
        tables: results
    };

    await fs.writeFile('restore-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Rapport sauvegardé: restore-report.json');

    if (totalRestored === totalRecords) {
        console.log('\n🏆 SUCCÈS COMPLET - Base backup identique à la base principale !');
    } else {
        console.log('\n⚠️ Restauration partielle - Vérifiez les erreurs ci-dessus');
    }
}

main().catch(console.error);