import os
import json
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

def load_environment():
    """Load environment variables from .env file"""
    load_dotenv()

    url = os.getenv("SUPABASE_PLANNING_URL")
    key = os.getenv("SUPABASE_PLANNING_SERVICE_KEY")

    if not url or not key:
        raise ValueError("Missing SUPABASE_PLANNING_URL or SUPABASE_PLANNING_SERVICE_KEY in environment")

    return url, key

def connect_to_supabase(url: str, key: str) -> Client:
    """Create Supabase client connection"""
    return create_client(url, key)

def discover_tables(supabase: Client) -> list:
    """Discover all tables in the public schema using information_schema"""
    try:
        # Query to get all user tables from information_schema
        response = supabase.rpc('get_schema_tables').execute()

        if response.data:
            return [table['table_name'] for table in response.data]
        else:
            # Fallback: try to get tables by querying information_schema directly
            query = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
            response = supabase.rpc('exec_sql', {'query': query}).execute()
            return [row['table_name'] for row in response.data] if response.data else []

    except Exception as e:
        print(f"Error discovering tables: {e}")
        # Manual fallback - try common table names or return empty
        return []

def get_table_schema(supabase: Client, table_name: str) -> dict:
    """Get detailed schema information for a specific table"""
    schema_info = {
        'table_name': table_name,
        'columns': [],
        'primary_keys': [],
        'foreign_keys': [],
        'sample_data': None
    }

    try:
        # Get column information
        columns_query = """
        SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = '{}'
        ORDER BY ordinal_position
        """.format(table_name)

        columns_response = supabase.rpc('exec_sql', {'query': columns_query}).execute()
        if columns_response.data:
            schema_info['columns'] = columns_response.data

        # Get primary key information
        pk_query = """
        SELECT column_name
        FROM information_schema.key_column_usage
        WHERE table_schema = 'public'
        AND table_name = '{}'
        AND constraint_name IN (
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = '{}'
            AND constraint_type = 'PRIMARY KEY'
        )
        """.format(table_name, table_name)

        pk_response = supabase.rpc('exec_sql', {'query': pk_query}).execute()
        if pk_response.data:
            schema_info['primary_keys'] = [row['column_name'] for row in pk_response.data]

        # Get foreign key information
        fk_query = """
        SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
        WHERE kcu.table_schema = 'public'
        AND kcu.table_name = '{}'
        """.format(table_name)

        fk_response = supabase.rpc('exec_sql', {'query': fk_query}).execute()
        if fk_response.data:
            schema_info['foreign_keys'] = fk_response.data

        # Get sample data (1 row)
        try:
            sample_response = supabase.table(table_name).select("*").limit(1).execute()
            if sample_response.data:
                schema_info['sample_data'] = sample_response.data[0]
        except Exception as sample_error:
            print(f"Could not get sample data for {table_name}: {sample_error}")
            schema_info['sample_data'] = None

    except Exception as e:
        print(f"Error getting schema for table {table_name}: {e}")

    return schema_info

def save_schema_to_file(schema_data: dict, filename: str = "backups/schema_discovery.json"):
    """Save the discovered schema to a JSON file"""
    os.makedirs(os.path.dirname(filename), exist_ok=True)

    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(schema_data, f, indent=2, ensure_ascii=False, default=str)

    print(f"Schema saved to {filename}")

def print_summary(schema_data: dict):
    """Print a summary of discovered tables"""
    tables = schema_data.get('tables', [])
    table_count = len(tables)
    table_names = [table['table_name'] for table in tables]

    print(f"\n=== SCHEMA DISCOVERY SUMMARY ===")
    print(f"Discovery time: {schema_data.get('discovery_time', 'Unknown')}")
    print(f"Total tables found: {table_count}")
    print(f"\nTable names:")
    for name in sorted(table_names):
        print(f"  - {name}")
    print(f"=== END SUMMARY ===\n")

def main():
    """Main function to discover and save database schema"""
    try:
        print("Starting schema discovery...")

        # Load environment variables
        url, key = load_environment()
        print("Environment variables loaded successfully")

        # Connect to Supabase
        supabase = connect_to_supabase(url, key)
        print("Connected to ACLEF Planning database")

        # Discover tables
        print("Discovering tables...")
        tables = discover_tables(supabase)

        if not tables:
            print("No tables found or error occurred during discovery")
            return

        print(f"Found {len(tables)} tables")

        # Get schema for each table
        schema_data = {
            'discovery_time': datetime.now().isoformat(),
            'database_url': url,
            'tables': []
        }

        for table_name in tables:
            print(f"Analyzing table: {table_name}")
            table_schema = get_table_schema(supabase, table_name)
            schema_data['tables'].append(table_schema)

        # Save to file
        save_schema_to_file(schema_data)

        # Print summary
        print_summary(schema_data)

    except Exception as e:
        print(f"Error in main execution: {e}")
        raise

if __name__ == "__main__":
    main()