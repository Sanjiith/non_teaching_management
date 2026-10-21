/**
 * migrate_earned_leave.js
 * 
 * ONE-TIME migration: corrects earnedLeave.total from 30 → 12
 * for all users currently in the database.
 *
 * Safe to re-run — only updates users where total > 12.
 *
 * Run with:
 *   node server/migrate/migrate_earned_leave.js
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  // Find all users where earnedLeave.total is NOT already 12
  const affected = await User.find({
    'leaveBalances.earnedLeave.total': { $ne: 12 },
  }).select('_id name employeeId leaveBalances');

  if (affected.length === 0) {
    console.log('✅ No users need migration — all earnedLeave.total already = 12');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`🔧 Found ${affected.length} user(s) with earnedLeave.total ≠ 12. Migrating...\n`);

  let fixed = 0;
  let skipped = 0;

  for (const user of affected) {
    const el = user.leaveBalances?.earnedLeave;
    const currentTotal = el?.total ?? 30;
    const currentUsed = el?.used ?? 0;
    const currentReserved = el?.reserved ?? 0;

    // Do NOT let total go below already-used + reserved days
    // (guards against weird edge cases where someone has somehow used > 12)
    const minimumSafeTotal = currentUsed + currentReserved;

    if (minimumSafeTotal > 12) {
      console.log(
        `  ⚠ SKIP  ${user.employeeId} (${user.name}): ` +
        `used=${currentUsed} + reserved=${currentReserved} > 12 — ` +
        `cannot reduce total without creating negative available balance. Manual review needed.`
      );
      skipped++;
      continue;
    }

    user.leaveBalances.earnedLeave.total = 12;
    user.markModified('leaveBalances');
    await user.save();

    const available = 12 - currentUsed - currentReserved;
    console.log(
      `  ✅ FIXED ${user.employeeId} (${user.name}): ` +
      `total ${currentTotal} → 12  |  available = ${available}`
    );
    fixed++;
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Fixed  : ${fixed}`);
  console.log(`  Skipped: ${skipped} (requires manual review)`);
  console.log(`  Total  : ${affected.length}`);
  console.log(`═══════════════════════════════════════════\n`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
