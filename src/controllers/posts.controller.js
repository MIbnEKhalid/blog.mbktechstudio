import { pool } from '../config/db.js';
import { logActivity } from '../utils/activityLogger.js';
import { generateSlug, parseArray } from '../utils/helpers.js';

// Helper to sync post categories within a transaction
async function syncPostCategories(client, postId, categories) {
    const catIds = parseArray(categories).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    const finalCatIds = catIds.length > 0 ? catIds : [1];
    for (const catId of finalCatIds) {
        await client.query('INSERT INTO Post_Categories (post_id, category_id) VALUES ($1, $2)', [postId, catId]);
    }
}

// Helper to sync post tags within a transaction
async function syncPostTags(client, postId, tags) {
    const tagArray = parseArray(tags);
    for (const tag of tagArray) {
        const name = String(tag).toLowerCase().trim();
        if (!name) continue;

        let tagRes = await client.query('SELECT id FROM Tags WHERE name = $1', [name]);
        if (tagRes.rows.length === 0) {
            tagRes = await client.query('INSERT INTO Tags (name) VALUES ($1) RETURNING id', [name]);
        }
        await client.query('INSERT INTO Post_Tags (post_id, tag_id) VALUES ($1, $2)', [postId, tagRes.rows[0].id]);
    }
}

/**
 * 1. Posts List Page
 */
export async function getPostsList(req, res) {
    try {
        const { status, category, search, sort = 'newest', page = 1 } = req.query;
        const limit = 20;
        const pageNum = parseInt(page) || 1;
        const offset = (pageNum - 1) * limit;

        const params = [];
        const whereClauses = [];

        if (status && status !== 'all') {
            params.push(status);
            whereClauses.push(`p.status = $${params.length}`);
        }

        if (category && category !== 'all') {
            params.push(category);
            whereClauses.push(`EXISTS (SELECT 1 FROM Post_Categories pc2 WHERE pc2.post_id = p.id AND (pc2.category_id::text = $${params.length} OR pc2.category_id IN (SELECT id FROM Categories WHERE name = $${params.length})))`);
        }

        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            whereClauses.push(`(p.title ILIKE $${params.length} OR p.excerpt ILIKE $${params.length} OR p.content_markdown ILIKE $${params.length})`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const orderMap = {
            oldest: 'p.created_at ASC',
            views_desc: 'p.views DESC, p.created_at DESC',
            title_asc: 'p.title ASC',
            updated: 'p.updated_at DESC'
        };
        const orderBy = orderMap[sort] || 'p.created_at DESC';

        const [postsResult, statsResult, categoriesResult] = await Promise.all([
            pool.query(`
                SELECT p.*, p."UserName" as author_name,
                       STRING_AGG(DISTINCT c.name, ', ') as categories
                FROM Posts p
                LEFT JOIN Post_Categories pc ON p.id = pc.post_id
                LEFT JOIN Categories c ON pc.category_id = c.id
                ${whereSql}
                GROUP BY p.id
                ORDER BY ${orderBy}
            `, params),
            pool.query(`
                SELECT 
                    COUNT(*) as total_posts,
                    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_posts,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_posts,
                    COUNT(CASE WHEN status = 'private' THEN 1 END) as private_posts,
                    (SELECT COUNT(*) FROM Categories) as total_categories
                FROM Posts
            `),
            pool.query('SELECT * FROM Categories ORDER BY name ASC')
        ]);

        const allPosts = postsResult.rows || [];
        const totalFiltered = allPosts.length;
        const paginatedPosts = allPosts.slice(offset, offset + limit);
        const totalPages = Math.ceil(totalFiltered / limit) || 1;
        const stats = statsResult.rows[0] || {};

        res.render('dashboard/posts.handlebars', {
            layout: 'dashboard',
            active: 'posts',
            posts: paginatedPosts,
            categories: categoriesResult.rows || [],
            stats,
            totalPosts: stats.total_posts || 0,
            publishedPosts: stats.published_posts || 0,
            draftPosts: stats.draft_posts || 0,
            privatePosts: stats.private_posts || 0,
            totalCategories: stats.total_categories || 0,
            filters: { status: status || 'all', category: category || 'all', search: search || '', sort },
            pagination: {
                page: pageNum,
                totalPages,
                totalPosts: totalFiltered,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
                nextPage: pageNum + 1,
                prevPage: pageNum - 1
            }
        });
    } catch (err) {
        console.error('Error fetching posts:', err);
        res.status(500).render('error.handlebars', { message: 'Error fetching posts', code: 500 });
    }
}

/**
 * 2. Create Post Form Page
 */
export async function getCreatePost(req, res) {
    try {
        const [categories, availableTags] = await Promise.all([
            pool.query('SELECT * FROM Categories ORDER BY name ASC'),
            pool.query('SELECT * FROM Tags ORDER BY name ASC')
        ]);

        res.render('dashboard/edit-post.handlebars', {
            layout: 'dashboard',
            active: 'posts',
            isNew: true,
            categories: categories.rows || [],
            availableTags: availableTags.rows || [],
            post: { status: 'draft', categoryIds: [], tags: [] }
        });
    } catch (err) {
        console.error('Error loading create post form:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading create post form', code: 500 });
    }
}

