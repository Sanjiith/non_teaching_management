/**
 * Migration: Consolidate consecutive single-day leave records
 * into single multi-day leave documents for the same user and type.
 * 
 * Run with: node migrate/consolidate_leaves.js
 * 
 * This script:
 * 1. Finds all leaves where fromDate === toDate (single-day) grouped by user
 * 2. Detects consecutive single-day leaves of the same type+status for the same user
 * 3. Merges them into a single multi-day leave document
 * 4. Cleans up the individual single-day records
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const Leave = require('../models/Leave.model');

const normalizeDateToUTC = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const isSameDay = (d1, d2) => {
  const a = normalizeDateToUTC(d1);
  const b = normalizeDateToUTC(d2);
  return a.getTime() === b.getTime();
};

const addOneDay = (date) => {
  const d = normalizeDateToUTC(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
};

async function consolidate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Find all single-day leaves (fromDate === toDate)
  const allLeaves = await Leave.find({}).sort({ user: 1, fromDate: 1, type: 1 });

  // Group by user
  const byUser = {};
  allLeaves.forEach(l => {
    const uid = l.user.toString();
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(l);
  });

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const [userId, userLeaves] of Object.entries(byUser)) {
    // Filter only single-day leaves
    const singleDays = userLeaves.filter(l => isSameDay(l.fromDate, l.toDate));
    
    if (singleDays.length < 2) continue;

    // Sort by date
    singleDays.sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate));

    // Detect consecutive groups with same type and status
    const groups = [];
    let currentGroup = [singleDays[0]];

    for (let i = 1; i < singleDays.length; i++) {
      const prev = singleDays[i - 1];
      const curr = singleDays[i];
      const prevNext = addOneDay(prev.fromDate);
      const currDate = normalizeDateToUTC(curr.fromDate);

      const isConsecutive = prevNext.getTime() === currDate.getTime();
      const isSameType = prev.type === curr.type;
      const isSameStatus = prev.status === curr.status;

      if (isConsecutive && isSameType && isSameStatus) {
        currentGroup.push(curr);
      } else {
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);

    // Merge groups with 2+ consecutive leaves
    for (const group of groups) {
      if (group.length < 2) continue;

      const first = group[0];
      const last = group[group.length - 1];
      const totalDays = group.reduce((sum, l) => sum + (l.totalDays || 1), 0);

      console.log(
        `  Merging ${group.length} leaves for user ${userId.slice(-6)}: ` +
        `${normalizeDateToUTC(first.fromDate).toISOString().split('T')[0]} → ` +
        `${normalizeDateToUTC(last.toDate).toISOString().split('T')[0]} ` +
        `(${first.type}, ${first.status})`
      );

      // Update the first record to be the consolidated multi-day leave
      await Leave.findByIdAndUpdate(first._id, {
        $set: {
          toDate: normalizeDateToUTC(last.toDate),
          totalDays,
        },
      });

      // Delete the rest
      const idsToDelete = group.slice(1).map(l => l._id);
      await Leave.deleteMany({ _id: { $in: idsToDelete } });

      totalMerged++;
      totalDeleted += idsToDelete.length;
    }
  }

  console.log(`\n✅ Consolidation complete:`);
  console.log(`   Multi-day leave records created/updated: ${totalMerged}`);
  console.log(`   Duplicate single-day records removed: ${totalDeleted}`);
  console.log(`   Total documents remaining: ${await Leave.countDocuments()}`);

  await mongoose.disconnect();
}

consolidate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
