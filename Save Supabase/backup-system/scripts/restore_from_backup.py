#!/usr/bin/env python3
"""
Restore script for ACLEF Planning Supabase database
This script generates a complete SQL restore script from a backup JSON file
"""

import os
import json
import argparse
from datetime import datetime
from pathlib import Path


def parse_arguments():
    """
    Parse command-line arguments
    """
    parser = argparse.ArgumentParser(
        description='Generate SQL restore script from backup JSON file'
    )
    parser.add_argument(
        'backup_file',
        help='Path to the complete_backup_*.json file'
    )
    parser.add_argument(
        '--target-database',
        choices=['main', 'backup'],
        default='backup',
        help='Target database to restore to (default: backup)'
    )
    parser.add_argument(
        '--output',
        help='Output SQL file name (default: auto-generated with timestamp)'
    )

    return parser.parse_args()


def load_backup_file(backup_file_path: str) -> dict:
    """
    Load and validate the backup JSON file
    """
    try:
        if not os.path.exists(backup_file_path):
            raise FileNotFoundError(f"Backup file not found: {backup_file_path}")

        with open(backup_file_path, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)

        # Validate backup structure
        required_keys = ['backup_metadata', 'database_schema', 'tables']
        for key in required_keys:
            if key not in backup_data:
                raise ValueError(f"Invalid backup file: missing '{key}' section")

        print(f"[SUCCESS] Loaded backup file: {backup_file_path}")
        print(f"  Backup time: {backup_data['backup_metadata'].get('backup_time', 'Unknown')}")
        print(f"  Tables: {len(backup_data.get('tables', []))}")
        print(f"  Total rows: {backup_data['backup_metadata'].get('statistics', {}).get('total_rows', 'Unknown')}")

        return backup_data

    except Exception as e:
        print(f"[ERROR] Failed to load backup file: {e}")
        return None


def map_data_type(column_info: dict) -> str:
    """
    Map column data type from backup format to PostgreSQL SQL
    """
    data_type = column_info.get('data_type', 'text')
    format_info = column_info.get('format', '')

    # Handle specific PostgreSQL types
    type_mapping = {
        'uuid': 'UUID',
        'text': 'TEXT',
        'date': 'DATE',
        'timestamp without time zone': 'TIMESTAMP',
        'timestamp with time zone': 'TIMESTAMPTZ',
        'boolean': 'BOOLEAN',
        'integer': 'INTEGER',
        'bigint': 'BIGINT',
        'character varying': 'VARCHAR',
        'jsonb': 'JSONB',
        'ARRAY': 'TEXT[]'  # Simplified array handling
    }

    return type_mapping.get(data_type, data_type.upper())


def generate_drop_statements(tables: list) -> str:
    """
    Generate DROP TABLE statements for all tables
    """
    sql_lines = [
        "-- =====================================================",
        "-- DROP EXISTING TABLES",
        "-- =====================================================",
        ""
    ]

    # Drop in reverse order to handle foreign key dependencies
    table_names = [table['table_name'] for table in tables]

    for table_name in reversed(table_names):
        sql_lines.append(f"DROP TABLE IF EXISTS {table_name} CASCADE;")

    sql_lines.append("")
    return '\n'.join(sql_lines)


def generate_create_table_statement(table_info: dict) -> str:
    """
    Generate CREATE TABLE statement for a single table
    """
    table_name = table_info['table_name']
    schema_info = table_info.get('schema_info', {})
    columns = schema_info.get('columns', [])

    sql_lines = [f"CREATE TABLE {table_name} ("]

    # Generate column definitions
    column_defs = []
    for col in columns:
        col_name = col['name']
        col_type = map_data_type(col)

        # Build column definition
        col_def = f"    {col_name} {col_type}"

        # Add constraints
        options = col.get('options', [])
        if 'nullable' not in options:
            col_def += " NOT NULL"

        # Add default value
        default_value = col.get('default_value')
        if default_value and default_value != 'null':
            # Clean up default value format
            if default_value.startswith("'") and default_value.endswith("'"):
                col_def += f" DEFAULT {default_value}"
            elif default_value in ['now()', 'gen_random_uuid()', 'CURRENT_DATE', 'CURRENT_TIMESTAMP']:
                col_def += f" DEFAULT {default_value}"
            elif default_value.isdigit() or default_value in ['true', 'false']:
                col_def += f" DEFAULT {default_value}"
            else:
                col_def += f" DEFAULT '{default_value}'"

        column_defs.append(col_def)

    sql_lines.extend(column_defs)
    sql_lines.append(");")

    return '\n'.join(sql_lines)


