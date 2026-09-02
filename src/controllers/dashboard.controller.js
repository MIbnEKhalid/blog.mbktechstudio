import { pool } from '../config/db.js';
import path from 'path';
import fs from 'fs';
import { PUBLIC_DIR } from '../config/constants.js';

/**
 * 1. Dashboard Overview (/dashboard)
 */
export async function getOverview(req, res) {
    try {
        const [postStats, commentStats, recentPosts, recentComments] = await Promise.all([
            pool.query(`
                SELECT 
                    COUNT(*) as total_posts,
                    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_posts,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_posts,
                    COUNT(CASE WHEN status = 'private' THEN 1 END) as private_posts
                FROM Posts
            `),
            pool.query(`
                SELECT 
                    COUNT(*) as total_comments,
                    COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_comments,
                    COUNT(CASE WHEN is_approved = false THEN 1 END) as pending_comments
                FROM Comments
            `),
            pool.query(`
                SELECT p.*, STRING_AGG(c.name, ', ') as categories
                FROM Posts p
                LEFT JOIN Post_Categories pc ON p.id = pc.post_id
                LEFT JOIN Categories c ON pc.category_id = c.id
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT c.*, p.title as post_title, p.slug as post_slug
                FROM Comments c
                LEFT JOIN Posts p ON c.post_id = p.id
                ORDER BY c.created_at DESC
                LIMIT 5
            `)
        ]);

        const postStatsRow = postStats.rows[0] || {};
        const commentStatsRow = commentStats.rows[0] || {};

        res.render('dashboard/index.handlebars', {
            layout: 'dashboard',
            active: 'dashboard',
            user: req.session?.user,
            stats: {
                totalPosts: postStatsRow.total_posts || 0,
                publishedPosts: postStatsRow.published_posts || 0,
                draftPosts: postStatsRow.draft_posts || 0,
                privatePosts: postStatsRow.private_posts || 0,
                totalComments: commentStatsRow.total_comments || 0,
                approvedComments: commentStatsRow.approved_comments || 0,
                pendingComments: commentStatsRow.pending_comments || 0
            },
            recentPosts: recentPosts.rows || [],
            recentComments: recentComments.rows || []
        });
    } catch (err) {
        console.error('Error loading dashboard overview:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading dashboard', code: 500 });
    }
}

/**
 * 2. Analytics Page (/dashboard/analytics)
 */
export async function getAnalytics(req, res) {
    try {
        const [overviewStats, topPosts, categoryDistribution, statusDistribution] = await Promise.all([
            pool.query(`
                SELECT 
                    COALESCE(SUM(views), 0) as total_views,
                    COALESCE(AVG(views), 0)::integer as avg_views,
                    COUNT(*) as total_posts,
                    (SELECT COUNT(*) FROM Comments) as total_comments
                FROM Posts
            `),
            pool.query(`
                SELECT p.id, p.title, p.slug, p.views, p.created_at, p.status,
                       (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
                       STRING_AGG(DISTINCT c.name, ', ') as categories
                FROM Posts p
                LEFT JOIN Post_Categories pc ON p.id = pc.post_id
                LEFT JOIN Categories c ON pc.category_id = c.id
                GROUP BY p.id
                ORDER BY p.views DESC, p.created_at DESC
                LIMIT 10
            `),
            pool.query(`
                SELECT c.name, COUNT(DISTINCT pc.post_id) as count, COALESCE(SUM(p.views), 0) as views
                FROM Categories c
                LEFT JOIN Post_Categories pc ON c.id = pc.category_id
                LEFT JOIN Posts p ON pc.post_id = p.id
                GROUP BY c.id
                ORDER BY count DESC
                LIMIT 6
            `),
            pool.query('SELECT status, COUNT(*) as count FROM Posts GROUP BY status')
        ]);

        const topPostViews = topPosts.rows[0]?.views || 1;
        const postsWithShare = (topPosts.rows || []).map(p => ({
            ...p,
            percentage: Math.round(((p.views || 0) / (topPostViews || 1)) * 100)
        }));

        res.render('dashboard/analytics.handlebars', {
            layout: 'dashboard',
            active: 'analytics',
            user: req.session?.user,
            overview: overviewStats.rows[0] || {},
            topPosts: postsWithShare,
            categoryDistribution: categoryDistribution.rows || [],
            statusDistribution: statusDistribution.rows || []
        });
    } catch (err) {
        console.error('Error loading analytics:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading analytics', code: 500 });
    }
}

/**
 * 3. SEO Management & Audit (/dashboard/seo)
 */
