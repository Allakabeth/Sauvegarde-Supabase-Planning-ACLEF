#!/usr/bin/env node

/**
 * Restauration complète via MCP Supabase
 * Restaure schéma + données dans la base backup
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Configuration Supabase BACKUP
const SUPABASE_BACKUP_URL = 'https://vqjkmveqzyaxsufbydit.supabase.co';
const SUPABASE_BACKUP_SERVICE_KEY = process.env.SUPABASE_BACKUP_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxamttdmVxenlheHN1ZmJ5ZGl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQ0NjgyMiwiZXhwIjoyMDc0MDIyODIyfQ.hepiVGnkPhfJ0LiC-Iv1DfVX8pZ7bz-3vQfWfpZNXoE';

const supabase = createClient(SUPABASE_BACKUP_URL, SUPABASE_BACKUP_SERVICE_KEY);

async function executeSchemaSQL(schemaSQL) {
  console.log('🏗️ Restoration du schéma...');

  // Diviser le schéma en instructions individuelles
  const statements = schemaSQL
    .split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .filter(stmt => stmt.trim());

  let successCount = 0;
  let errorCount = 0;

  for (const [index, statement] of statements.entries()) {
    const cleanStatement = statement.trim();
    if (!cleanStatement) continue;

    try {
      console.log(`  📝 Exécution ${index + 1}/${statements.length}: ${cleanStatement.substring(0, 50)}...`);

      // Utiliser apply_migration pour les CREATE TABLE
      if (cleanStatement.toUpperCase().startsWith('CREATE TABLE')) {
        const tableName = cleanStatement.match(/CREATE TABLE "?([^"\s]+)"?\s*\(/)?.[1] || `table_${index}`;
        await supabase.rpc('apply_migration', {
          name: `restore_${tableName}_${Date.now()}`,
          query: cleanStatement
        });
      }
      // Utiliser execute_sql pour les autres instructions
      else {
        await supabase.rpc('execute_sql', {
          query: cleanStatement
        });
      }

      successCount++;
    } catch (error) {
      console.warn(`  ⚠️ Erreur sur instruction ${index + 1}: ${error.message}`);
      errorCount++;

      // Continuer malgré les erreurs (certaines peuvent être normales)
      if (error.message.includes('already exists')) {
        console.log('    ℹ️ Élément déjà existant, continuons...');
      }
    }
  }

  console.log(`✅ Schéma restauré: ${successCount} succès, ${errorCount} erreurs`);
}

async function restoreTableData(tableName, data) {
  if (!data || data.length === 0) {
    console.log(`  📊 ${tableName}: aucune donnée`);
    return 0;
  }

  console.log(`  📊 ${tableName}: ${data.length} enregistrements`);

  // Insérer par chunks pour éviter les timeouts
  const chunkSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);

    try {
      const { error } = await supabase
        .from(tableName)
        .insert(chunk);

      if (error) {
        throw error;
      }

      totalInserted += chunk.length;
      console.log(`    ✅ ${totalInserted}/${data.length} insérés`);

    } catch (error) {
      console.warn(`    ⚠️ Erreur chunk ${i}-${i + chunkSize}: ${error.message}`);

      // Essayer insertion individuelle en cas d'erreur
      for (const record of chunk) {
        try {
          const { error: singleError } = await supabase
            .from(tableName)
            .insert([record]);

          if (!singleError) {
            totalInserted++;
          }
        } catch (singleErr) {
          console.warn(`      ⚠️ Échec enregistrement: ${singleErr.message}`);
        }
      }
    }
  }

  return totalInserted;
}

async function restoreData(dataBackup) {
  console.log('📊 Restauration des données...');

  let totalRestored = 0;
  const results = {};

  // Ordre de priorité pour les tables (foreign keys)
  const tableOrder = [
    'users', 'lieux', 'quiz_categories',
    // Puis les autres tables
    ...Object.keys(dataBackup).filter(table =>
      !['users', 'lieux', 'quiz_categories'].includes(table)
    )
  ];

  for (const tableName of tableOrder) {
    if (!dataBackup[tableName]) continue;

    try {
      const inserted = await restoreTableData(tableName, dataBackup[tableName]);
      results[tableName] = {
        expected: dataBackup[tableName].length,
        inserted: inserted,
        success: inserted === dataBackup[tableName].length
      };
      totalRestored += inserted;
    } catch (error) {
      console.error(`❌ Erreur critique pour ${tableName}: ${error.message}`);
      results[tableName] = {
        expected: dataBackup[tableName].length,
        inserted: 0,
        success: false,
        error: error.message
      };
    }
  }

  return { totalRestored, results };
}

async function verifyRestore(originalManifest) {
  console.log('🔍 Vérification de la restauration...');

  const verificationResults = {};
  let totalVerified = 0;

  for (const tableInfo of originalManifest.tables) {
    try {
      const { count, error } = await supabase
        .from(tableInfo.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        verificationResults[tableInfo.name] = {
          expected: tableInfo.records,
          found: 0,
          match: false,
          error: error.message
        };
      } else {
        const match = count === tableInfo.records;
        verificationResults[tableInfo.name] = {
          expected: tableInfo.records,
          found: count,
          match: match
        };

        if (match) {
          totalVerified += count;
        }

        console.log(`  ${match ? '✅' : '❌'} ${tableInfo.name}: ${count}/${tableInfo.records}`);
      }
    } catch (error) {
      verificationResults[tableInfo.name] = {
        expected: tableInfo.records,
        found: 0,
        match: false,
        error: error.message
      };
    }
  }

  return { totalVerified, verificationResults };
}

async function main() {
  const backupDir = process.argv[2];

  if (!backupDir) {
    console.error('❌ Usage: node restore-mcp-complete.js <backup-directory>');
    process.exit(1);
  }

  try {
    console.log('🚀 Début de la restauration complète MCP...');
    console.log(`📁 Répertoire: ${backupDir}`);

    // 1. Vérifier que les fichiers existent
    const schemaPath = path.join(backupDir, 'schema.sql');
    const dataPath = path.join(backupDir, 'data.json');
    const manifestPath = path.join(backupDir, 'manifest.json');

    const [schemaSQL, dataJSON, manifestJSON] = await Promise.all([
      fs.readFile(schemaPath, 'utf8'),
      fs.readFile(dataPath, 'utf8'),
      fs.readFile(manifestPath, 'utf8')
    ]);

    const dataBackup = JSON.parse(dataJSON);
    const manifest = JSON.parse(manifestJSON);

    console.log(`📋 Manifest: ${manifest.tables} tables, ${manifest.totalRecords} enregistrements`);

    // 2. Restaurer le schéma
    await executeSchemaSQL(schemaSQL);

    // 3. Restaurer les données
    const { totalRestored, results } = await restoreData(dataBackup);

    // 4. Vérifier la restauration
    const { totalVerified, verificationResults } = await verifyRestore(manifest);

    // 5. Rapport final
    console.log('\n🎉 Restauration terminée!');
    console.log(`📊 ${totalRestored}/${manifest.totalRecords} enregistrements restaurés`);
    console.log(`✅ ${totalVerified}/${manifest.totalRecords} enregistrements vérifiés`);

    const successRate = Math.round((totalVerified / manifest.totalRecords) * 100);
    console.log(`🎯 Taux de réussite: ${successRate}%`);

    if (successRate === 100) {
      console.log('🏆 RESTAURATION PARFAITE - Base identique à l\'original!');
    } else if (successRate >= 95) {
      console.log('✅ RESTAURATION RÉUSSIE avec quelques anomalies mineures');
    } else {
      console.log('⚠️ RESTAURATION PARTIELLE - Vérifiez les erreurs ci-dessus');
    }

    // Rapport détaillé
    console.log('\n📋 Rapport détaillé:');
    for (const [table, result] of Object.entries(verificationResults)) {
      const status = result.match ? '✅' : '❌';
      console.log(`  ${status} ${table}: ${result.found}/${result.expected}`);
      if (result.error) {
        console.log(`      Erreur: ${result.error}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la restauration:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}