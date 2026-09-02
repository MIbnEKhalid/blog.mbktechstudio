import { pool } from '../config/db.js';
import { marked } from 'marked';
import Prism from 'prismjs';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { downloadFile } from 'mbkbucket';
import fs from 'fs';
import path from 'path';
import { PUBLIC_DIR } from '../config/constants.js';

marked.setOptions({
    highlight: (code, lang) => Prism.languages[lang] ? Prism.highlight(code, Prism.languages[lang], lang) : code,
    breaks: true,
    gfm: true
});

const purify = DOMPurify(new JSDOM('').window);
const PAGE_LIMIT = 10;
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const ALLOWED_REFERRERS = ['mbktech.org', 'localhost'];

// Single unified helpers for role and post visibility checks
const isSuperAdmin = (req) => Boolean(req?.session?.user?.role === 'SuperAdmin');
const getStatusSql = (req) => isSuperAdmin(req) ? "IN ('published', 'private')" : "= 'published'";

// Helper to extract unique authors and categories in a single pass
function extractUniqueMeta(posts) {
    const authors = new Set();
    const categories = new Set();
    for (const post of posts) {
        if (post.UserName) authors.add(post.UserName);
        if (post.categories) {
            for (const cat of post.categories.split(',')) {
                const trimmed = cat.trim();
                if (trimmed) categories.add(trimmed);
            }
        }
    }
    return {
        uniqueAuthors: Array.from(authors).sort(),
        uniqueCategories: Array.from(categories).sort()
    };
}

