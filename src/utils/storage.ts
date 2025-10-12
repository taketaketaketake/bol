/**
 * Supabase Storage utilities for order photo uploads
 * ⚠️ SERVER-SIDE ONLY - Contains service role key
 * This file should NEVER be imported in client-side code
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Runtime check to ensure this runs server-side only
if (typeof window !== 'undefined') {
  throw new Error('storage.ts must only be used server-side - contains sensitive service role key');
}

// Validate required environment variables
if (!process.env.PUBLIC_SUPABASE_URL) {
  throw new Error('Missing PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Create service role client for trusted uploads (SERVER-SIDE ONLY)
const serviceClient: SupabaseClient = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Upload image to Supabase Storage
 * ⚠️ SERVER-SIDE ONLY
 * @param file - File object to upload
 * @param path - Storage path (e.g., "orders/order-id/pickup.jpg")
 * @returns Promise<string> - Public URL of uploaded image
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size must be less than 10MB');
    }

    // Upload to order-photos bucket
    const { data, error } = await serviceClient.storage
      .from('order-photos')
      .upload(path, file, {
        upsert: true, // Allow overwriting existing files
        contentType: file.type,
        cacheControl: '3600' // 1 hour cache control for CDN
      });

    if (error) {
      console.error('[Storage] Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL with defensive check
    const { data: urlData } = serviceClient.storage
      .from('order-photos')
      .getPublicUrl(path);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to retrieve public URL');
    }

    return urlData.publicUrl;

  } catch (error) {
    console.error('[Storage] Error uploading image:', error);
    throw error;
  }
}

/**
 * Generate signed URL for secure image access
 * ⚠️ SERVER-SIDE ONLY
 * @param path - Storage path
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Promise<string> - Signed URL
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  try {
    const { data, error } = await serviceClient.storage
      .from('order-photos')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('[Storage] Signed URL error:', error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;

  } catch (error) {
    console.error('[Storage] Error creating signed URL:', error);
    throw error;
  }
}

/**
 * Delete image from storage
 * ⚠️ SERVER-SIDE ONLY
 * @param path - Storage path to delete
 * @returns Promise<void>
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const { error } = await serviceClient.storage
      .from('order-photos')
      .remove([path]);

    if (error) {
      console.error('[Storage] Delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }

  } catch (error) {
    console.error('[Storage] Error deleting image:', error);
    throw error;
  }
}

/**
 * Generate standardized photo path for order workflow
 * @param orderId - Order UUID
 * @param photoType - Type of photo (pickup, laundry, delivery)
 * @param extension - File extension (default: jpg)
 * @returns string - Standardized storage path
 */
export function generatePhotoPath(
  orderId: string, 
  photoType: 'pickup' | 'laundry' | 'delivery',
  extension: string = 'jpg'
): string {
  const timestamp = Date.now();
  return `orders/${orderId}/${photoType}_${timestamp}.${extension}`;
}

/**
 * Validate uploaded image file
 * @param file - File to validate
 * @returns Promise<void> - Throws if validation fails
 */
export async function validateImageFile(file: File): Promise<void> {
  // Check file type (including both HEIC and HEIF variants)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, HEIC, and HEIF images are allowed.');
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 10MB.');
  }

  // Additional validation could include:
  // - Image dimensions
  // - File content verification
  // - Virus scanning (in production)
}

// Export type for use in API routes
export type PhotoType = 'pickup' | 'laundry' | 'delivery';