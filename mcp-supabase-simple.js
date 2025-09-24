#!/usr/bin/env node

/**
 * Serveur MCP simplifié pour Supabase ACLEF
 * Version sans RPC, utilisant uniquement l'API Supabase standard
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

// Configuration Supabase
const SUPABASE_URL = 'https://mkbchdhbgdynxwfhpxbw.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmNoZGhiZ2R5bnh3ZmhweGJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExNDk5NiwiZXhwIjoyMDcwNjkwOTk2fQ._8zQliKa7WsYx5PWO-wTMmNWaOkcV_3BpaD7yuPgkBw';

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Tables connues de la base ACLEF
const KNOWN_TABLES = [
  'users',
  'planning_hebdomadaire',
  'planning_apprenants',
  'planning_formateurs_hebdo',
  'planning_type_formateurs',
  'absences_apprenants',
  'absences_formateurs',
  'presence_formateurs',
  'lieux',
  'messages',
  'quiz',
  'quiz_categories',
  'quiz_sessions',
  'admin_sessions',
  'corrections_demandees',
  'corrections_mono_multi',
  'corrections_syllabification',
  'groupes_sens',
  'imagier_elements',
  'imagiers',
  'mots_classifies',
  'mots_extraits',
  'paniers_syllabes',
  'signalements_syllabification',
  'suspensions_parcours',
  'syllabes',
  'syllabes_mots',
  'textes_references'
];

// Créer le serveur MCP
const server = new Server(
  {
    name: 'supabase-aclef-simple',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Outils disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_tables',
        description: 'Liste toutes les tables de la base de données',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'describe_table',
        description: 'Décrit la structure d\'une table',
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
        description: 'Récupère les données d\'une table avec pagination',
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
        description: 'Insère des données dans une table',
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
        description: 'Met à jour des données dans une table',
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
        description: 'Supprime des données d\'une table',
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
    return {
      content: [
        {
          type: 'text',
          text: `Tables disponibles dans la base ACLEF:\n${KNOWN_TABLES.join('\n')}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur: ${error.message}`
        }
      ]
    };
  }
}

async function handleDescribeTable(args) {
  const { table_name } = args;

  try {
    // Vérifier que la table existe dans notre liste
    if (!KNOWN_TABLES.includes(table_name)) {
      throw new Error(`Table '${table_name}' non reconnue. Tables disponibles: ${KNOWN_TABLES.join(', ')}`);
    }

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
            text: `Structure de la table ${table_name}:\n${JSON.stringify(structure, null, 2)}`
          }
        ]
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `La table ${table_name} est vide.`
          }
        ]
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la description de la table: ${error.message}`
        }
      ]
    };
  }
}

async function handleGetTableData(args) {
  const { table_name, limit = 10, offset = 0, filters = {} } = args;

  try {
    if (!KNOWN_TABLES.includes(table_name)) {
      throw new Error(`Table '${table_name}' non reconnue.`);
    }

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
          text: `Données de la table ${table_name} (${data?.length || 0} entrées):\n${JSON.stringify(data, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la récupération des données: ${error.message}`
        }
      ]
    };
  }
}

async function handleInsertData(args) {
  const { table_name, data } = args;

  try {
    if (!KNOWN_TABLES.includes(table_name)) {
      throw new Error(`Table '${table_name}' non reconnue.`);
    }

    const { data: result, error } = await supabase
      .from(table_name)
      .insert(data)
      .select();

    if (error) throw error;

    return {
      content: [
        {
          type: 'text',
          text: `Données insérées avec succès dans ${table_name}:\n${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de l'insertion: ${error.message}`
        }
      ]
    };
  }
}

async function handleUpdateData(args) {
  const { table_name, data, filters } = args;

  try {
    if (!KNOWN_TABLES.includes(table_name)) {
      throw new Error(`Table '${table_name}' non reconnue.`);
    }

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
          text: `Données mises à jour avec succès dans ${table_name}:\n${JSON.stringify(result, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la mise à jour: ${error.message}`
        }
      ]
    };
  }
}

async function handleDeleteData(args) {
  const { table_name, filters } = args;

  try {
    if (!KNOWN_TABLES.includes(table_name)) {
      throw new Error(`Table '${table_name}' non reconnue.`);
    }

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
          text: `Données supprimées avec succès de ${table_name}:\n${JSON.stringify(data, null, 2)}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Erreur lors de la suppression: ${error.message}`
        }
      ]
    };
  }
}

// Démarrer le serveur
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Serveur MCP Supabase ACLEF Simple démarré');
}

main().catch(console.error);