const pool = require('../src/config/database');

const backfillWalletBalance = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('🔄 Starting wallet balance backfill...');

    // Get all users with approved deposits
    const [users] = await connection.execute(`
      SELECT DISTINCT d.user_id
      FROM deposits d
      WHERE d.status = 'approved'
    `);

    console.log(`Found ${users.length} users with approved deposits`);

    for (const user of users) {
      const userId = user.user_id;

      // Calculate total approved deposits for this user
      const [deposits] = await connection.execute(`
        SELECT SUM(amount) as total_approved
        FROM deposits
        WHERE user_id = ? AND status = 'approved'
      `, [userId]);

      const totalApproved = parseFloat(deposits[0].total_approved) || 0;

      // Check if wallet exists
      const [wallets] = await connection.execute(
        'SELECT id FROM wallets WHERE user_id = ?',
        [userId]
      );

      if (wallets.length === 0) {
        // Create wallet with approved deposit amount
        await connection.execute(
          'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
          [userId, totalApproved]
        );
        console.log(`✅ Created wallet for user ${userId} with balance $${totalApproved.toFixed(2)}`);
      } else {
        // Update existing wallet with approved deposit amount
        await connection.execute(
          'UPDATE wallets SET balance = ? WHERE user_id = ?',
          [totalApproved, userId]
        );
        console.log(`✅ Updated wallet for user ${userId} with balance $${totalApproved.toFixed(2)}`);
      }
    }

    console.log('✅ Wallet balance backfill completed successfully!');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
};

backfillWalletBalance().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
