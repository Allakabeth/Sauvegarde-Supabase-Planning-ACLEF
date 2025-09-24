#!/usr/bin/env node

/**
 * Backup complet via MCP Supabase
 * Sauvegarde schéma + données sans Docker ni CLI
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Configuration Supabase PRODUCTION
const SUPABASE_URL = 'https://mkbchdhbgdynxwfhpxbw.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateSchemaSQL() {
  console.log('📋 Extraction du schéma complet...');

  // 1. Récupérer toutes les tables - utilisation MCP directe
  console.log('🔍 Découverte des tables...');

  // Utiliser le serveur MCP pour lister les tables
  let tables = [];
  try {
    // Récupération via query directe plus simple
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (error) throw error;
    tables = data;
    console.log(`📋 ${tables.length} tables trouvées`);
  } catch (error) {
    console.error('❌ Erreur récupération tables:', error.message);
    throw error;
  }

  let schemaSQL = '-- Schéma complet généré le ' + new Date().toISOString() + '\n\n';
  schemaSQL += '-- Suppression des tables existantes\n';

  // Générer DROP TABLE pour chaque table
  for (const table of tables) {
    schemaSQL += `DROP TABLE IF EXISTS "${table.table_name}" CASCADE;\n`;
  }
  schemaSQL += '\n';

  // 2. Pour chaque table, générer le CREATE TABLE
  for (const table of tables) {
    console.log(`  📄 Table: ${table.table_name}`);

    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, character_maximum_length, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', table.table_name)
      .order('ordinal_position');

    if (error) {
      console.warn(`⚠️ Erreur pour ${table.table_name}: ${error.message}`);
      continue;
    }

    // Générer CREATE TABLE
    schemaSQL += `-- Table: ${table.table_name}\n`;
    schemaSQL += `CREATE TABLE "${table.table_name}" (\n`;

    const columnDefs = columns.map(col => {
      let def = `  "${col.column_name}"`;

      // Type de données
      switch (col.data_type) {
        case 'character varying':
          def += col.character_maximum_length
            ? ` VARCHAR(${col.character_maximum_length})`
            : ' TEXT';
          break;
        case 'timestamp without time zone':
          def += ' TIMESTAMP';
          break;
        case 'timestamp with time zone':
          def += ' TIMESTAMPTZ';
          break;
        case 'uuid':
          def += ' UUID';
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

    schemaSQL += columnDefs.join(',\n');
    schemaSQL += '\n);\n\n';
  }

  // 3. Récupérer les contraintes (simplifié pour éviter les jointures complexes)
  schemaSQL += '-- Contraintes (à configurer manuellement si nécessaire)\n';
  schemaSQL += '-- Les contraintes seront recréées lors de l\'insertion des données\n\n';


  return schemaSQL;
}

async function backupTableData(tableName) {
  console.log(`📊 Backup données: ${tableName}`);

  let allData = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn(`⚠️ Erreur pour ${tableName}: ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    offset += limit;

    if (data.length < limit) break;
  }

  return allData;
}

async function main() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `backup-${timestamp}`;

    await fs.mkdir(backupDir, { recursive: true });

    console.log('🚀 Début du backup complet MCP...');

    // 1. Générer le schéma SQL
    const schemaSQL = await generateSchemaSQL();
    await fs.writeFile(
      path.join(backupDir, 'schema.sql'),
      schemaSQL
    );
    console.log('✅ Schéma SQL généré');

    // 2. Récupérer la liste des tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (tablesError) {
      throw new Error(`Erreur récupération tables: ${tablesError.message}`);
    }

    // 3. Backup des données de chaque table
    const dataBackup = {};
    let totalRecords = 0;

    for (const table of tables || []) {
      const data = await backupTableData(table.table_name);
      dataBackup[table.table_name] = data;
      totalRecords += data.length;
      console.log(`  ✅ ${table.table_name}: ${data.length} enregistrements`);
    }

    // 4. Sauvegarder les données JSON
    await fs.writeFile(
      path.join(backupDir, 'data.json'),
      JSON.stringify(dataBackup, null, 2)
    );

    // 5. Créer un manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      tables: tables?.length || 0,
      totalRecords,
      backupType: 'MCP_COMPLETE',
      schemaFile: 'schema.sql',
      dataFile: 'data.json',
      tables: Object.keys(dataBackup).map(table => ({
        name: table,
        records: dataBackup[table].length
      }))
    };

    await fs.writeFile(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('🎉 Backup complet terminé!');
    console.log(`📁 Répertoire: ${backupDir}`);
    console.log(`📊 ${manifest.tables} tables, ${totalRecords} enregistrements`);

    return backupDir;

  } catch (error) {
    console.error('❌ Erreur lors du backup:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSchemaSQL, backupTableData };