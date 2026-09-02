import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve root directory of the project (one level up from src)
export const ROOT_DIR = path.resolve(__dirname, '../../');
export const SRC_DIR = path.resolve(__dirname, '../');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const VIEWS_DIR = path.join(ROOT_DIR, 'views');

// Cache buster version from package.json
let cacheVersion = '1.0.0';
try {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  cacheVersion = packageJson.version || '1.0.0';
} catch (e) {
  console.warn('Could not read package.json version, fallback to 1.0.0');
}
export const CACHE_VERSION = cacheVersion;

// Blocked user agents (AI crawlers, scrapers)
export const BLOCKED_USER_AGENTS = [
  'GPTBot', 'Google-Extended', 'CCBot', 'anthropic-ai', 'Claude-Web',
  'ChatGPT-User', 'OpenAI', 'PerplexityBot', 'YouBot', 'Meta-ExternalAgent',
  'FacebookBot', 'Applebot', 'Bytespider', 'TikTok', 'MJ12bot',
  'AhrefsBot', 'SemrushBot', 'MauiBot', 'SiteAuditBot', 'ScreamingFrogSEOSpider',
  'Screaming Frog SEO Spider', 'DotBot', 'MegaIndex', 'SearchmetricsBot',
  'LinkpadBot', 'ZoominfoBot', 'bot', 'crawler', 'scraper', 'spider'
];
