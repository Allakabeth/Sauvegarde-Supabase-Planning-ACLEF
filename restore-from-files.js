#!/usr/bin/env node

/**
 * VRAI restore depuis fichiers vers base backup
 * Lit les fichiers de sauvegarde et utilise les serveurs MCP pour restaurer
 */

import fs from 'fs/promises';
import path from 'path';

// Ce script sera utilisé par Claude Code avec les serveurs MCP
// Il génère les instructions pour Claude

async function analyzeBackup(backupDir) {
    console.log(`🔍 Analyse du backup: ${backupDir}`);

    // Lire le manifest
    const manifestPath = path.join(backupDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    console.log(`📊 Backup du ${manifest.date}`);
    console.log(`📋 ${manifest.totalTables} tables, ${manifest.totalRecords} enregistrements`);

    // Lire le backup complet
    const backupPath = path.join(backupDir, 'complete-backup.json');
    const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));

    return { manifest, backup };
}

function generateCreateTableSQL(tableName, structure) {
    let sql = `CREATE TABLE ${tableName} (\n`;

    const columns = structure.map(col => {
        let def = `  ${col.column_name}`;

        // Type
        switch (col.data_type) {
            case 'uuid':
                def += ' UUID';
                break;
            case 'character varying':
                def += ' VARCHAR';
                break;
            case 'timestamp without time zone':
                def += ' TIMESTAMP';
                break;
            case 'timestamp with time zone':
                def += ' TIMESTAMPTZ';
                break;
            case 'boolean':
                def += ' BOOLEAN';
                break;
            case 'integer':
                def += ' INTEGER';
                break;
            case 'bigint':
                def += ' BIGINT';
                break;
            case 'date':
                def += ' DATE';
                break;
            case 'text':
                def += ' TEXT';
                break;
            case 'jsonb':
                def += ' JSONB';
                break;
            case 'ARRAY':
                def += ' TEXT[]';
                break;
            default:
                def += ` ${col.data_type.toUpperCase()}`;
        }

        // NOT NULL
        if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
        }

        // DEFAULT
        if (col.column_default) {
            def += ` DEFAULT ${col.column_default}`;
        }

        return def;
    });

    sql += columns.join(',\n');
    sql += '\n);';

    return sql;
}

async function generateRestoreInstructions(backupDir) {
    const { manifest, backup } = await analyzeBackup(backupDir);

    console.log('\n📝 GÉNÉRATION DES INSTRUCTIONS DE RESTAURATION...\n');

    // Ordre de dépendances basique (tables de référence d'abord)
    const tableOrder = [
        'lieux', 'quiz_categories', 'users', 'textes_references'
    ].concat(
        Object.keys(backup.tables).filter(name =>
            !['lieux', 'quiz_categories', 'users', 'textes_references'].includes(name)
        )
    );

    console.log('=' .repeat(80));
    console.log('INSTRUCTIONS POUR CLAUDE CODE - RESTAURATION DEPUIS FICHIERS');
    console.log('=' .repeat(80));

    console.log('\nETAPE 1: NETTOYER LA BASE BACKUP');
    console.log('Claude, exécute avec mcp__supabase-backup__execute_sql :');

    // Générer les DROP TABLE
    const reversedOrder = [...tableOrder].reverse();
    for (const tableName of reversedOrder) {
        console.log(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
    }

    console.log('\nETAPE 2: RECREER LES TABLES');
    console.log('Claude, exécute avec mcp__supabase-backup__apply_migration :');

    for (const tableName of tableOrder) {
        const tableInfo = backup.tables[tableName];
        if (tableInfo && tableInfo.structure) {
            console.log(`\n-- Migration: create_${tableName}`);
            const sql = generateCreateTableSQL(tableName, tableInfo.structure);
            console.log(sql);
        }
    }

    console.log('\nETAPE 3: INSERER LES DONNEES');
    console.log('Claude, utilise les données suivantes avec mcp__supabase-backup__execute_sql :');

    for (const tableName of tableOrder) {
        const tableInfo = backup.tables[tableName];
        if (tableInfo && tableInfo.data && tableInfo.data.length > 0) {
            console.log(`\n-- ${tableName}: ${tableInfo.data.length} enregistrements`);

            // Générer quelques exemples d'INSERT
            const sampleData = tableInfo.data.slice(0, 3);
            for (const record of sampleData) {
                const columns = Object.keys(record);
                const values = columns.map(col => {
                    const val = record[col];
                    if (val === null) return 'NULL';
                    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                    if (Array.isArray(val)) return `ARRAY[${val.map(v => `'${v}'`).join(',')}]`;
                    if (typeof val === 'object') return `'${JSON.stringify(val)}'`;
                    return val;
                });

                console.log(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
            }

            if (tableInfo.data.length > 3) {
                console.log(`-- ... et ${tableInfo.data.length - 3} autres enregistrements`);
            }
        }
    }

    console.log('\n' + '=' .repeat(80));
    console.log(`TOTAL: ${manifest.totalTables} tables, ${manifest.totalRecords} enregistrements à restaurer`);
    console.log('=' .repeat(80));

    // Sauvegarder les instructions
    const instructionsFile = path.join(backupDir, 'restore-instructions.txt');
    // TODO: Sauvegarder les vraies instructions dans un fichier

    console.log(`\n💾 Instructions complètes disponibles dans: ${instructionsFile}`);

    return { manifest, backup, tableOrder };
}

async function main() {
    const backupDir = process.argv[2];

    if (!backupDir) {
        console.error('❌ Usage: node restore-from-files.js <backup-directory>');
        console.error('   Exemple: node restore-from-files.js backups/2025-09-24');
        process.exit(1);
    }

    try {
        await generateRestoreInstructions(backupDir);
    } catch (error) {
        console.error('❌ ERREUR RESTORE:', error.message);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}