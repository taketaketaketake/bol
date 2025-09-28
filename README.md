# Astro Supabase Blog Starter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Astro](https://img.shields.io/badge/Astro-5.7.13-FF5D01?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.7-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.49.5-181818?logo=supabase&logoColor=white)](https://supabase.com/)

A modern blog starter built with Astro, featuring Supabase authentication, Markdown-based content management, and styled with Tailwind CSS.

## ✨ Features

- 🔐 User authentication with Supabase
- 📝 Complete blog post management with Markdown support
- 🎨 Clean, responsive design optimized for readability
- ⚡ Blazing fast performance with Astro
- 🛠️ Built with TypeScript for type safety and better developer experience
- 🌟 SEO-optimized with automatic sitemap generation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Yarn or npm
- Supabase account

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/calpa/astro-supabase-blog-starter.git
   cd astro-supabase-blog-starter
   ```

2. Install dependencies
   ```bash
   yarn install
   # or
   npm install
   ```

3. Set up environment variables
   ```

4. Start the development server
   ```bash
   yarn dev
   ```
   Your app will be available at [http://localhost:4321](http://localhost:4321)

## 📂 Project Structure

```
/
├── public/               # Static files
├── src/
│   ├── components/       # Shared components
│   │   ├── auth/         # Authentication components
│   │   └── dashboard/    # Admin dashboard components
│   ├── db/               # Database related
│   ├── layout/           # Layout components
│   ├── lib/              # Utility functions
│   ├── middleware.ts     # Application middleware
│   └── pages/            # Page components
│       ├── api/          # API routes
│       ├── auth/         # Authentication pages
│       ├── dashboard/    # Admin dashboard pages
│       └── articles/     # Article pages
├── .env.example          # Environment variables example
├── package.json          # Project dependencies
└── tsconfig.json         # TypeScript configuration
```

## 🧑‍💻 Development Commands

| Command                 | Description                                    |
| :--------------------- | :-------------------------------------------- |
| `yarn install`         | Install dependencies                          |
| `yarn dev`             | Start development server (http://localhost:4321) |
| `yarn build`           | Build for production (outputs to `./dist`)    |
| `yarn preview`         | Preview production build                      |
| `yarn astro ...`       | Run Astro CLI commands                       |
| `yarn astro -- --help` | Show Astro CLI help                           |

## 🔒 Environment Variables

Create a `.env` file based on `.env.example` and set the following variables:

- `PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key
- `DATABASE_URL`: Database connection string
- `PUBLIC_SITE_URL`: Your site URL (usually http://localhost:4321 in development)

## 📝 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgements

- [Astro](https://astro.build/) - The all-in-one web framework
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework

---

<p align="center">
  <a href="https://github.com/calpa/astro-supabase-blog-starter/stargazers">
    <img src="https://img.shields.io/github/stars/calpa/astro-supabase-blog-starter?style=social" alt="GitHub Stars">
  </a>
  <a href="https://github.com/calpa/astro-supabase-blog-starter/forks">
    <img src="https://img.shields.io/github/forks/calpa/astro-supabase-blog-starter?style=social" alt="GitHub Forks">
  </a>
  <a href="https://github.com/calpa/astro-supabase-blog-starter/issues">
    <img src="https://img.shields.io/github/issues/calpa/astro-supabase-blog-starter" alt="GitHub Issues">
  </a>
</p>