/**
 * 3. Edit Post Form Page
 */
export async function getEditPost(req, res) {
    try {
        const { id } = req.params;
        const [post, categories, postCategories, postTags, availableTags] = await Promise.all([
            pool.query('SELECT * FROM Posts WHERE id = $1', [id]),
            pool.query('SELECT * FROM Categories ORDER BY name ASC'),
            pool.query('SELECT c.id, c.name FROM Categories c JOIN Post_Categories pc ON c.id = pc.category_id WHERE pc.post_id = $1', [id]),
            pool.query('SELECT t.name FROM Tags t JOIN Post_Tags pt ON t.id = pt.tag_id WHERE pt.post_id = $1', [id]),
            pool.query('SELECT * FROM Tags ORDER BY name ASC')
        ]);

        if (!post.rows?.[0]) {
            return res.status(404).render('error.handlebars', { message: 'Post not found', code: 404 });
        }

        const postData = post.rows[0];
        postData.tags = (postTags.rows || []).map(t => t.name);
        postData.categoryIds = (postCategories.rows || []).map(c => c.id);

        res.render('dashboard/edit-post.handlebars', {
            layout: 'dashboard',
            active: 'posts',
            isNew: false,
            post: postData,
            categories: categories.rows || [],
            availableTags: availableTags.rows || [],
            isPublished: postData.status === 'published',
            isPrivate: postData.status === 'private'
        });
    } catch (err) {
        console.error('Error loading edit post form:', err);
        res.status(500).render('error.handlebars', { message: 'Error loading edit post form', code: 500 });
    }
}

/**
 * 4. API: Create Post
 */
export async function createPost(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { title, content, excerpt, categories, tags, status, preview_image, slug: customSlug } = req.body;

        if (!title || !content) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Title and content are required' });
        }

        const slug = (customSlug && customSlug.trim()) ? generateSlug(customSlug) : generateSlug(title);
        const username = req.session?.user?.username || req.session?.user?.UserName || 'testadmin';
        const postStatus = status || 'draft';

        const postResult = await client.query(
            'INSERT INTO Posts (title, slug, excerpt, content_markdown, status, preview_image, "UserName") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [title, slug, excerpt || null, content, postStatus, preview_image || null, username]
        );

        const newPostId = postResult.rows[0].id;
        await syncPostCategories(client, newPostId, categories);
        await syncPostTags(client, newPostId, tags);
        await client.query('COMMIT');

        logActivity({ action: 'Created Post', entityType: 'post', entityId: newPostId, entityTitle: title, username });
        res.json({ success: true, id: newPostId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating post:', err);
        res.status(500).json({ success: false, error: 'Failed to create post' });
    } finally {
        client.release();
    }
}

/**
 * 5. API: Update Post
 */
export async function updatePost(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { title, content, excerpt, categories, tags, status, preview_image, slug: customSlug } = req.body;

        if (!title || !content) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Title and content are required' });
        }

        const slug = (customSlug && customSlug.trim()) ? generateSlug(customSlug) : generateSlug(title);
        const postStatus = status || 'draft';

        await client.query(
            'UPDATE Posts SET title = $1, slug = $2, excerpt = $3, content_markdown = $4, status = $5, preview_image = $6, updated_at = NOW() WHERE id = $7',
            [title, slug, excerpt || null, content, postStatus, preview_image || null, id]
        );

        await client.query('DELETE FROM Post_Categories WHERE post_id = $1', [id]);
        await syncPostCategories(client, id, categories);

        await client.query('DELETE FROM Post_Tags WHERE post_id = $1', [id]);
        await syncPostTags(client, id, tags);

        await client.query('COMMIT');
        logActivity({ action: 'Updated Post', entityType: 'post', entityId: parseInt(id), entityTitle: title, username: req.session?.user?.username || 'admin' });
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating post:', err);
        res.status(500).json({ success: false, error: 'Failed to update post' });
    } finally {
        client.release();
    }
}

