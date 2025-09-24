#!/usr/bin/env node

/**
 * Serveur MCP pour Supabase BACKUP/TEST
 * Version dédiée à la base de données de backup/test
 */

import { createClient } from '@supabase/supabase-js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

// Configuration Supabase BACKUP
const SUPABASE_URL = 'https://vqjkmveqzyaxsufbydit.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxamttdmVxenlheHN1ZmJ5ZGl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQ0NjgyMiwiZXhwIjoyMDc0MDIyODIyfQ.hepiVGnkPhfJ0LiC-Iv1DfVX8pZ7bz-3vQfWfpZNXoE';

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Tables qui seront découvertes dynamiquement
let DISCOVERED_TABLES = [];

// Créer le serveur MCP
const server = new Server(
  {
    name: 'supabase-backup',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Fonction pour découvrir les tables
async function discoverTables() {
  try {
    console.log('🔍 Découverte des tables via information_schema...');

    // Utiliser une requête SQL pour découvrir toutes les tables du schéma public
    const { data, error } = await supabase.rpc('get_tables', {});

    if (error) {
      // Si la fonction RPC n'existe pas, essayer avec une requête directe
      console.log('Function RPC non trouvée, tentative avec requête directe...');

      // Créer une fonction SQL temporaire pour lister les tables
      const createFunctionQuery = `
        CREATE OR REPLACE FUNCTION get_tables()
        RETURNS TABLE(table_name text)
        LANGUAGE sql
        AS $$
          SELECT tablename::text as table_name
          FROM pg_tables
          WHERE schemaname = 'public'
          ORDER BY tablename;
        $$;
      `;

      // Exécuter la création de fonction
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createFunctionQuery });

      if (createError) {
        console.error('Impossible de créer la fonction:', createError.message);
        throw new Error(`Impossible de créer la fonction de découverte: ${createError.message}`);
      }

      // Réessayer avec la fonction créée
      const { data: retryData, error: retryError } = await supabase.rpc('get_tables', {});

      if (retryError) {
        throw new Error(`Erreur lors de la découverte des tables: ${retryError.message}`);
      }

      data = retryData;
    }

    if (!data || data.length === 0) {
      console.error('Aucune table trouvée dans le schéma public');
      throw new Error('Aucune table trouvée dans le schéma public');
    }

    DISCOVERED_TABLES = data.map(row => row.table_name).sort();
    console.error(`${DISCOVERED_TABLES.length} tables découvertes automatiquement:`, DISCOVERED_TABLES);
    return DISCOVERED_TABLES;

  } catch (error) {
    console.error('Erreur critique lors de la découverte des tables:', error.message);
    throw error;
  }
}

// Outils disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_tables',
        description: 'Liste toutes les tables de la base de données backup',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'describe_table',
        description: 'Décrit la structure d\'une table de la base backup',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Nom de la table à décrire'
            }
          },
          required: ['table_name']
        }
      },
      {
        name: 'get_table_data',
        description: 'Récupère les données d\'une table backup avec pagination',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Nom de la table'
            },
            limit: {
              type: 'number',
              description: 'Nombre de lignes à récupérer (défaut: 10)',
              default: 10
            },
            offset: {
              type: 'number',
              description: 'Décalage pour la pagination (défaut: 0)',
              default: 0
            },
            filters: {
              type: 'object',
              description: 'Filtres à appliquer'
            }
          },
          required: ['table_name']
        }
      },
      {
        name: 'insert_data',
        description: 'Insère des données dans une table backup',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Nom de la table'
            },
            data: {
              type: 'object',
              description: 'Données à insérer'
            }
          },
          required: ['table_name', 'data']
        }
      },
      {
        name: 'update_data',
        description: 'Met à jour des données dans une table backup',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Nom de la table'
            },
            data: {
              type: 'object',
              description: 'Nouvelles données'
            },
            filters: {
              type: 'object',
              description: 'Conditions pour la mise à jour'
            }
          },
          required: ['table_name', 'data', 'filters']
        }
      },
      {
        name: 'delete_data',
        description: 'Supprime des données d\'une table backup',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Nom de la table'
            },
            filters: {
              type: 'object',
              description: 'Conditions pour la suppression'
            }
          },
          required: ['table_name', 'filters']
        }
      }
    ]
  };
});

// Gestionnaire d'outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_tables':
        return await handleListTables();

      case 'describe_table':
        return await handleDescribeTable(args);

      case 'get_table_data':
        return await handleGetTableData(args);

      case 'insert_data':
        return await handleInsertData(args);

      case 'update_data':
        return await handleUpdateData(args);

      case 'delete_data':
        return await handleDeleteData(args);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Outil inconnu: ${name}`);
    }
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Erreur: ${error.message}`);
  }
});

// Implémentation des gestionnaires d'outils

async function handleListTables() {
  try {
    await discoverTables();

    return {
      content: [
        {
          type: 'text',
          text: `Tables disponibles dans la base BACKUP:\n${DISCOVERED_TABLES.join('\n')}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `ERREUR - Impossible de découvrir les tables automatiquement: ${error.message}`
        }
      ]
    };
  }
}

async function handleDescribeTable(args) {
  const { table_name } = args;

  try {
    // Récupérer un échantillon pour déduire la structure
    const { data, error } = await supabase
      .from(table_name)
      .select('*')
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      const structure = columns.map(col => ({
        column_name: col,
        example_value: data[0][col],
        type: typeof data[0][col]
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Structure de la table backup ${table_name}:\n${JSON.stringify(structure, null, 2)}`
          }
        ]
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `La table backup ${table_name} est vide.`
          }
        ]
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la description de la table backup: ${error.message}`
        }
      ]
    };
  }
}

async function handleGetTableData(args) {
  const { table_name, limit = 10, offset = 0, filters = {} } = args;

  try {
    let query = supabase.from(table_name).select('*');

    // Appliquer les filtres
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      content: [
        {
          type: 'text',
          text: `Données de la table backup ${table_name} (${data?.length || 0} entrées):\n${JSON.stringify(data, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la récupération des données backup: ${error.message}`
        }
      ]
    };
  }
}

async function handleInsertData(args) {
  const { table_name, data } = args;

  try {
    const { data: result, error } = await supabase
      .from(table_name)
      .insert(data)
      .select();

    if (error) throw error;

    return {
      content: [
        {
          type: 'text',
          text: `Données insérées avec succès dans la table backup ${table_name}:\n${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de l'insertion backup: ${error.message}`
        }
      ]
    };
  }
}

async function handleUpdateData(args) {
  const { table_name, data, filters } = args;

  try {
    let query = supabase.from(table_name).update(data);

    // Appliquer les filtres
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: result, error } = await query.select();

    if (error) throw error;

    return {
      content: [
        {
          type: 'text',
          text: `Données mises à jour avec succès dans la table backup ${table_name}:\n${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la mise à jour backup: ${error.message}`
        }
      ]
    };
  }
}

async function handleDeleteData(args) {
  const { table_name, filters } = args;

  try {
    let query = supabase.from(table_name).delete();

    // Appliquer les filtres
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.select();

    if (error) throw error;

    return {
      content: [
        {
          type: 'text',
          text: `Données supprimées avec succès de la table backup ${table_name}:\n${JSON.stringify(data, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la suppression backup: ${error.message}`
        }
      ]
    };
  }
}

// Démarrer le serveur
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Serveur MCP Supabase BACKUP démarré');
}

main().catch(console.error);