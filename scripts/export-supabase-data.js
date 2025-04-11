import { supabase } from './supabase-client.js';
import fs from 'node:fs';
import path from 'node:path';

// Create export directory
const EXPORT_DIR = path.join(process.cwd(), 'supabase-export');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// Tables to export based on your schema
const TABLES = [
  'profiles',
  'projects',
  'project_members',
  'notification_settings',
  'notification_logs',
  'api_keys',
  'business_plans',
  'tasks',
  'items'
];

async function exportTable(tableName) {
  console.log(`Exporting table: ${tableName}...`);
  try {
    // Fetch all rows from the table
    const { data, error } = await supabase.from(tableName).select('*');
    
    if (error) {
      throw error;
    }
    
    // Save to JSON file
    const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Exported ${data.length} rows from ${tableName}`);
    return { table: tableName, count: data.length };
  } catch (err) {
    console.error(`❌ Error exporting ${tableName}:`, err.message);
    return { table: tableName, error: err.message };
  }
}

async function exportSchema() {
  console.log('Exporting database schema information...');
  try {
    // This is a simplified version - it only contains basic info since we don't have direct SQL access
    const schema = {
      tables: TABLES,
      exportDate: new Date().toISOString(),
      note: 'This is a simplified schema export. For complete schema, you need to use Supabase CLI.'
    };
    
    // Save schema info
    const filePath = path.join(EXPORT_DIR, 'schema.json');
    fs.writeFileSync(filePath, JSON.stringify(schema, null, 2));
    
    console.log('✅ Exported schema information');
  } catch (err) {
    console.error('❌ Error exporting schema:', err.message);
  }
}

async function exportAllData() {
  console.log('Starting Supabase data export...');
  console.log(`Export directory: ${EXPORT_DIR}`);
  
  try {
    // Export schema first
    await exportSchema();
    
    // Export all tables
    const results = [];
    for (const table of TABLES) {
      const result = await exportTable(table);
      results.push(result);
    }
    
    // Generate summary
    const summary = {
      exportDate: new Date().toISOString(),
      tables: results,
      exportDir: EXPORT_DIR,
      totalTables: results.length,
      successfulTables: results.filter(r => !r.error).length
    };
    
    // Save summary
    const summaryPath = path.join(EXPORT_DIR, 'export-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('\n=== Export Summary ===');
    console.log(`Total tables: ${summary.totalTables}`);
    console.log(`Successfully exported: ${summary.successfulTables}`);
    console.log(`Export directory: ${summary.exportDir}`);
    console.log('=====================\n');
    
    // Create a readme file with instructions
    const readmePath = path.join(EXPORT_DIR, 'README.md');
    fs.writeFileSync(readmePath, `# Supabase Data Export

Created: ${new Date().toISOString()}

## Files
${results.map(r => `- ${r.table}.json: ${r.error ? '❌ Error: ' + r.error : `✅ ${r.count} rows`}`).join('\n')}
- schema.json: Simplified schema information
- export-summary.json: Export summary

## Migration Instructions

### Option 1: Importing via Supabase Dashboard
1. Go to the Supabase Dashboard of your new project
2. Navigate to the Table Editor for each table
3. Use the "Import" button to upload the respective JSON files

### Option 2: Using Supabase CLI (on your local machine)
1. Install Supabase CLI: \`npm install -g supabase\`
2. Login: \`supabase login\`
3. Initialize Supabase for your project locally: \`supabase init\`
4. Link to your remote project: \`supabase link --project-ref your-project-ref\`
5. Create a SQL migration that inserts this data
6. Apply the migration: \`supabase db push\`

### Option 3: Programmatic Import
Use the Supabase JavaScript client to insert the data from these files into your new database.

> Note: You will also need to recreate custom functions, triggers, and policies in your new Supabase project.
`);
    
    console.log('✅ Created README.md with migration instructions');
    console.log('\nData export complete! You can find the exported data in the supabase-export directory.');
    console.log('Follow the instructions in supabase-export/README.md to import this data to your new Supabase instance.');
    
  } catch (err) {
    console.error('❌ Error during export:', err);
  }
}

// Run the export
exportAllData();