/**
 * 6. API: Quick Update Post
 */
export async function quickUpdatePost(req, res) {
    try {
        const { id } = req.params;
        const { title, slug, status, categoryId } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const cleanSlug = slug && slug.trim() ? generateSlug(slug) : generateSlug(title);
        await pool.query(
            'UPDATE Posts SET title = $1, slug = $2, status = $3, published = $4, updated_at = NOW() WHERE id = $5',
            [title.trim(), cleanSlug, status || 'draft', status === 'published', id]
        );

        if (categoryId) {
            await pool.query('DELETE FROM Post_Categories WHERE post_id = $1', [id]);
            await pool.query('INSERT INTO Post_Categories (post_id, category_id) VALUES ($1, $2)', [id, parseInt(categoryId)]);
        }

        res.json({ success: true, message: 'Post updated successfully' });
    } catch (err) {
        console.error('Error quick editing post:', err);
        res.status(500).json({ success: false, message: 'Failed to quick edit post' });
    }
}

/**
 * 7. API: Duplicate Post
 */
export async function duplicatePost(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;

        const postResult = await client.query('SELECT * FROM Posts WHERE id = $1', [id]);
        if (!postResult.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const orig = postResult.rows[0];
        const newTitle = `${orig.title} (Copy)`;
        const newSlug = `${orig.slug}-copy-${Date.now().toString().slice(-4)}`;

        const newPost = await client.query(
            `INSERT INTO Posts (title, slug, excerpt, content_markdown, status, published, preview_image, "UserName", created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'draft', false, $5, $6, NOW(), NOW()) RETURNING id`,
            [newTitle, newSlug, orig.excerpt, orig.content_markdown, orig.preview_image, req.session?.user?.username || 'admin']
        );

        const newId = newPost.rows[0].id;
        await client.query('INSERT INTO Post_Categories (post_id, category_id) SELECT $1, category_id FROM Post_Categories WHERE post_id = $2', [newId, id]);
        await client.query('INSERT INTO Post_Tags (post_id, tag_id) SELECT $1, tag_id FROM Post_Tags WHERE post_id = $2', [newId, id]);

        await client.query('COMMIT');
        res.json({ success: true, id: newId, message: 'Post duplicated as draft' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error duplicating post:', err);
        res.status(500).json({ success: false, message: 'Failed to duplicate post' });
    } finally {
        client.release();
    }
}

/**
 * 8. API: Bulk Posts Action
 */
export async function bulkPostsAction(req, res) {
    const { action, postIds } = req.body;
    if (!Array.isArray(postIds) || postIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No posts selected' });
    }

    const ids = postIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (action === 'publish') {
            await client.query("UPDATE Posts SET status = 'published', published = true, updated_at = NOW() WHERE id = ANY($1)", [ids]);
        } else if (action === 'draft') {
            await client.query("UPDATE Posts SET status = 'draft', published = false, updated_at = NOW() WHERE id = ANY($1)", [ids]);
        } else if (action === 'private') {
            await client.query("UPDATE Posts SET status = 'private', published = false, updated_at = NOW() WHERE id = ANY($1)", [ids]);
        } else if (action === 'delete') {
            await client.query('DELETE FROM Comments WHERE post_id = ANY($1)', [ids]);
            await client.query('DELETE FROM Post_Categories WHERE post_id = ANY($1)', [ids]);
            await client.query('DELETE FROM Post_Tags WHERE post_id = ANY($1)', [ids]);
            await client.query('DELETE FROM Posts WHERE id = ANY($1)', [ids]);
        }
        await client.query('COMMIT');
        res.json({ success: true, message: `Successfully updated ${ids.length} post(s)` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in bulk action:', err);
        res.status(500).json({ success: false, message: 'Failed to perform bulk action' });
    } finally {
        client.release();
    }
}

/**
 * 9. API: Delete Post
 */
export async function deletePost(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;

        const check = await client.query('SELECT id FROM Posts WHERE id = $1', [id]);
        if (!check.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Post not found' });
        }

        await client.query('DELETE FROM Comments WHERE post_id = $1', [id]);
        await client.query('DELETE FROM Post_Tags WHERE post_id = $1', [id]);
        await client.query('DELETE FROM Post_Categories WHERE post_id = $1', [id]);
        await client.query('DELETE FROM Posts WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting post:', err);
        res.status(500).json({ success: false, error: 'Failed to delete post' });
    } finally {
        client.release();
    }
}
