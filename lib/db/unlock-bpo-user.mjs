#!/usr/bin/env node

/**
 * Quick script to unlock BPO access for a specific user
 * Usage: node unlock-bpo-user.mjs
 */

import { supabase } from './src/index.ts';

async function unlockBPOAccess(email) {
  try {
    console.log(`🔍 Looking up user: ${email}`);
    
    // Find the user
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, account_type, bpo_status, role, full_name')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error fetching user:', fetchError.message);
      return false;
    }

    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      return false;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      name: user.full_name || 'N/A',
      currentAccountType: user.account_type || 'USER',
      currentBpoStatus: user.bpo_status || 'N/A',
      role: user.role || 'user'
    });

    // Update user to have BPO access
    console.log('\n🔓 Unlocking BPO access...');
    
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        account_type: 'BPO',
        bpo_status: 'APPROVED',
        is_active: true,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating user:', updateError.message);
      return false;
    }

    console.log('✅ BPO access unlocked successfully!');
    console.log('\n📋 Updated user details:', {
      id: updated.id,
      email: updated.email,
      accountType: updated.account_type,
      bpoStatus: updated.bpo_status,
      isActive: updated.is_active,
      approvedAt: updated.approved_at
    });

    // Log the action in audit logs
    await supabase.from('audit_logs').insert({
      action: 'bpo_access_unlocked',
      entity_type: 'user_profile',
      entity_id: String(user.id),
      metadata: {
        email: email,
        result: 'success',
        unlocked_by: 'admin_script',
        timestamp: new Date().toISOString()
      }
    });

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

// Main execution
const targetEmail = 'aliyaanmohd42@gmail.com';

console.log('🚀 BPO Access Unlock Script');
console.log('============================\n');

unlockBPOAccess(targetEmail)
  .then((success) => {
    if (success) {
      console.log('\n✅ All done! User can now access all BPO features.');
      process.exit(0);
    } else {
      console.log('\n❌ Failed to unlock BPO access.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  });
