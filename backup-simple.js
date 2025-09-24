#!/usr/bin/env node

/**
 * Script de backup simple pour GitHub Actions
 * - Découvre automatiquement toutes les tables
 * - Sauvegarde toutes les données
 * - Utilise les clés existantes
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkbchdhbgdynxwfhpxbw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function discoverAllTables() {
    console.log('🔍 Découverte de toutes les tables...');

    try {
        // Utiliser l'API REST pour découvrir les tables
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.definitions) {
                const tables = Object.keys(data.definitions);
                console.log(`✅ ${tables.length} tables découvertes`);
                return tables;
            }
        }

        console.log('⚠️ API REST ne donne pas les métadonnées, scan manuel...');
        return [];

    } catch (error) {
        console.error('❌ Erreur découverte:', error.message);
        return [];
    }
}

async function backupTable(tableName) {
    console.log(`📊 Backup: ${tableName}`);

    try {
        let allData = [];
        let from = 0;
        const limit = 1000;

        while (true) {
            const { data, error } = await supabase
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

        console.log(`  ✅ ${tableName}: ${allData.length} enregistrements`);
        return allData;

    } catch (error) {
        console.error(`❌ Erreur ${tableName}:`, error.message);
        return [];
    }
}

async function getTableStructure(tableName, sampleData) {
    if (!sampleData || sampleData.length === 0) {
        return [];
    }

    const sample = sampleData[0];
    return Object.keys(sample).map(col => ({
        column_name: col,
        data_type: typeof sample[col],
        is_nullable: sample[col] === null ? 'YES' : 'NO'
    }));
}

async function main() {
    console.log('🚀 Début backup Planning ACLEF');
    console.log(`🕐 ${new Date().toISOString()}`);

    try {
        // 1. Créer le dossier de backup
        const timestamp = new Date().toISOString().split('T')[0];
        const backupDir = `backup-${timestamp}`;

        await fs.mkdir(backupDir, { recursive: true });

        // 2. Découvrir toutes les tables
        const tables = await discoverAllTables();

        if (tables.length === 0) {
            console.log('❌ Aucune table trouvée');
            process.exit(1);
        }

        // 3. Backup de toutes les tables
        const backupData = {
            timestamp: new Date().toISOString(),
            tables: {},
            totalRecords: 0
        };

        for (const tableName of tables) {
            const data = await backupTable(tableName);
            const structure = await getTableStructure(tableName, data);

            backupData.tables[tableName] = {
                structure,
                data,
                count: data.length
            };

            backupData.totalRecords += data.length;

            // Fichier individuel
            await fs.writeFile(
                path.join(backupDir, `${tableName}.json`),
                JSON.stringify({
                    table: tableName,
                    structure,
                    data,
                    count: data.length,
                    timestamp: new Date().toISOString()
                }, null, 2)
            );
        }

        // 4. Backup complet
        await fs.writeFile(
            path.join(backupDir, 'complete-backup.json'),
            JSON.stringify(backupData, null, 2)
        );

        // 5. Manifest
        const manifest = {
            timestamp: new Date().toISOString(),
            date: timestamp,
            totalTables: tables.length,
            totalRecords: backupData.totalRecords,
            tables: tables.map(name => ({
                name,
                records: backupData.tables[name].count
            }))
        };

        await fs.writeFile(
            path.join(backupDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        console.log('\n🎉 BACKUP TERMINÉ !');
        console.log(`📁 Dossier: ${backupDir}`);
        console.log(`📊 ${manifest.totalTables} tables, ${backupData.totalRecords} enregistrements`);

    } catch (error) {
        console.error('❌ ERREUR BACKUP:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);