def generate_create_statements(tables: list) -> str:
    """
    Generate CREATE TABLE statements for all tables
    """
    sql_lines = [
        "-- =====================================================",
        "-- CREATE TABLES",
        "-- =====================================================",
        ""
    ]

    for table_info in tables:
        table_name = table_info['table_name']
        sql_lines.append(f"-- Table: {table_name}")
        sql_lines.append(generate_create_table_statement(table_info))
        sql_lines.append("")

    return '\n'.join(sql_lines)


def generate_primary_key_statements(tables: list) -> str:
    """
    Generate PRIMARY KEY constraint statements
    """
    sql_lines = [
        "-- =====================================================",
        "-- PRIMARY KEYS",
        "-- =====================================================",
        ""
    ]

    for table_info in tables:
        table_name = table_info['table_name']
        schema_info = table_info.get('schema_info', {})
        primary_keys = schema_info.get('primary_keys', [])

        if primary_keys:
            pk_columns = ', '.join(primary_keys)
            sql_lines.append(f"ALTER TABLE {table_name} ADD PRIMARY KEY ({pk_columns});")

    sql_lines.append("")
    return '\n'.join(sql_lines)


def generate_foreign_key_statements(tables: list) -> str:
    """
    Generate FOREIGN KEY constraint statements
    """
    sql_lines = [
        "-- =====================================================",
        "-- FOREIGN KEYS",
        "-- =====================================================",
        ""
    ]

    for table_info in tables:
        table_name = table_info['table_name']
        schema_info = table_info.get('schema_info', {})
        foreign_keys = schema_info.get('foreign_keys', [])

        for fk in foreign_keys:
            fk_name = fk.get('name', f"fk_{table_name}")
            source = fk.get('source', '')
            target = fk.get('target', '')

            if source and target:
                # Parse source and target
                # Format: "public.table.column"
                source_parts = source.split('.')
                target_parts = target.split('.')

                if len(source_parts) >= 3 and len(target_parts) >= 3:
                    source_col = source_parts[-1]
                    target_table = target_parts[-2]
                    target_col = target_parts[-1]

                    sql_lines.append(
                        f"ALTER TABLE {table_name} "
                        f"ADD CONSTRAINT {fk_name} "
                        f"FOREIGN KEY ({source_col}) "
                        f"REFERENCES {target_table}({target_col});"
                    )

    sql_lines.append("")
    return '\n'.join(sql_lines)


def format_sql_value(value) -> str:
    """
    Format a Python value for SQL insertion
    """
    if value is None:
        return "NULL"
    elif isinstance(value, str):
        # Escape single quotes in strings
        escaped_value = value.replace("'", "''")
        return f"'{escaped_value}'"
    elif isinstance(value, bool):
        return "true" if value else "false"
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, list):
        # Handle arrays (simplified)
        formatted_items = [format_sql_value(item) for item in value]
        return "ARRAY[" + ", ".join(formatted_items) + "]"
    elif isinstance(value, dict):
        # Handle JSON/JSONB
        json_str = json.dumps(value).replace("'", "''")
        return f"'{json_str}'"
    else:
        # Convert to string and escape
        str_value = str(value).replace("'", "''")
        return f"'{str_value}'"


def generate_insert_statements(tables: list) -> str:
    """
    Generate INSERT statements for all table data
    """
    sql_lines = [
        "-- =====================================================",
        "-- INSERT DATA",
        "-- =====================================================",
        ""
    ]

    total_rows = 0

    for table_info in tables:
        table_name = table_info['table_name']
        data = table_info.get('data', [])

        if not data:
            sql_lines.append(f"-- No data for table: {table_name}")
            sql_lines.append("")
            continue

        sql_lines.append(f"-- Data for table: {table_name} ({len(data)} rows)")

        # Get column names from first row
        if data:
            columns = list(data[0].keys())
            columns_str = ', '.join(columns)

            # Generate INSERT statements
            for row in data:
                values = [format_sql_value(row.get(col)) for col in columns]
                values_str = ', '.join(values)

                sql_lines.append(
                    f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});"
                )
                total_rows += 1

        sql_lines.append("")

    sql_lines.append(f"-- Total rows inserted: {total_rows}")
    sql_lines.append("")
    return '\n'.join(sql_lines)


