/**
 * Driver Tasks API Endpoint
 * Returns all tasks assigned to the current driver
 * Organized by pickup/delivery/in-process categories
 * ⚠️ SERVER-SIDE ONLY - Requires authenticated driver/admin
 */

import type { APIRoute } from 'astro';
import { requireRole } from '../../../utils/require-role';
import { supabase } from '../../../lib/supabase';
import { rateLimit, RATE_LIMITS } from '../../../utils/rate-limit';

const log = (msg: string, data?: any) =>
  import.meta.env.MODE !== 'production' && console.log(`[driver-tasks] ${msg}`, data || '');

export const GET: APIRoute = async ({ cookies, url, request }) => {
  // Apply read rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMITS.READ);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // 1️⃣ Auth check (driver or admin)
    const { user, roles } = await requireRole(cookies, ['driver', 'admin']);

    log('Tasks request received', { userId: user.id, roles });

    // 2️⃣ Get current driver info
    let currentDriver = null;
    if (roles.includes('driver')) {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();
      currentDriver = driverData;
    } else {
      // Admin can view all drivers - get from query param or default to first active
      const driverId = url.searchParams.get('driver_id');
      if (driverId) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', driverId)
          .single();
        currentDriver = driverData;
      } else {
        // Default to first active driver for admin
        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('active', true)
          .limit(1)
          .single();
        currentDriver = driverData;
      }
    }

    if (!currentDriver) {
      return new Response(
        JSON.stringify({ 
          error: 'Driver not found',
          message: 'No active driver found for this user'
        }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 3️⃣ Get date range for filtering
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(date + 'T00:00:00.000Z').toISOString();
    const endOfDay = new Date(date + 'T23:59:59.999Z').toISOString();

    log('Fetching tasks for driver', { 
      driverId: currentDriver.id, 
      driverName: currentDriver.full_name,
      date 
    });

    // 4️⃣ Fetch assigned orders for this driver
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customers(full_name, phone, email),
        addresses(line1, line2, city, state, postal_code),
        time_windows!pickup_time_window_id(label, start_time, end_time),
        delivery_time_windows:time_windows!delivery_time_window_id(label, start_time, end_time),
        laundromats(name, address, phone)
      `)
      .eq('driver_id', currentDriver.id)
      .not('status', 'in', '(completed,canceled)')
      .gte('pickup_date', startOfDay)
      .lte('pickup_date', endOfDay)
      .order('pickup_date', { ascending: true });

    if (ordersError) {
      log('Database error fetching orders:', ordersError);
      throw new Error('Failed to fetch driver tasks');
    }

    log('Orders fetched successfully', { count: orders?.length || 0 });

    // 5️⃣ Helper functions (define first)
    function formatAddress(address: any) {
      if (!address) return 'Address not available';
      return `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}, ${address.state} ${address.postal_code}`;
    }

    function getGoogleMapsUrl(address: any) {
      if (!address) return null;
      const addressString = formatAddress(address);
      return `https://maps.google.com/?q=${encodeURIComponent(addressString)}`;
    }

    // 6️⃣ Transform orders for API response
    const transformOrder = (order: any) => ({
      id: order.id,
      shortId: order.id.split('-')[0],
      status: order.status,
      customer: {
        name: order.customers?.full_name || 'Unknown',
        phone: order.customers?.phone || null,
        email: order.customers?.email || null
      },
      address: {
        line1: order.addresses?.line1 || 'Address not available',
        line2: order.addresses?.line2 || null,
        city: order.addresses?.city || 'Unknown',
        state: order.addresses?.state || 'MI',
        postal_code: order.addresses?.postal_code || '00000',
        formatted: formatAddress(order.addresses),
        mapsUrl: getGoogleMapsUrl(order.addresses)
      },
      timeWindow: {
        label: order.time_windows?.label || 'Anytime',
        startTime: order.time_windows?.start_time || null,
        endTime: order.time_windows?.end_time || null
      },
      service: {
        type: order.service_type || 'Wash & Fold',
        notes: order.notes || null
      },
      dates: {
        pickup: order.pickup_date,
        delivery: order.delivery_date || null
      },
      photos: {
        pickup: order.pickup_photo || null,
        delivery: order.delivery_photo || null
      },
      weight: {
        estimated: order.estimated_weight_lb || null,
        measured: order.measured_weight_lb || null
      },
      laundromat: order.laundromats ? {
        name: order.laundromats.name,
        address: order.laundromats.address,
        phone: order.laundromats.phone
      } : null,
      meta: {
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        pickedUpAt: order.picked_up_at,
        deliveredAt: order.delivered_at
      }
    });

    // 6️⃣ Organize tasks by type
    const pickupTasks = orders?.filter(order => 
      ['scheduled', 'en_route_pickup'].includes(order.status)
    ) || [];

    const deliveryTasks = orders?.filter(order => 
      ['ready_for_delivery', 'en_route_delivery'].includes(order.status)
    ) || [];

    const inProcessTasks = orders?.filter(order => 
      ['picked_up', 'processing'].includes(order.status)
    ) || [];

    // 7️⃣ Build response
    const response = {
      success: true,
      driver: {
        id: currentDriver.id,
        name: currentDriver.full_name,
        phone: currentDriver.phone || null,
        availability: currentDriver.availability_status || 'available'
      },
      date,
      tasks: {
        pickups: pickupTasks.map(transformOrder),
        deliveries: deliveryTasks.map(transformOrder),
        inProcess: inProcessTasks.map(transformOrder)
      },
      summary: {
        totalTasks: orders?.length || 0,
        pickupCount: pickupTasks.length,
        deliveryCount: deliveryTasks.length,
        inProcessCount: inProcessTasks.length
      },
      meta: {
        fetchedAt: new Date().toISOString(),
        timezone: 'America/Detroit'
      }
    };

    log('Tasks response prepared', {
      driverId: currentDriver.id,
      totalTasks: response.summary.totalTasks,
      pickups: response.summary.pickupCount,
      deliveries: response.summary.deliveryCount,
      inProcess: response.summary.inProcessCount
    });

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );

  } catch (error) {
    console.error('[driver-tasks] Fatal error:', error);
    
    // Handle authentication/authorization errors
    if (error instanceof Response) return error;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch driver tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const prerender = false;