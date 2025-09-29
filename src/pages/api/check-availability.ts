import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
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

    // Check if we service this area
    const { data: zone, error: zoneError } = await supabase
      .from('service_zones')
      .select('id, name, postal_codes')
      .contains('postal_codes', [postalCode])
      .single();

    if (zoneError || !zone) {
      return new Response(
        JSON.stringify({
          available: false,
          message: 'Sorry, we don\'t service this area yet. We\'ll notify you when we expand!'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get available time windows for the date and zone
    const { data: availableWindows, error: windowError } = await supabase
      .rpc('get_available_windows', {
        service_date: date,
        zone_id: zone.id
      });

    if (windowError) {
      console.error('Error getting available windows:', windowError);
      return new Response(
        JSON.stringify({
          available: false,
          error: 'Error checking availability'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format time windows for frontend
    const timeWindows = availableWindows?.map((window: any) => ({
      id: window.time_window_id,
      label: window.label,
      startTime: window.start_time,
      endTime: window.end_time,
      availableSlots: window.available_slots,
      totalCapacity: window.total_capacity
    })) || [];

    return new Response(
      JSON.stringify({
        available: true,
        zone: {
          id: zone.id,
          name: zone.name
        },
        timeWindows: timeWindows,
        message: timeWindows.length > 0 ?
          `Great! We have ${timeWindows.length} time windows available.` :
          'No available time slots for this date. Please try another date.'
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