def generate_check_constraints(tables: list) -> str:
    """
    Generate CHECK constraint statements
    """
    sql_lines = [
        "-- =====================================================",
        "-- CHECK CONSTRAINTS",
        "-- =====================================================",
        ""
    ]

    constraints_added = False

    for table_info in tables:
        table_name = table_info['table_name']
        schema_info = table_info.get('schema_info', {})
        columns = schema_info.get('columns', [])

        for col in columns:
            check_constraint = col.get('check')
            if check_constraint:
                col_name = col['name']
                constraint_name = f"check_{table_name}_{col_name}"
                sql_lines.append(
                    f"ALTER TABLE {table_name} "
                    f"ADD CONSTRAINT {constraint_name} "
                    f"CHECK ({check_constraint});"
                )
                constraints_added = True

    if not constraints_added:
        sql_lines.append("-- No CHECK constraints to add")

    sql_lines.append("")
    return '\n'.join(sql_lines)


def generate_complete_sql(backup_data: dict, target_database: str) -> str:
    """
    Generate the complete SQL restore script
    """
    tables = backup_data.get('tables', [])
    backup_metadata = backup_data.get('backup_metadata', {})

    # Header
    header = f"""-- =====================================================
-- SUPABASE RESTORE SCRIPT
-- Generated by ACLEF Planning Backup System
-- =====================================================
-- Source backup: {backup_metadata.get('backup_time', 'Unknown')}
-- Target database: {target_database}
-- Generated: {datetime.now().isoformat()}
-- Tables: {len(tables)}
-- Total rows: {backup_metadata.get('statistics', {}).get('total_rows', 'Unknown')}
-- =====================================================

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

"""

    # Generate all SQL sections
    sql_sections = [
        header,
        generate_drop_statements(tables),
        generate_create_statements(tables),
        generate_primary_key_statements(tables),
        generate_insert_statements(tables),
        generate_foreign_key_statements(tables),
        generate_check_constraints(tables)
    ]

    # Footer
    footer = """-- =====================================================
-- RE-ENABLE CONSTRAINTS
-- =====================================================

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- =====================================================
-- RESTORE COMPLETE
-- =====================================================
"""

    sql_sections.append(footer)

    return '\n'.join(sql_sections)


def save_sql_file(sql_content: str, output_file: str = None) -> str:
    """
    Save the SQL content to a file
    """
    if not output_file:
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_file = f"restore_{timestamp}.sql"

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sql_content)

        print(f"[SUCCESS] SQL restore script saved to: {output_file}")
        return output_file

    except Exception as e:
        print(f"[ERROR] Failed to save SQL file: {e}")
        return None


def print_restore_summary(backup_data: dict, sql_file: str):
    """
    Print summary of the restore operation
    """
    tables = backup_data.get('tables', [])
    backup_metadata = backup_data.get('backup_metadata', {})
    stats = backup_metadata.get('statistics', {})

    print("\n" + "="*60)
    print("RESTORE SCRIPT GENERATION SUMMARY")
    print("="*60)
    print(f"Source backup: {backup_metadata.get('backup_time', 'Unknown')}")
    print(f"SQL file generated: {sql_file}")
    print(f"Tables to restore: {len(tables)}")
    print(f"Total rows to insert: {stats.get('total_rows', 'Unknown')}")

    print(f"\nTable details:")
    for table_info in tables:
        name = table_info.get('table_name', 'Unknown')
        rows = len(table_info.get('data', []))
        schema_info = table_info.get('schema_info', {})
        columns = len(schema_info.get('columns', []))

        print(f"  - {name:<25} | {columns:>2} cols | {rows:>4} rows")

    print("\nNext steps:")
    print(f"1. Review the generated SQL file: {sql_file}")
    print("2. Execute the SQL script on your target Supabase database")
    print("3. Verify the restored data")

    print("="*60)


def main():
    """
    Main function to generate SQL restore script
    """
    print("ACLEF Planning Database Restore Script Generator")
    print("=" * 50)

    try:
        # Parse command-line arguments
        args = parse_arguments()

        print(f"\nTarget database: {args.target_database}")
        print(f"Backup file: {args.backup_file}")

        # Load backup file
        backup_data = load_backup_file(args.backup_file)
        if not backup_data:
            return False

        # Generate SQL content
        print("\n[INFO] Generating SQL restore script...")
        sql_content = generate_complete_sql(backup_data, args.target_database)

        # Save SQL file
        sql_file = save_sql_file(sql_content, args.output)
        if not sql_file:
            return False

        # Print summary
        print_restore_summary(backup_data, sql_file)

        print("\n[SUCCESS] Restore script generation completed!")
        return True

    except Exception as e:
        print(f"\n[ERROR] Restore script generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)