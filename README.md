# MBK Blog - SEO Optimized Blogging Platform

## Features
- **SEO Optimized** with sitemap generation, robots.txt, canonical URLs, and schema markup
- **Dynamic Blog Posts** with categories and tags
- **Comment System** with nested replies
- **Admin Dashboard** for content management
- **Responsive Design** for mobile and desktop

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env` file in the root directory with your configuration:

```env
DATABASE_URL=your_database_url
PORT=3065
NODE_ENV=production
BASE_URL=https://yourblogdomain.com
```

## Running the Application

**Development:**
```bash
npm start
```

**Generate Sitemaps:**
Generate XML sitemaps for search engines (should be run whenever content changes):
```bash
npm run generate-sitemap
```

This command will:
- Query the database for all published posts, categories, and tags
- Generate static XML sitemap files in the `public/` directory
- Create a sitemap index for search engines

**Sitemaps Generated:**
- `sitemap.xml` - Main sitemap index
- `sitemap-posts.xml` - All published blog posts
- `sitemap-categories.xml` - All categories
- `sitemap-tags.xml` - All tags

## SEO Features

### ✅ Implemented
- **robots.txt** - Guides search engine crawlers
- **XML Sitemaps** - Automatic generation via npm script
- **Canonical URLs** - Prevents duplicate content issues
- **Meta Tags** - Dynamic meta descriptions and Open Graph tags
- **Schema.org Markup** - Article, Blog, and Organization schemas
- **Twitter Cards** - Enhanced social media sharing
- **Structured Data** - BreadcrumbList and Author information
- **Static Asset Caching** - Optimized performance
- **GZIP Compression** - Faster page loads

### 📝 Todo
- When reply to subreply show replies disappear
- Allow infinite sub replies

## Project Structure

```
├── index.js                 # Main application entry
├── routes/
│   ├── blog.js             # Blog routes and logic
│   ├── dashboard.js        # Admin dashboard routes
│   └── pool.js             # Database connection pool
├── views/
│   ├── blog/               # Blog page templates
│   ├── dashboard/          # Admin templates
│   ├── layouts/            # Layout templates
│   └── partial/            # Partial templates
├── public/
│   ├── Assets/             # Static assets
│   ├── robots.txt          # Search engine crawler rules
│   ├── sitemap.xml         # Generated sitemap index
│   ├── sitemap-posts.xml   # Generated posts sitemap
│   ├── sitemap-categories.xml # Generated categories sitemap
│   └── sitemap-tags.xml    # Generated tags sitemap
└── generate-sitemap.js     # Sitemap generation script

```

## Maintenance

**Important:** After adding, updating, or deleting blog posts, run the sitemap generation:
```bash
npm run generate-sitemap
```

This ensures search engines have the latest content information.

---

**Author:** Muhammad Bin Khalid  
**License:** Private  
**Website:** https://www.mbktechstudio.com