// Unified post fetcher for listing routes
async function fetchPostList({ whereClause, joinClause = '', params = [], limit = PAGE_LIMIT, offset = 0 }) {
    const [countRes, postsRes] = await Promise.all([
        pool.query(`SELECT COUNT(DISTINCT p.id) as total FROM Posts p ${joinClause} ${whereClause}`, params),
        pool.query(`
            SELECT p.*, 
                   STRING_AGG(DISTINCT c.name, ', ') as categories,
                   (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
                   u."UserName",
                   u."Image" as author_image
            FROM Posts p
            ${joinClause}
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            ${whereClause}
            GROUP BY p.id, u."UserName", u."Image"
            ORDER BY p.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, limit, offset])
    ]);

    const totalPosts = parseInt(countRes.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalPosts / limit) || 1;
    return { posts: postsRes.rows || [], totalPosts, totalPages };
}

/**
 * 1. Home / All Posts
 */
export async function getHome(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * PAGE_LIMIT;
        const whereClause = `WHERE p.status ${getStatusSql(req)}`;

        const { posts, totalPosts, totalPages } = await fetchPostList({ whereClause, offset });
        const { uniqueAuthors, uniqueCategories } = extractUniqueMeta(posts);

        res.render('blog/index.handlebars', {
            posts,
            uniqueAuthors,
            uniqueCategories,
            canonicalUrl: `${req.protocol}://${req.get('host')}/`,
            pagination: { page, totalPages, totalPosts, hasNext: page < totalPages, hasPrev: page > 1 }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 2. Categories Archive
 */
export async function getCategoriesArchive(req, res) {
    try {
        const statusFilter = `AND p.status ${getStatusSql(req)}`;

        const result = await pool.query(`
            SELECT c.*, COUNT(DISTINCT pc.post_id) as post_count
            FROM Categories c
            LEFT JOIN Post_Categories pc ON c.id = pc.category_id
            LEFT JOIN Posts p ON pc.post_id = p.id ${statusFilter}
            WHERE p.id IS NOT NULL
            GROUP BY c.id
            ORDER BY c.name ASC
        `);

        res.render('blog/archive.handlebars', {
            categories: result.rows || [],
            canonicalUrl: `${req.protocol}://${req.get('host')}/categories`,
            pageType: 'categories'
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 3. Tags Archive
 */
export async function getTagsArchive(req, res) {
    try {
        const statusFilter = `AND p.status ${getStatusSql(req)}`;

        const result = await pool.query(`
            SELECT t.*, COUNT(DISTINCT pt.post_id) as post_count
            FROM Tags t
            LEFT JOIN Post_Tags pt ON t.id = pt.tag_id
            LEFT JOIN Posts p ON pt.post_id = p.id ${statusFilter}
            WHERE p.id IS NOT NULL
            GROUP BY t.id
            ORDER BY t.name ASC
        `);

        res.render('blog/archive.handlebars', {
            tags: result.rows || [],
            canonicalUrl: `${req.protocol}://${req.get('host')}/tags`,
            pageType: 'tags'
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 4. Posts by Author
 */
export async function getPostsByAuthor(req, res) {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * PAGE_LIMIT;
        const whereClause = `WHERE p.status ${getStatusSql(req)} AND p."UserName" = $1`;

        const { posts, totalPosts, totalPages } = await fetchPostList({ whereClause, params: [username], offset });
        const { uniqueCategories } = extractUniqueMeta(posts);

        res.render('blog/archive.handlebars', {
            posts,
            username,
            uniqueCategories,
            canonicalUrl: `${req.protocol}://${req.get('host')}/author/${username}`,
            pageType: 'posts',
            pagination: { page, totalPages, totalPosts, hasNext: page < totalPages, hasPrev: page > 1, baseUrl: `/author/${username}` }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 5. Posts by Category
 */
export async function getPostsByCategory(req, res) {
    try {
        const { categoryName } = req.params;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * PAGE_LIMIT;

        const category = await pool.query('SELECT * FROM Categories WHERE name = $1', [categoryName]);
        if (!category.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Category not found', code: 404 });
        }

        const joinClause = 'INNER JOIN Post_Categories filter_pc ON p.id = filter_pc.post_id AND filter_pc.category_id = $1';
        const whereClause = `WHERE p.status ${getStatusSql(req)}`;

        const { posts, totalPosts, totalPages } = await fetchPostList({
            whereClause,
            joinClause,
            params: [category.rows[0].id],
            offset
        });
        const { uniqueAuthors } = extractUniqueMeta(posts);

        res.render('blog/archive.handlebars', {
            posts,
            category: category.rows[0],
            uniqueAuthors,
            canonicalUrl: `${req.protocol}://${req.get('host')}/category/${encodeURIComponent(category.rows[0].name)}`,
            pageType: 'posts',
            pagination: { page, totalPages, totalPosts, hasNext: page < totalPages, hasPrev: page > 1, baseUrl: `/category/${encodeURIComponent(categoryName)}` }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 6. Posts by Tag
 */
export async function getPostsByTag(req, res) {
    try {
        const { tagName } = req.params;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * PAGE_LIMIT;

        const tag = await pool.query('SELECT * FROM Tags WHERE name = $1', [tagName]);
        if (!tag.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Tag not found', code: 404 });
        }

        const joinClause = 'INNER JOIN Post_Tags filter_pt ON p.id = filter_pt.post_id AND filter_pt.tag_id = $1';
        const whereClause = `WHERE p.status ${getStatusSql(req)}`;

        const { posts, totalPosts, totalPages } = await fetchPostList({
            whereClause,
            joinClause,
            params: [tag.rows[0].id],
            offset
        });
        const { uniqueAuthors, uniqueCategories } = extractUniqueMeta(posts);

        res.render('blog/archive.handlebars', {
            posts,
            tag: tag.rows[0],
            uniqueAuthors,
            uniqueCategories,
            canonicalUrl: `${req.protocol}://${req.get('host')}/tag/${encodeURIComponent(tag.rows[0].name)}`,
            pageType: 'posts',
            pagination: { page, totalPages, totalPosts, hasNext: page < totalPages, hasPrev: page > 1, baseUrl: `/tag/${encodeURIComponent(tagName)}` }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 7. Single Post by Slug
 */
export async function getPostBySlug(req, res) {
    try {
        const { slug } = req.params;
        const cachedDataPath = path.join(PUBLIC_DIR, 'posts', `${slug}.json`);

        if (fs.existsSync(cachedDataPath)) {
            try {
                const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf-8'));
                return res.render('blog/post.handlebars', {
                    post: cachedData.post,
                    comments: cachedData.comments,
                    canonicalUrl: `${req.protocol}://${req.get('host')}/post/${slug}`,
                    helpers: { getReplies: (comments, parentId) => comments.filter(c => c.parent_id === parentId) }
                });
            } catch (cacheErr) {
                console.error('Error reading cached post data:', cacheErr);
            }
        }

        const postResult = await pool.query(`
            SELECT p.*, 
                   STRING_AGG(DISTINCT c.name, ', ') as categories,
                   u."UserName" as author_name,
                   u."Image" as author_image,
                   ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) as category_ids,
                   ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as category_names
            FROM Posts p
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            WHERE p.slug = $1 AND p.status IN ('published', 'private')
            GROUP BY p.id, u."UserName", u."Image"
        `, [slug]);

        const post = postResult.rows[0];
        if (!post) {
            return res.status(404).render('error.handlebars', { message: 'Post not found', code: 404 });
        }

        const user = req.session?.user;
        const isAdmin = isSuperAdmin(req);
        const isOwner = user && user.username === post.author_name;

        if (post.status === 'private' && !isOwner && !isAdmin) {
            return res.status(403).render('error.handlebars', { message: 'This post is private. Only the owner can see it.', code: 403 });
        }

        // View count debounce via cookie
        const postId = String(post.id);
        let viewedPosts = [];
        try {
            if (req.cookies.viewed_posts) viewedPosts = JSON.parse(req.cookies.viewed_posts);
            if (!Array.isArray(viewedPosts)) viewedPosts = [];
        } catch {}

        if (!viewedPosts.includes(postId)) {
            viewedPosts.push(postId);
            if (viewedPosts.length > 200) viewedPosts.shift();

            res.cookie('viewed_posts', JSON.stringify(viewedPosts), {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production'
            });

            res.on('finish', () => {
                pool.query('UPDATE Posts SET views = views + 1 WHERE id = $1', [postId]).catch(console.error);
            });
        }

        // Markdown rendering
        post.content_html = post.content_markdown
            ? purify.sanitize(marked(post.content_markdown))
            : (post.content || '');

        // Fetch tags, comments, and related posts in parallel
        const commentsWhere = isAdmin
            ? 'WHERE c.post_id = $1'
            : (user ? 'WHERE c.post_id = $1 AND (c.is_approved = true OR c."UserName" = $2)' : 'WHERE c.post_id = $1 AND c.is_approved = true');
        const commentsParams = (user && !isAdmin) ? [post.id, user.username] : [post.id];

        const categoryIds = (post.category_ids || []).filter(Boolean);
        const relatedQuery = categoryIds.length > 0
            ? pool.query(`
                SELECT DISTINCT p.id, p.title, p.slug, p.preview_image, p.created_at, p.content_markdown,
                       u."UserName",
                       u."Image" as author_image,
                       STRING_AGG(DISTINCT c.name, ', ') as categories
                FROM Posts p
                LEFT JOIN "Users" u ON p."UserName" = u."UserName"
                LEFT JOIN Post_Categories pc ON p.id = pc.post_id
                LEFT JOIN Categories c ON pc.category_id = c.id
                WHERE p.id != $1 AND p.status = 'published' AND pc.category_id = ANY($2::int[])
                GROUP BY p.id, u."UserName", u."Image"
                ORDER BY p.created_at DESC
                LIMIT 3
            `, [post.id, categoryIds])
            : pool.query(`
                SELECT DISTINCT p.id, p.title, p.slug, p.preview_image, p.created_at, p.content_markdown,
                       u."UserName",
                       u."Image" as author_image,
                       STRING_AGG(DISTINCT c.name, ', ') as categories
                FROM Posts p
                LEFT JOIN "Users" u ON p."UserName" = u."UserName"
                LEFT JOIN Post_Categories pc ON p.id = pc.post_id
                LEFT JOIN Categories c ON pc.category_id = c.id
                WHERE p.id != $1 AND p.status = 'published'
                GROUP BY p.id, u."UserName", u."Image"
                ORDER BY p.created_at DESC
                LIMIT 3
            `, [post.id]);

        const [tagsResult, commentsResult, relatedResult] = await Promise.all([
            pool.query('SELECT t.name FROM Tags t INNER JOIN Post_Tags pt ON t.id = pt.tag_id WHERE pt.post_id = $1', [post.id]),
            pool.query(`
                SELECT c.id, c.content, c."UserName", c.created_at, c.parent_id, c.is_approved,
                       u."UserName" as author_name,
                       u."Image" as author_image,
                       pc.content as parent_content, pu."UserName" as parent_author_name,
                       pu."Image" as parent_author_image
                FROM Comments c
                LEFT JOIN "Users" u ON c."UserName" = u."UserName"
                LEFT JOIN Comments pc ON c.parent_id = pc.id
                LEFT JOIN "Users" pu ON pc."UserName" = pu."UserName"
                ${commentsWhere}
                ORDER BY c.created_at DESC
            `, commentsParams),
            relatedQuery.catch(err => {
                console.error('Error querying related posts:', err);
                return { rows: [] };
            })
        ]);

        post.tags = tagsResult.rows || [];
        const comments = commentsResult.rows || [];

        for (const comment of comments) {
            comment.replyCount = comments.filter(r => r.parent_id === comment.id).length;
            comment.content = purify.sanitize(comment.content);
            if (comment.parent_content) comment.parent_content = purify.sanitize(comment.parent_content);
        }

        res.render('blog/post.handlebars', {
            post,
            comments,
            relatedPosts: relatedResult.rows || [],
            canonicalUrl: `${req.protocol}://${req.get('host')}/post/${slug}`,
            helpers: { getReplies: (cmts, pId) => cmts.filter(c => c.parent_id === pId) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 8. Add Comment
 */
export async function createComment(req, res) {
    const { content, parent_id } = req.body;
    const { slug } = req.params;

    if (!content || !content.trim()) {
        return res.status(400).render('error.handlebars', { message: 'Comment content is required', code: 400 });
    }

    try {
        const post = await pool.query('SELECT id FROM Posts WHERE slug = $1 AND status = $2', [slug, 'published']);
        if (!post.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Post not found or not published', code: 404 });
        }

        const postId = post.rows[0].id;
        if (parent_id) {
            const parent = await pool.query('SELECT id FROM Comments WHERE id = $1 AND post_id = $2', [parent_id, postId]);
            if (!parent.rows[0]) {
                return res.status(400).render('error.handlebars', { message: 'Invalid parent comment', code: 400 });
            }
        }

        await pool.query(
            'INSERT INTO Comments (content, "UserName", post_id, parent_id) VALUES ($1, $2, $3, $4)',
            [purify.sanitize(content.trim()), req.session.user.username, postId, parent_id || null]
        );

        res.redirect(`/post/${slug}`);
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Error adding comment', code: 500 });
    }
}

/**
 * 9. Bookmarks
 */
export async function getBookmarks(req, res) {
    try {
        let bookmarkIds = [];
        if (req.query.ids) {
            try {
                const parsed = JSON.parse(req.query.ids);
                if (Array.isArray(parsed)) {
                    bookmarkIds = parsed.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                }
            } catch {}
        }

        if (bookmarkIds.length === 0) {
            return res.render('blog/bookmarks.handlebars', {
                posts: [],
                canonicalUrl: `${req.protocol}://${req.get('host')}/bookmarks`
            });
        }

        const whereClause = `WHERE p.status ${getStatusSql(req)} AND p.id = ANY($1::int[])`;

        const result = await pool.query(`
            SELECT p.*, 
                   STRING_AGG(DISTINCT c.name, ', ') as categories,
                   (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
                   u."UserName",
                   u."Image" as author_image
            FROM Posts p
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            ${whereClause}
            GROUP BY p.id, u."UserName", u."Image"
            ORDER BY p.created_at DESC
        `, [bookmarkIds]);

        res.render('blog/bookmarks.handlebars', {
            posts: result.rows || [],
            canonicalUrl: `${req.protocol}://${req.get('host')}/bookmarks`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
}

/**
 * 10. Public High-Performance Image Streaming
 */
export async function streamImage(req, res) {
    const referer = req.get('Referer');
    if (referer && !ALLOWED_REFERRERS.some(domain => referer.includes(domain))) {
        return res.status(403).send('Hotlinking not allowed');
    }

    try {
        const { key } = req.params;
        if (!key) return res.status(400).send('Image key is required');

        const ext = path.extname(key).toLowerCase();
        if (!ALLOWED_IMAGE_EXTS.has(ext)) {
            return res.status(400).send('Only image files are allowed');
        }

        const result = await downloadFile(key);

        res.set({
            'Content-Type': result.ContentType || 'image/jpeg',
            'Content-Length': result.ContentLength,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Last-Modified': result.LastModified,
            'ETag': result.ETag,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET'
        });

        // Fast conditional 304 response
        if (req.headers['if-none-match'] && req.headers['if-none-match'] === result.ETag) {
            return res.status(304).end();
        }
        if (req.headers['if-modified-since'] && result.LastModified) {
            if (new Date(result.LastModified) <= new Date(req.headers['if-modified-since'])) {
                return res.status(304).end();
            }
        }

        // Direct stream piping - avoids large RAM allocations
        if (typeof result.Body?.pipe === 'function') {
            result.Body.pipe(res);
        } else if (result.Body?.[Symbol.asyncIterator]) {
            for await (const chunk of result.Body) {
                res.write(chunk);
            }
            res.end();
        } else {
            res.send(result.Body);
        }
    } catch (err) {
        if (err.message?.includes('File not found')) {
            res.status(404).send('Image not found');
        } else if (err.message?.includes('Access denied')) {
            res.status(403).send('Access denied');
        } else {
            res.status(500).send('Failed to load image');
        }
    }
}
