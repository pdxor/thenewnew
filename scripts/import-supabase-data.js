import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Function to create a Supabase client with the provided URL and key
function createSupabaseClient(url, key) {
  return createClient(url, key);
}

// Function to read a JSON file from the export directory
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask a question and get user input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to create auth user and return the new user ID
async function createAuthUser(supabase, email, name) {
  try {
    // Create user in auth.users
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name },
      password: 'tempPassword123!' // Temporary password - user should reset this
    });
    
    if (createError) {
      throw createError;
    }
    
    return newUser.user.id;
  } catch (err) {
    console.error(`Error creating auth user for ${email}:`, err);
    return null;
  }
}

// Import data for a specific table
async function importTable(supabase, tableName, data) {
  console.log(`Importing data for table: ${tableName}...`);
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log(`No data to import for ${tableName}`);
    return { table: tableName, count: 0 };
  }
  
  try {
    // Insert data in batches of 100 records
    const BATCH_SIZE = 100;
    let importedCount = 0;
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      // Special handling for profiles table to ensure user_id exists in auth.users
      if (tableName === 'profiles') {
        for (const profile of batch) {
          // Check if user exists in auth.users
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);
          
          if (userError || !userData) {
            console.log(`Creating auth user for profile ${profile.email}...`);
            // Create user in auth.users if they don't exist
            const newUserId = await createAuthUser(supabase, profile.email, profile.name);
            
            if (!newUserId) {
              console.error(`Failed to create auth user for ${profile.email}`);
              continue;
            }
            
            // Update profile's user_id to match the new auth user
            profile.user_id = newUserId;
          }
        }
      }
      
      // Update references in other tables
      if (tableName === 'projects') {
        for (const project of batch) {
          // Update created_by to match new auth user IDs
          const creatorProfile = await supabase
            .from('profiles')
            .select('user_id')
            .eq('email', project.creator_email)
            .single();
            
          if (creatorProfile?.data?.user_id) {
            project.created_by = creatorProfile.data.user_id;
          }
          
          // Update team array to use new auth user IDs
          if (project.team && Array.isArray(project.team)) {
            const updatedTeam = [];
            for (const oldUserId of project.team) {
              const teamMemberProfile = await supabase
                .from('profiles')
                .select('user_id')
                .eq('old_user_id', oldUserId)
                .single();
                
              if (teamMemberProfile?.data?.user_id) {
                updatedTeam.push(teamMemberProfile.data.user_id);
              }
            }
            project.team = updatedTeam;
          }
        }
      }
      
      // Similar updates for tasks and items tables
      if (tableName === 'tasks' || tableName === 'items') {
        for (const item of batch) {
          // Update created_by/added_by to match new auth user IDs
          const creatorField = tableName === 'tasks' ? 'created_by' : 'added_by';
          const creatorProfile = await supabase
            .from('profiles')
            .select('user_id')
            .eq('old_user_id', item[creatorField])
            .single();
            
          if (creatorProfile?.data?.user_id) {
            item[creatorField] = creatorProfile.data.user_id;
          }
          
          // Update assigned_to for tasks
          if (tableName === 'tasks' && item.assigned_to) {
            const assigneeProfile = await supabase
              .from('profiles')
              .select('user_id')
              .eq('old_user_id', item.assigned_to)
              .single();
              
            if (assigneeProfile?.data?.user_id) {
              item.assigned_to = assigneeProfile.data.user_id;
            }
          }
        }
      }
      
      const { error } = await supabase.from(tableName).insert(batch);
      
      if (error) {
        console.error(`Error importing batch in ${tableName}:`, error);
        throw error;
      }
      
      importedCount += batch.length;
      console.log(`Imported ${importedCount}/${data.length} records into ${tableName}`);
    }
    
    return { table: tableName, count: importedCount };
  } catch (err) {
    console.error(`Error importing ${tableName}:`, err.message);
    return { table: tableName, error: err.message };
  }
}

// Main function to import all data
async function importAllData() {
  try {
    console.log('Starting Supabase data import...');
    
    // Get user input for export directory
    const exportDir = await askQuestion('Enter the path to the export directory (default: ./supabase-export): ') || './supabase-export';
    
    // Verify the export directory exists
    if (!fs.existsSync(exportDir)) {
      console.error(`Export directory ${exportDir} does not exist!`);
      rl.close();
      return;
    }
    
    // Get the schema information
    const schemaPath = path.join(exportDir, 'schema.json');
    const schema = readJsonFile(schemaPath);
    
    if (!schema || !schema.tables) {
      console.error('Invalid schema information. Make sure schema.json exists and contains a "tables" property.');
      rl.close();
      return;
    }
    
    // Get Supabase credentials from .env or user input
    const supabaseUrl = process.env.SUPABASE_URL || await askQuestion('Enter the new Supabase project URL: ');
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || await askQuestion('Enter the new Supabase service role key (for admin access): ');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL and key are required!');
      rl.close();
      return;
    }
    
    // Create Supabase client
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    
    // Ask for confirmation
    const tables = schema.tables;
    console.log(`\nReady to import the following tables: ${tables.join(', ')}`);
    const confirmation = await askQuestion('\nThis will INSERT data into your database. Are you sure? (yes/no): ');
    
    if (confirmation.toLowerCase() !== 'yes') {
      console.log('Import cancelled by user.');
      rl.close();
      return;
    }
    
    // Import tables in the correct order (handle dependencies)
    const importOrder = [
      'profiles',           // User profiles first (with auth.users creation)
      'notification_settings',
      'notification_logs',
      'api_keys',
      'projects',          // Projects needed for tasks and items
      'project_members',
      'tasks',             // Tasks before items (as items may reference tasks)
      'items',
      'business_plans'     // Business plans last (references projects)
    ];
    
    // Filter to only include tables that exist in the schema
    const tablesToImport = importOrder.filter(table => tables.includes(table));
    
    const results = [];
    for (const table of tablesToImport) {
      const dataPath = path.join(exportDir, `${table}.json`);
      const data = readJsonFile(dataPath);
      
      if (!data) {
        console.log(`Skipping table ${table} - data file not found or invalid.`);
        results.push({ table, error: 'Data file not found or invalid' });
        continue;
      }
      
      const result = await importTable(supabase, table, data);
      results.push(result);
    }
    
    // Generate summary
    console.log('\n=== Import Summary ===');
    results.forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.table}: Error - ${result.error}`);
      } else {
        console.log(`✅ ${result.table}: Imported ${result.count} records`);
      }
    });
    console.log('=====================\n');
    
    console.log('Data import complete!');
    
  } catch (err) {
    console.error('Error during import:', err);
  } finally {
    rl.close();
  }
}

// Run the import
importAllData();