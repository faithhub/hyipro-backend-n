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
const RETENTION_DAYS = 30;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Generate timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `${DB_NAME}_${timestamp}.sql.gz`);

// Build mysqldump command
const command = `mysqldump -h ${DB_HOST} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} | gzip > ${backupFile}`;

console.log(`🔄 Starting database backup...`);
console.log(`📁 Backup file: ${backupFile}`);

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    process.exit(1);
  }

  if (stderr) {
    console.error(`⚠️  Warning: ${stderr}`);
  }

  console.log(`✅ Backup completed successfully: ${backupFile}`);

  // Clean up old backups
  cleanOldBackups();
});

function cleanOldBackups() {
  console.log(`🧹 Cleaning up backups older than ${RETENTION_DAYS} days...`);

  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const fileAge = now - stats.mtimeMs;

    if (fileAge > retentionMs) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`🗑️  Deleted old backup: ${file}`);
    }
  });

  console.log(`✅ Cleanup completed. Deleted ${deletedCount} old backup(s).`);
}
