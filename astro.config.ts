import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://bagsoflaundry.com', // Replace with your actual domain
  integrations: [
    react(),
    sitemap({
      customPages: [
        'https://bagsoflaundry.com/services',
        'https://bagsoflaundry.com/pricing',
        'https://bagsoflaundry.com/service-areas',
        'https://bagsoflaundry.com/how-it-works'
      ],
      serialize(item) {
        // Set different priorities for different page types
        if (item.url.includes('/start-basic') || item.url.includes('/order-type') ||
            item.url.includes('/addons') || item.url.includes('/details') ||
            item.url.includes('/checkout') || item.url.includes('/confirm')) {
          // Checkout flow pages - lower priority, noindex
          return {
            ...item,
            priority: 0.3,
            changefreq: 'monthly'
          };
        }
        if (item.url.includes('/services') || item.url.includes('/pricing')) {
          // High priority service pages
          return {
            ...item,
            priority: 0.9,
            changefreq: 'weekly'
          };
        }
        if (item.url === 'https://bagsoflaundry.com/') {
          // Homepage - highest priority
          return {
            ...item,
            priority: 1.0,
            changefreq: 'daily'
          };
        }
        // Default for other pages
        return {
          ...item,
          priority: 0.7,
          changefreq: 'monthly'
        };
      }
    })
  ],
  output: 'server',
  adapter: netlify(),

  vite: {
    plugins: [tailwindcss()]
  }
});