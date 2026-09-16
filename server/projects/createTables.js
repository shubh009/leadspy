import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL missing in .env');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📡 Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB successfully!');
    
    console.log('⚡ Running schema.sql migration...');
    await client.query(sql);
    console.log('🎉 Tables "master_projects" and "user_saved_projects" created successfully in Supabase!');

    // Verify tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('master_projects', 'user_saved_projects', 'campaigns', 'leads');
    `);
    console.log('📋 Verified Tables in Public Schema:', res.rows.map(r => r.table_name));

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
