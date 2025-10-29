import express from 'express';
import { pool } from './pool.js';
import slugify from 'slugify';
import { validateSessionAndRole } from 'mbkauthe';
import { marked } from 'marked';
import Prism from 'prismjs';

// Configure marked with syntax highlighting
marked.setOptions({
    highlight: function (code, lang) {
        if (Prism.languages[lang]) {
            return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
    },
    breaks: true,
    gfm: true
});

const router = express.Router();

// Get all published posts (and private posts for SuperAdmin)
router.get('/', async (req, res) => {
    try {
        let whereClause = "WHERE p.status = 'published'";

        // If user is SuperAdmin, also show private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            whereClause = "WHERE p.status IN ('published', 'private')";
        }

        const result = await pool.query(
            `SELECT p.*, 
            STRING_AGG(DISTINCT c.name, ', ') as categories,
            (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
            u."UserName"
            FROM Posts p
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            ${whereClause}
            GROUP BY p.id, u."UserName"
            ORDER BY p.created_at DESC`
        );
        res.render('blog/index.handlebars', {
            posts: result.rows,
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

// Get all categories with post counts
router.get('/categories', async (req, res) => {
    try {
        let statusFilter = "AND p.status = 'published'";

        // If user is SuperAdmin, also include private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            statusFilter = "AND p.status IN ('published', 'private')";
        }

        const result = await pool.query(`
            SELECT c.*,
                COUNT(DISTINCT pc.post_id) as post_count
            FROM Categories c
            LEFT JOIN Post_Categories pc ON c.id = pc.category_id
            LEFT JOIN Posts p ON pc.post_id = p.id ${statusFilter}
            WHERE p.id IS NOT NULL
            GROUP BY c.id
            ORDER BY c.name ASC
        `);

        res.render('blog/categories.handlebars', {
            categories: result.rows,
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/categories`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

// Get all tags with post counts
router.get('/tags', async (req, res) => {
    try {
        let statusFilter = "AND p.status = 'published'";

        // If user is SuperAdmin, also include private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            statusFilter = "AND p.status IN ('published', 'private')";
        }

        const result = await pool.query(`
            SELECT t.*,
                COUNT(DISTINCT pt.post_id) as post_count
            FROM Tags t
            LEFT JOIN Post_Tags pt ON t.id = pt.tag_id
            LEFT JOIN Posts p ON pt.post_id = p.id ${statusFilter}
            WHERE p.id IS NOT NULL
            GROUP BY t.id
            ORDER BY t.name ASC
        `);

        res.render('blog/tags.handlebars', {
            tags: result.rows,
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/tags`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});


// Get posts by author
router.get('/author/:username', async (req, res) => {
    try {
        const { username } = req.params;
        let whereClause = "WHERE p.status = 'published' AND p.\"UserName\" = $1";

        // If user is SuperAdmin, also show private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            whereClause = "WHERE p.status IN ('published', 'private') AND p.\"UserName\" = $1";
        }

        const result = await pool.query(
            `SELECT p.*, 
            STRING_AGG(DISTINCT c.name, ', ') as categories,
            COUNT(*) OVER (PARTITION BY p.id) as comment_count,
            u."UserName"
            FROM Posts p
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            ${whereClause}
            GROUP BY p.id, u."UserName"
            ORDER BY p.created_at DESC`,
            [username]
        );

        res.render('blog/filtered-posts.handlebars', {
            posts: result.rows,
            username: username,
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/author/${username}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

// Get posts by category
router.get('/category/:categoryName', async (req, res) => {
    try {
        const { categoryName } = req.params;
        const category = await pool.query(
            'SELECT * FROM Categories WHERE name = $1',
            [categoryName]
        );

        if (!category.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Category not found', code: 404 });
        }

        let whereClause = "WHERE p.status = 'published'";

        // If user is SuperAdmin, also show private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            whereClause = "WHERE p.status IN ('published', 'private')";
        }

        const result = await pool.query(
            `SELECT p.*, 
            STRING_AGG(DISTINCT c2.name, ', ') as categories,
            (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
            u."UserName"
            FROM Posts p
            INNER JOIN Post_Categories pc ON p.id = pc.post_id AND pc.category_id = $1
            LEFT JOIN Post_Categories pc2 ON p.id = pc2.post_id
            LEFT JOIN Categories c2 ON pc2.category_id = c2.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            ${whereClause}
            GROUP BY p.id, u."UserName"
            ORDER BY p.created_at DESC`,
            [category.rows[0].id]
        );

        res.render('blog/filtered-posts.handlebars', {
            posts: result.rows,
            category: category.rows[0],
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/category/${encodeURIComponent(category.rows[0].name)}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

// Get posts by tag
router.get('/tag/:tagName', async (req, res) => {
    try {
        const { tagName } = req.params;
        const tag = await pool.query(
            'SELECT * FROM Tags WHERE name = $1',
            [tagName]
        );

        if (!tag.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Tag not found', code: 404 });
        }

        let whereClause = "WHERE p.status = 'published'";

        // If user is SuperAdmin, also show private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            whereClause = "WHERE p.status IN ('published', 'private')";
        }

        const result = await pool.query(
            `SELECT p.*, 
            STRING_AGG(DISTINCT c.name, ', ') as categories,
            (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
            u."UserName",
            t.name as tag_name
            FROM Posts p
            INNER JOIN Post_Tags pt ON p.id = pt.post_id AND pt.tag_id = $1
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            LEFT JOIN Tags t ON pt.tag_id = t.id
            ${whereClause}
            GROUP BY p.id, u."UserName", t.id
            ORDER BY p.created_at DESC`,
            [tag.rows[0].id]
        );

        res.render('blog/filtered-posts.handlebars', {
            posts: result.rows,
            tag: tag.rows[0],
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/tag/${encodeURIComponent(tag.rows[0].name)}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

// Get single post by slug
router.get('/post/:slug', async (req, res) => {
    try {
        // Get post details with optimized query
        const post = await pool.query(
            `SELECT p.*, 
            STRING_AGG(DISTINCT c.name, ', ') as categories,
            u."UserName" as author_name,
            ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) as category_ids,
            ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as category_names
            FROM Posts p
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            WHERE p.slug = $1 AND p.status IN ('published', 'private')
            GROUP BY p.id, u."UserName"`,
            [req.params.slug]
        );

        if (!post.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Post not found', code: 404 });
        }

        // If post is private, only SuperAdmin can view it
        if (post.rows[0].status === 'private') {
            if (!req.session.user || req.session.user.role !== 'SuperAdmin') {
                return res.status(403).render('error.handlebars', { message: 'Access denied. Only SuperAdmin can view private posts.', code: 403 });
            }
        }

        // Process markdown content to HTML for display
        if (post.rows[0].content_markdown) {
            post.rows[0].content_html = marked(post.rows[0].content_markdown);
        } else {
            post.rows[0].content_html = post.rows[0].content || '';
        }

        // Get post tags with optimized query
        const tags = await pool.query(
            `SELECT t.name
            FROM Tags t
            INNER JOIN Post_Tags pt ON t.id = pt.tag_id
            WHERE pt.post_id = $1`,
            [post.rows[0].id]
        );

        post.rows[0].tags = tags.rows;

        let commentsQuery;
        const queryParams = [post.rows[0].id];

        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            commentsQuery = `
                SELECT c.id, c.content, c."UserName", c.created_at, c.parent_id, c.is_approved,
                u."UserName" as author_name,
                pc.content as parent_content, pu."UserName" as parent_author_name
                FROM Comments c
                LEFT JOIN "Users" u ON c."UserName" = u."UserName"
                LEFT JOIN Comments pc ON c.parent_id = pc.id
                LEFT JOIN "Users" pu ON pc."UserName" = pu."UserName"
                WHERE c.post_id = $1
                ORDER BY c.created_at DESC
            `;
        } else if (req.session.user) {
            commentsQuery = `
                SELECT c.id, c.content, c."UserName", c.created_at, c.parent_id, c.is_approved,
                u."UserName" as author_name,
                pc.content as parent_content, pu."UserName" as parent_author_name
                FROM Comments c
                LEFT JOIN "Users" u ON c."UserName" = u."UserName"
                LEFT JOIN Comments pc ON c.parent_id = pc.id
                LEFT JOIN "Users" pu ON pc."UserName" = pu."UserName"
                WHERE c.post_id = $1 AND (c.is_approved = true OR c."UserName" = $2)
                ORDER BY c.created_at DESC
            `;
            queryParams.push(req.session.user.username);
        } else {
            commentsQuery = `
                SELECT c.id, c.content, c."UserName", c.created_at, c.parent_id, c.is_approved,
                u."UserName" as author_name,
                pc.content as parent_content, pu."UserName" as parent_author_name
                FROM Comments c
                LEFT JOIN "Users" u ON c."UserName" = u."UserName"
                LEFT JOIN Comments pc ON c.parent_id = pc.id
                LEFT JOIN "Users" pu ON pc."UserName" = pu."UserName"
                WHERE c.post_id = $1 AND c.is_approved = true
                ORDER BY c.created_at DESC
            `;
        }

        const comments = await pool.query(commentsQuery, queryParams);

        comments.rows.forEach(comment => {
            comment.replyCount = comments.rows.filter(reply => reply.parent_id === comment.id).length;
        });

        const isLogin = !!req.session.user;

        res.render('blog/post.handlebars', {
            post: post.rows[0],
            comments: comments.rows,
            user: req.session.user,
            isLogin: isLogin,
            isSuperAdmin: req.session.user?.role === 'SuperAdmin',
            canonicalUrl: `${req.protocol}://${req.get('host')}/post/${req.params.slug}`,
            helpers: {
                getReplies: function (comments, parentId) {
                    return comments.filter(comment => comment.parent_id === parentId);
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

// Add comment to post (protected route)
router.post('/post/:slug/comment', validateSessionAndRole("any"), async (req, res) => {
    const { content, parent_id } = req.body;
    const { slug } = req.params;

    console.log('Session data for comment:', req.session);
    console.log('User data for comment:', req.session.user);

    // Validate required fields
    if (!content || !content.trim()) {
        return res.status(400).render('error.handlebars', { message: 'Comment content is required', code: 400 });
    }

    try {
        // Get post ID in one optimized query
        const post = await pool.query(
            'SELECT id FROM Posts WHERE slug = $1 AND status = $2',
            [slug, 'published']
        );

        if (!post.rows[0]) {
            return res.status(404).render('error.handlebars', { message: 'Post not found or not published', code: 404 });
        }

        const postId = post.rows[0].id;

        // If there's a parent_id, verify it exists and belongs to this post
        if (parent_id) {
            const parentComment = await pool.query(
                'SELECT id FROM Comments WHERE id = $1 AND post_id = $2',
                [parent_id, postId]
            );
            if (!parentComment.rows[0]) {
                return res.status(400).render('error.handlebars', { message: 'Invalid parent comment', code: 400 });
            }
        }

        const username = req.session.user.username;
        console.log('Using username for comment:', username);

        // Insert comment in one query
        await pool.query(
            `INSERT INTO Comments (content, "UserName", post_id, parent_id)
            VALUES ($1, $2, $3, $4)`,
            [content.trim(), username, postId, parent_id || null]
        );

        res.redirect('/post/' + slug);
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Error adding comment', code: 500 });
    }
});

// Get bookmarked posts (client-side data)
router.get('/bookmarks', async (req, res) => {
    try {
        // Get post IDs from query parameter (JSON array)
        let bookmarkIds = [];

        if (req.query.ids) {
            try {
                bookmarkIds = JSON.parse(req.query.ids);
                // Ensure it's an array of numbers
                if (!Array.isArray(bookmarkIds)) {
                    bookmarkIds = [];
                }
                bookmarkIds = bookmarkIds.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));
            } catch (e) {
                console.error('Error parsing bookmark IDs:', e);
                bookmarkIds = [];
            }
        }

        if (bookmarkIds.length === 0) {
            return res.render('blog/bookmarks.handlebars', {
                posts: [],
                user: req.session.user,
                canonicalUrl: `${req.protocol}://${req.get('host')}/bookmarks`
            });
        }

        let whereClause = "p.status = 'published' AND p.id = ANY($1::int[])";

        // If user is SuperAdmin, also show private posts
        if (req.session.user && req.session.user.role === 'SuperAdmin') {
            whereClause = "p.status IN ('published', 'private') AND p.id = ANY($1::int[])";
        }

        // Fetch posts by IDs
        const result = await pool.query(
            `SELECT p.*, 
            STRING_AGG(DISTINCT c.name, ', ') as categories,
            (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) as comment_count,
            u."UserName"
            FROM Posts p
            LEFT JOIN Post_Categories pc ON p.id = pc.post_id
            LEFT JOIN Categories c ON pc.category_id = c.id
            LEFT JOIN "Users" u ON p."UserName" = u."UserName"
            WHERE ${whereClause}
            GROUP BY p.id, u."UserName"
            ORDER BY p.created_at DESC`,
            [bookmarkIds]
        );

        res.render('blog/bookmarks.handlebars', {
            posts: result.rows,
            user: req.session.user,
            canonicalUrl: `${req.protocol}://${req.get('host')}/bookmarks`
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error.handlebars', { message: 'Server error', code: 500 });
    }
});

export default router;
