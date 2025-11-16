import * as dotenv from 'dotenv';
dotenv.config();

import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://bagsoflaundry.com',

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
        if (
          item.url.includes('/start-basic') ||
          item.url.includes('/order-type') ||
          item.url.includes('/addons') ||
          item.url.includes('/details') ||
          item.url.includes('/checkout') ||
          item.url.includes('/confirm')
        ) {
          return {
            ...item,
            priority: 0.3,
            changefreq: 'monthly'
          };
        }
        if (item.url.includes('/services') || item.url.includes('/pricing')) {
          return {
            ...item,
            priority: 0.9,
            changefreq: 'weekly'
          };
        }
        if (item.url === 'https://bagsoflaundry.com/') {
          return {
            ...item,
            priority: 1.0,
            changefreq: 'daily'
          };
        }
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
    plugins: [tailwindcss()],
    server: {
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.ngrok-free.app', // 👈 wildcard for any ngrok subdomain
      ],
      host: true, // 👈 ensure external access via ngrok works
      strictPort: false, // avoid conflicts
    },
  },
});