export async function getSeoOverview(req, res) {
    try {
        const posts = await pool.query(`
            SELECT id, title, slug, excerpt, content_markdown, preview_image, status, created_at
            FROM Posts
            ORDER BY created_at DESC
        `);

        let missingExcerpt = 0, missingPreviewImage = 0, shortTitles = 0, longTitles = 0, shortContent = 0;
        const postsWithIssues = [];

        (posts.rows || []).forEach(p => {
            const issues = [];
            if (!p.excerpt || p.excerpt.length < 30) { missingExcerpt++; issues.push('Missing or very short excerpt'); }
            if (!p.preview_image) { missingPreviewImage++; issues.push('Missing social preview image'); }
            if (p.title.length < 20) { shortTitles++; issues.push('Title is too short (< 20 chars)'); }
            if (p.title.length > 70) { longTitles++; issues.push('Title may be truncated in SERP (> 70 chars)'); }
            if (p.content_markdown && p.content_markdown.length < 300) { shortContent++; issues.push('Content is under 300 characters'); }

            if (issues.length > 0) postsWithIssues.push({ ...p, issues });
        });

        const totalPosts = posts.rows.length || 1;
        const healthyPostsCount = totalPosts - postsWithIssues.length;
        const seoHealthScore = Math.max(10, Math.round((healthyPostsCount / totalPosts) * 100));

        const sitemaps = ['sitemap.xml', 'sitemap-posts.xml', 'sitemap-categories.xml', 'sitemap-tags.xml'].map(name => ({
            name,
            path: path.join(PUBLIC_DIR, name),
            exists: fs.existsSync(path.join(PUBLIC_DIR, name))
        }));

        res.render('dashboard/seo.handlebars', {
            layout: 'dashboard',
            active: 'seo',
            user: req.session?.user,
            seoHealthScore,
            totalPosts: posts.rows.length,
            postsNeedingAttention: postsWithIssues.slice(0, 10),
            stats: { missingExcerpt, missingPreviewImage, shortTitles, longTitles, shortContent },
            sitemaps
        });
    } catch (err) {
        console.error('Error loading SEO page:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading SEO audit', code: 500 });
    }
}

/**
 * 4. API: Generate Sitemaps
 */
export async function generateSitemaps(req, res) {
    try {
        const BASE_URL = process.env.BASE_URL || 'https://blog.mbktech.org';
        const [postsRes, catsRes, tagsRes] = await Promise.all([
            pool.query("SELECT slug, created_at, updated_at FROM Posts WHERE status = 'published' ORDER BY updated_at DESC"),
            pool.query("SELECT DISTINCT c.name, MAX(p.updated_at) as last_updated FROM Categories c LEFT JOIN Post_Categories pc ON c.id = pc.category_id LEFT JOIN Posts p ON pc.post_id = p.id AND p.status = 'published' GROUP BY c.name ORDER BY last_updated DESC"),
            pool.query("SELECT DISTINCT t.name, MAX(p.updated_at) as last_updated FROM Tags t LEFT JOIN Post_Tags pt ON t.id = pt.tag_id LEFT JOIN Posts p ON pt.post_id = p.id AND p.status = 'published' GROUP BY t.name ORDER BY last_updated DESC")
        ]);

        const formatXmlUrl = (loc, date, freq, prio) => `    <url>\n        <loc>${loc}</loc>\n        <lastmod>${(date ? new Date(date) : new Date()).toISOString().split('T')[0]}</lastmod>\n        <changefreq>${freq}</changefreq>\n        <priority>${prio}</priority>\n    </url>`;

        const postUrls = (postsRes.rows || []).map(p => formatXmlUrl(`${BASE_URL}/post/${p.slug}`, p.updated_at || p.created_at, 'weekly', '0.8')).join('\n');
        fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-posts.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${postUrls}\n</urlset>`);

        const catUrls = (catsRes.rows || []).map(c => formatXmlUrl(`${BASE_URL}/category/${encodeURIComponent(c.name)}`, c.last_updated, 'weekly', '0.6')).join('\n');
        fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-categories.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${catUrls}\n</urlset>`);

        const tagUrls = (tagsRes.rows || []).map(t => formatXmlUrl(`${BASE_URL}/tag/${encodeURIComponent(t.name)}`, t.last_updated, 'weekly', '0.6')).join('\n');
        fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-tags.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${tagUrls}\n</urlset>`);

        const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    <sitemap>\n        <loc>${BASE_URL}/sitemap-posts.xml</loc>\n    </sitemap>\n    <sitemap>\n        <loc>${BASE_URL}/sitemap-categories.xml</loc>\n    </sitemap>\n    <sitemap>\n        <loc>${BASE_URL}/sitemap-tags.xml</loc>\n    </sitemap>\n</sitemapindex>`;
        fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapIndex);

        res.json({ success: true, message: `Successfully regenerated sitemaps (${postsRes.rows.length} posts indexed)` });
    } catch (err) {
        console.error('Error generating sitemaps:', err);
        res.status(500).json({ success: false, message: 'Failed to generate sitemaps: ' + err.message });
    }
}

/**
 * 5. Activity Logs (/dashboard/activity)
 */
