import express from "express";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { pool } from "./routes/pool.js";
import mbkauthe from "mbkauthe";
import { validateSessionAndRole } from "mbkauthe";
import { engine } from "express-handlebars";
import blogRouter from './routes/blog.js';
import dashboardRouter from './routes/dashboard.js';
import compression from "compression";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = express();
server.set('trust proxy', 1);

server.use(compression());

server.use("/Assets", express.static(path.join(__dirname, "public/Assets"), {
    maxAge: "7d",
    setHeaders: (res, path) => {
        if (path.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css");
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        if (
            path.endsWith(".js") ||
            path.endsWith(".css") ||
            path.endsWith(".png") ||
            path.endsWith(".jpg") ||
            path.endsWith(".svg")
        ) {
            res.setHeader("Cache-Control", "public, max-age=604800");
        } else {
            res.setHeader("Cache-Control", "public, max-age=86400");
        }
    },
})
);

// Serve static sitemaps from public directory
server.use("/", express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".xml")) {
            res.setHeader("Content-Type", "application/xml; charset=utf-8");
            res.setHeader("Cache-Control", "public, max-age=86400");
        }
    }
}));

server.use(express.json());
server.use(express.urlencoded({ extended: true }));


// Configure Handlebars (single setup)
server.engine("handlebars", engine({
  extname: ".handlebars",
  defaultLayout: "main",
  partialsDir: [
    path.join(__dirname, "views/templates"),
    path.join(__dirname, "views/templates/notice"),
    path.join(__dirname, "views"),
    path.join(__dirname, "node_modules/mbkauthe/views"),
  ],
  cache: process.env.NODE_ENV === "production",
    helpers: {
      formatDate: (date) => {
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    },
    in: function(value, list) {
      if (!list || !Array.isArray(list)) return false;
      return list.includes(parseInt(value) || value);
    },
    trim: function(str) {
      return str ? str.trim() : '';
    },
    split: function(value, separator) {
      // Return an array of category strings.
      // Accepts: an array, a JSON-encoded array string, or a comma-separated string.
      if (!value && value !== 0) return [];
      if (Array.isArray(value)) {
        return value.map(v => (typeof v === 'string' ? v.trim() : v)).filter(Boolean);
      }
      if (typeof value === 'string') {
        // Try JSON parse (e.g. "[\"a\",\"b\"]")
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map(v => (typeof v === 'string' ? v.trim() : v)).filter(Boolean);
          }
        } catch (e) {
          // not JSON, continue to split by separator
        }

        // Default separator: comma
        const sep = typeof separator === 'string' && separator.length > 0 ? separator : ',';
        // Build a safe regexp to split on the separator with optional surrounding whitespace
        const esc = sep.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const re = new RegExp('\\s*' + esc + '\\s*');
        return value.split(re).map(s => s.trim()).filter(Boolean);
      }
      // Fallback: return single value in array
      return [String(value)];
    },
    eq: function (a, b) {
      return a === b;
    },
    encodeURIComponent: function (str) {
      return encodeURIComponent(str);
    },
    formatTimestamp: function (timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    jsonStringify: function (context) {
      return JSON.stringify(context);
    },
    truncate: (str, len) => {
      if (!str) return '';
      if (str.length > len) {
        return str.substring(0, len) + '...';
      }
      return str;
    },
    stripMarkdown: (md) => {
      if (!md) return '';
      let s = String(md);
      // Remove code fences ``` ``` and their content
      s = s.replace(/```[\s\S]*?```/g, '');
      // Remove inline code `code`
      s = s.replace(/`([^`]*)`/g, '$1');
      // Remove images ![alt](url) -> alt
      s = s.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
      // Replace links [text](url) -> text
      s = s.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      // Remove headings #, ##, etc
      s = s.replace(/^#{1,6}\s*/gm, '');
      // Remove emphasis * and _ (bold/italic)
      s = s.replace(/\*\*(.*?)\*\*/g, '$1');
      s = s.replace(/\*(.*?)\*/g, '$1');
      s = s.replace(/__(.*?)__/g, '$1');
      s = s.replace(/_(.*?)_/g, '$1');
      // Remove blockquotes >
      s = s.replace(/^>\s?/gm, '');
      // Remove unordered list markers
      s = s.replace(/^[\s*-]+/gm, '');
      // Remove HTML tags
      s = s.replace(/<[^>]*>/g, '');
      // Collapse multiple newlines and spaces
      s = s.replace(/\n{2,}/g, '\n');
      s = s.replace(/[ \t]{2,}/g, ' ');
      return s.trim();
    },
    calculateReadingTime: (markdown) => {
      if (!markdown) return 0;
      // Remove markdown formatting and count words
      let text = String(markdown);
      text = text.replace(/[#*`[\]()]/g, '');
      // Count words (average 200 words per minute)
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      const readingTime = Math.ceil(wordCount / 200);
      return readingTime || 1; // Minimum 1 minute
    },
    formatReadingTime: (markdown) => {
      if (!markdown) return 'Less than 1 min read';
      let text = String(markdown);
      text = text.replace(/[#*`[\]()]/g, '');
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      const minutes = Math.ceil(wordCount / 200) || 1;
      if (minutes === 1) {
        return 'Less than 1 min read';
      }
      return `${minutes} min read`;
    },
    section: function(name, options) {
      if (!this._sections) this._sections = {};
      this._sections[name] = options.fn(this);
      return null;
    },
    getCanonicalUrl: function(req, path) {
      const protocol = req.protocol || 'https';
      const host = req.get('host') || 'blog.mbktechstudio.com';
      return `${protocol}://${host}${path}`;
    },
    index: function(array, idx) {
      return array ? array[idx] : null;
    },
    getCategory: function(categories, categoryId) {
      if (!categories || !Array.isArray(categories)) return '';
      const category = categories.find(c => c.id === categoryId);
      return category ? category.name : '';
    }
  }
}));

server.set("view engine", "handlebars");
server.set("views", [
  path.join(__dirname, "views"),
  path.join(__dirname, "node_modules/mbkauthe/views"),
]);

server.use(mbkauthe);
server.use(blogRouter);
server.use('/dashboard', dashboardRouter);

server.use((req, res) => {
  res.status(404).render('error.handlebars', { message: 'Page not found', code: 404 });
});

const port = process.env.PORT || 3065;
server.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default server;