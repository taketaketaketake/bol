import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getConfig } from '../../utils/env';

// Get validated configuration
const config = getConfig();

// Use service role client for trusted operations
const serviceClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { address, date } = body;

    // Extract postal code from address or use geocoding
    const postalCode = extractPostalCode(address);

    if (!postalCode) {
      return new Response(
        JSON.stringify({
          available: false,
          error: 'Could not determine postal code from address'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if any laundromats service this ZIP code
    const { data: availableLaundromats, error: laundromatError } = await serviceClient
      .rpc('find_laundromat_by_zip', { incoming_zip: postalCode });

    if (laundromatError) {
      console.error('Error finding laundromats:', laundromatError);
      return new Response(
        JSON.stringify({
          available: false,
          error: 'Error checking service availability'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!availableLaundromats || availableLaundromats.length === 0) {
      return new Response(
        JSON.stringify({
          available: false,
          message: `Sorry, we don't service ZIP code ${postalCode} yet. We'll notify you when we expand!`,
          zipCode: postalCode
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get available time windows from database
    const { data: timeWindows, error: windowError } = await serviceClient
      .from('time_windows')
      .select('id, label, start_time, end_time')
      .eq('is_active', true)
      .order('start_time');

    if (windowError) {
      console.error('Error getting time windows:', windowError);
      return new Response(
        JSON.stringify({
          available: false,
          error: 'Error loading time windows'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate capacity for each time window across all available laundromats
    const timeWindowsWithCapacity = timeWindows?.map(window => {
      const totalCapacity = availableLaundromats.reduce((sum: number, laundromat: any) => {
        // Check if laundromat operates during this time window
        const isOperating = 
          (window.label.toLowerCase().includes('morning') && laundromat.operates_morning !== false) ||
          (window.label.toLowerCase().includes('afternoon') && laundromat.operates_afternoon !== false) ||
          (window.label.toLowerCase().includes('evening') && laundromat.operates_evening !== false) ||
          (!window.label.toLowerCase().match(/(morning|afternoon|evening)/)); // Default to operating if not specified

        return sum + (isOperating ? laundromat.capacity_remaining : 0);
      }, 0);

      return {
        id: window.id,
        label: window.label,
        startTime: window.start_time,
        endTime: window.end_time,
        availableSlots: totalCapacity,
        totalCapacity: totalCapacity
      };
    }).filter(window => window.availableSlots > 0) || []; // Only return windows with capacity

    // Get summary of serving laundromats
    const laundromatSummary = availableLaundromats.map((l: any) => ({
      name: l.name,
      capacity: l.capacity_remaining,
      maxCapacity: l.max_daily_orders
    }));

    return new Response(
      JSON.stringify({
        available: true,
        zipCode: postalCode,
        laundromats: laundromatSummary,
        timeWindows: timeWindowsWithCapacity,
        message: timeWindowsWithCapacity.length > 0 ?
          `Great! We have ${availableLaundromats.length} partner laundromat(s) available with ${timeWindowsWithCapacity.length} time window(s).` :
          'All partner laundromats are at capacity for this date. Please try another date.'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking availability:', error);
    return new Response(
      JSON.stringify({
        available: false,
        error: 'Server error checking availability'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

function extractPostalCode(address: string): string | null {
  // Simple regex to extract 5-digit ZIP code
  const zipMatch = address.match(/\b(\d{5})\b/);
  return zipMatch ? zipMatch[1] : null;
}