export async function getActivityLogs(req, res) {
    try {
        const { entity, search, page = 1 } = req.query;
        const limit = 30;
        const pageNum = parseInt(page) || 1;
        const offset = (pageNum - 1) * limit;

        const params = [];
        const whereClauses = [];

        if (entity && entity !== 'all') {
            params.push(entity);
            whereClauses.push(`entity_type = $${params.length}`);
        }
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            whereClauses.push(`(action ILIKE $${params.length} OR entity_title ILIKE $${params.length} OR details ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [activityRes, countRes] = await Promise.all([
            pool.query(`SELECT * FROM Activity_Logs ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`).catch(() => ({ rows: [] })),
            pool.query(`SELECT COUNT(*) as total FROM Activity_Logs ${whereSql}`).catch(() => ({ rows: [{ total: 0 }] }))
        ]);

        const total = parseInt(countRes.rows[0]?.total || 0);
        const totalPages = Math.ceil(total / limit) || 1;

        res.render('dashboard/activity.handlebars', {
            layout: 'dashboard',
            active: 'activity',
            user: req.session?.user,
            activities: activityRes.rows || [],
            filters: { entity: entity || 'all', search: search || '' },
            pagination: {
                page: pageNum,
                totalPages,
                total,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
                nextPage: pageNum + 1,
                prevPage: pageNum - 1
            }
        });
    } catch (err) {
        console.error('Error loading activity logs:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading activity log', code: 500 });
    }
}

/**
 * 6. Settings Page (/dashboard/settings)
 */
export async function getSettings(req, res) {
    try {
        const [settingsRes, postCount, catCount, tagCount, commentCount] = await Promise.all([
            pool.query('SELECT * FROM Settings').catch(() => ({ rows: [] })),
            pool.query('SELECT COUNT(*) as count FROM Posts'),
            pool.query('SELECT COUNT(*) as count FROM Categories'),
            pool.query('SELECT COUNT(*) as count FROM Tags'),
            pool.query('SELECT COUNT(*) as count FROM Comments')
        ]);

        const settingsMap = {};
        (settingsRes.rows || []).forEach(row => { settingsMap[row.key] = row.value; });

        res.render('dashboard/settings.handlebars', {
            layout: 'dashboard',
            active: 'settings',
            user: req.session?.user,
            settings: settingsMap,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                uptimeSeconds: Math.floor(process.uptime()),
                memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
                dbConnected: true,
                storageType: 'Cloudflare R2 (mbkbucket)',
                counts: {
                    posts: postCount.rows[0]?.count || 0,
                    categories: catCount.rows[0]?.count || 0,
                    tags: tagCount.rows[0]?.count || 0,
                    comments: commentCount.rows[0]?.count || 0
                }
            }
        });
    } catch (err) {
        console.error('Error loading settings:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading settings', code: 500 });
    }
}

/**
 * 7. API: Save Settings
 */
export async function updateSettings(req, res) {
    try {
        for (const [key, value] of Object.entries(req.body || {})) {
            await pool.query(
                `INSERT INTO Settings (key, value, updated_at) VALUES ($1, $2, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, String(value)]
            );
        }
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
        console.error('Error saving settings:', err);
        res.status(500).json({ success: false, message: 'Failed to save settings' });
    }
}

/**
 * 8. API: Global Command Palette Search (/dashboard/api/global-search)
 */
export async function globalSearch(req, res) {
    try {
        const query = req.query.q?.trim() || '';
        if (query.length < 2) return res.json({ posts: [], categories: [], tags: [], comments: [] });

        const search = `%${query}%`;
        const [posts, categories, tags, comments] = await Promise.all([
            pool.query('SELECT id, title, slug, status, created_at FROM Posts WHERE title ILIKE $1 OR excerpt ILIKE $1 LIMIT 5', [search]),
            pool.query('SELECT id, name FROM Categories WHERE name ILIKE $1 LIMIT 4', [search]),
            pool.query('SELECT id, name FROM Tags WHERE name ILIKE $1 LIMIT 4', [search]),
            pool.query(`
                SELECT c.id, c.content, c."UserName", p.title as post_title 
                FROM Comments c 
                LEFT JOIN Posts p ON c.post_id = p.id 
                WHERE c.content ILIKE $1 OR c."UserName" ILIKE $1 
                LIMIT 4
            `, [search])
        ]);

        res.json({
            posts: posts.rows || [],
            categories: categories.rows || [],
            tags: tags.rows || [],
            comments: comments.rows || []
        });
    } catch (err) {
        console.error('Global search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
}

/**
 * 9. API: Backup & Data Export (/dashboard/api/download-all-data)
 */
export async function downloadAllData(req, res) {
    try {
        const [posts, categories, tags, comments, postCategories, postTags] = await Promise.all([
            pool.query('SELECT * FROM Posts'),
            pool.query('SELECT * FROM Categories'),
            pool.query('SELECT * FROM Tags'),
            pool.query('SELECT * FROM Comments'),
            pool.query('SELECT * FROM Post_Categories'),
            pool.query('SELECT * FROM Post_Tags')
        ]);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="blog_data.json"');
        res.send(JSON.stringify({
            posts: posts.rows,
            categories: categories.rows,
            tags: tags.rows,
            comments: comments.rows,
            postCategories: postCategories.rows,
            postTags: postTags.rows
        }, null, 2));
    } catch (err) {
        console.error('Error downloading data:', err);
        res.status(500).json({ success: false, error: 'Failed to download blog data' });
    }
}
