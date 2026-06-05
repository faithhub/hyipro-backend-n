require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKUP_DIR = path.join(__dirname, '../backups');
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'hyipro';

// Get backup file from command line argument
const backupFile = process.argv[2];

if (!backupFile) {
  console.error('❌ Error: Please provide a backup file path');
  console.log('Usage: node scripts/restore-database.js <backup-file>');
  console.log('Example: node scripts/restore-database.js backups/hyipro_2024-06-02T12-00-00-000Z.sql.gz');
  process.exit(1);
}

// Check if backup file exists
const backupPath = path.isAbsolute(backupFile) ? backupFile : path.join(BACKUP_DIR, backupFile);

if (!fs.existsSync(backupPath)) {
  console.error(`❌ Error: Backup file not found: ${backupPath}`);
  process.exit(1);
}

// Confirm before restoring
console.log(`⚠️  WARNING: This will replace the current database '${DB_NAME}' with the backup.`);
console.log(`📁 Backup file: ${backupPath}`);
console.log(`📍 Database: ${DB_HOST}/${DB_NAME}`);
console.log('');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

setTimeout(() => {
  console.log('🔄 Starting database restore...');

  // Build restore command
  const command = `gunzip -c ${backupPath} | mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Restore failed: ${error.message}`);
      process.exit(1);
    }

    if (stderr) {
      console.error(`⚠️  Warning: ${stderr}`);
    }

    console.log(`✅ Database restored successfully from: ${backupPath}`);
  });
}, 5000);
