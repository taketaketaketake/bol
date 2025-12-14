#!/usr/bin/env node

/**
 * CLI-based integration test using Supabase service role
 * Bypasses authentication by directly inserting test data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Debug: Check if env vars are loaded
console.log('🔍 Environment check:');
console.log('PUBLIC_SUPABASE_URL:', process.env.PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
console.log('');

if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('Make sure you have a .env file with:');
  console.error('PUBLIC_SUPABASE_URL=your_url');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

// Use service role to bypass RLS
const supabaseAdmin = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOrderFlow() {
  console.log('🧪 Testing Order Flow via CLI...\n');

  try {
    // 1. Create test customer (with unique email)
    const testEmail = `cli-test-${Date.now()}@example.com`;
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        full_name: 'CLI Test Customer',
        email: testEmail,
        phone: '+15551234567'
      })
      .select()
      .single();

    if (customerError) throw customerError;
    console.log('✅ Created test customer:', customer.id);

    // 2. Get a time window first
    const { data: timeWindows, error: timeWindowError } = await supabaseAdmin
      .from('time_windows')
      .select('id')
      .limit(1);

    if (timeWindowError || !timeWindows || timeWindows.length === 0) {
      console.log('⚠️  No time windows found, creating one...');
      const { data: newTimeWindow, error: createTimeWindowError } = await supabaseAdmin
        .from('time_windows')
        .insert({
          label: 'Test Window',
          start_time: '09:00',
          end_time: '12:00'
        })
        .select()
        .single();
      
      if (createTimeWindowError) throw createTimeWindowError;
      timeWindows[0] = newTimeWindow;
    }

    // 3. Create test order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer.id,
        service_type: 'wash_fold',
        pricing_model: 'per_lb',
        pickup_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        pickup_time_window_id: timeWindows[0].id, // Required field
        pickup_address_line1: '123 CLI Test St',
        pickup_address_city: 'Detroit',
        pickup_address_state: 'MI',
        pickup_address_postal_code: '48201',
        status: 'scheduled',
        subtotal_cents: 3500,
        total_cents: 3500
      })
      .select()
      .single();

    if (orderError) throw orderError;
    console.log('✅ Created test order:', order.id);

    // 4. Test laundromat routing
    const { data: laundromats, error: routingError } = await supabaseAdmin
      .rpc('find_laundromat_by_zip', { incoming_zip: '48201' });

    if (routingError) throw routingError;
    
    if (laundromats && laundromats.length > 0) {
      console.log('✅ Found laundromats for ZIP 48201:', laundromats.length);
      console.log('🏭 Available laundromats:', laundromats.map(l => `${l.name} (${l.capacity_remaining} slots)`));

      // 4. Test assignment
      const { data: assigned, error: assignError } = await supabaseAdmin
        .rpc('assign_order_to_laundromat', { 
          order_id: order.id, 
          laundromat_id: laundromats[0].id 
        });

      if (assignError) throw assignError;
      console.log('✅ Order assigned to laundromat:', laundromats[0].name);

      // 5. Test status progression
      const statusUpdates = [
        { status: 'picked_up', field: 'picked_up_at' },
        { status: 'processing', field: null },
        { status: 'ready_for_delivery', field: 'ready_for_delivery_at' },
        { status: 'delivered', field: 'delivered_at' }
      ];

      for (const update of statusUpdates) {
        const updateData = { status: update.status };
        if (update.field) {
          updateData[update.field] = new Date().toISOString();
        }

        const { error: statusError } = await supabaseAdmin
          .from('orders')
          .update(updateData)
          .eq('id', order.id);

        if (statusError) throw statusError;
        console.log(`✅ Status updated: ${update.status}`);
      }

      console.log('\n🎉 Full order flow test PASSED!');
      
      // 6. Cleanup
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      await supabaseAdmin.from('customers').delete().eq('id', customer.id);
      console.log('🧹 Test data cleaned up');

    } else {
      console.log('⚠️  No laundromats found for ZIP 48201 - check your test data');
      
      // Show available laundromats
      const { data: allLaundromats } = await supabaseAdmin
        .from('laundromats')
        .select('name, zip_code, is_active')
        .eq('is_active', true);
      
      console.log('Available laundromats:', allLaundromats);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testOrderFlow();