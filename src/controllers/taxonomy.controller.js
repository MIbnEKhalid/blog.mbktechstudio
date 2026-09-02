import { pool } from '../config/db.js';

/**
 * 1. Categories Management Page
 */
export async function getCategories(req, res) {
    try {
        const [result, stats] = await Promise.all([
            pool.query(`
                SELECT c.*, COUNT(DISTINCT p.id) as post_count 
                FROM Categories c 
                LEFT JOIN Post_Categories pc ON c.id = pc.category_id
                LEFT JOIN Posts p ON pc.post_id = p.id
                GROUP BY c.id 
                ORDER BY c.name
            `),
            pool.query(`
                SELECT 
                    COUNT(*) as total_categories,
                    (SELECT COUNT(*) FROM posts) as total_posts
                FROM categories
            `)
        ]);

        const statsRow = stats.rows[0] || {};
        res.render('dashboard/categories.handlebars', {
            layout: 'dashboard',
            active: 'categories',
            categories: result.rows || [],
            stats: statsRow,
            totalCategories: statsRow.total_categories || 0,
            totalPosts: statsRow.total_posts || 0
        });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).render('error.handlebars', { message: 'Error fetching categories', code: 500 });
    }
}

/**
 * 2. API: Create Category
 */
export async function createCategory(req, res) {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, error: 'Category name is required' });

        const existing = await pool.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [name.trim()]);
        if (existing.rows?.length > 0) return res.status(400).json({ success: false, error: 'Category with this name already exists' });

        await pool.query('INSERT INTO categories (name, description) VALUES ($1, $2)', [name.trim(), description?.trim() || null]);
        res.json({ success: true, message: 'Category created successfully' });
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(err.code === '23505' ? 400 : 500).json({ success: false, error: err.code === '23505' ? 'Category with this name already exists' : 'Failed to create category' });
    }
}

/**
 * 3. API: Update Category
 */
export async function updateCategory(req, res) {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, error: 'Category name is required' });

        const existing = await pool.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2', [name.trim(), req.params.id]);
        if (existing.rows?.length > 0) return res.status(400).json({ success: false, error: 'Category with this name already exists' });

        const result = await pool.query('UPDATE categories SET name = $1, description = $2 WHERE id = $3', [name.trim(), description?.trim() || null, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Category not found' });

        res.json({ success: true, message: 'Category updated successfully' });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ success: false, error: 'Failed to update category' });
    }
}

/**
 * 4. API: Delete Category
 */
export async function deleteCategory(req, res) {
    const { id } = req.params;
    try {
        const postCount = await pool.query('SELECT COUNT(*) FROM Post_Categories WHERE category_id = $1', [id]);
        const count = parseInt(postCount.rows[0]?.count || 0);
        if (count > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete category. It is used by ${count} post(s). Please remove the category from all posts first.`
            });
        }

        const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Category not found' });
        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
}

/**
 * 5. Tags Management Page
 */
export async function getTags(req, res) {
    try {
        const [tags, stats] = await Promise.all([
            pool.query(`
                SELECT t.*, COUNT(pt.post_id) as post_count 
                FROM Tags t 
                LEFT JOIN Post_Tags pt ON t.id = pt.tag_id 
                GROUP BY t.id 
                ORDER BY t.name
            `),
            pool.query(`
                SELECT 
                    COUNT(*) as total_tags,
                    COUNT(DISTINCT pt.post_id) as posts_with_tags,
                    (SELECT COUNT(*) FROM posts) as total_posts
                FROM tags t
                LEFT JOIN post_tags pt ON t.id = pt.tag_id
            `)
        ]);

        const statsRow = stats.rows[0] || {};
        res.render('dashboard/tags.handlebars', {
            layout: 'dashboard',
            active: 'tags',
            tags: tags.rows || [],
            stats: statsRow,
            totalTags: statsRow.total_tags || 0,
            postsWithTags: statsRow.posts_with_tags || 0,
            totalPosts: statsRow.total_posts || 0
        });
    } catch (err) {
        console.error('Error fetching tags:', err);
        res.status(500).render('error.handlebars', { message: 'Error fetching tags', code: 500 });
    }
}

/**
 * 6. API: Create Tag
 */
export async function createTag(req, res) {
    try {
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, error: 'Tag name is required' });

        const normalized = name.toLowerCase().trim();
        const existing = await pool.query('SELECT id FROM tags WHERE name = $1', [normalized]);
        if (existing.rows?.length > 0) return res.status(400).json({ success: false, error: 'Tag already exists' });

        await pool.query('INSERT INTO tags (name) VALUES ($1)', [normalized]);
        res.json({ success: true, message: 'Tag created successfully' });
    } catch (err) {
        console.error('Error creating tag:', err);
        res.status(err.code === '23505' ? 400 : 500).json({ success: false, error: err.code === '23505' ? 'Tag already exists' : 'Failed to create tag' });
    }
}

/**
 * 7. API: Update Tag
 */
export async function updateTag(req, res) {
    try {
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ success: false, error: 'Tag name is required' });

        const normalized = name.toLowerCase().trim();
        const existing = await pool.query('SELECT id FROM tags WHERE name = $1 AND id != $2', [normalized, req.params.id]);
        if (existing.rows?.length > 0) return res.status(400).json({ success: false, error: 'Tag already exists' });

        const result = await pool.query('UPDATE tags SET name = $1 WHERE id = $2', [normalized, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Tag not found' });

        res.json({ success: true, message: 'Tag updated successfully' });
    } catch (err) {
        console.error('Error updating tag:', err);
        res.status(500).json({ success: false, error: 'Failed to update tag' });
    }
}

/**
 * 8. API: Delete Tag
 */
export async function deleteTag(req, res) {
    try {
        const postCount = await pool.query('SELECT COUNT(*) FROM Post_Tags WHERE tag_id = $1', [req.params.id]);
        const count = parseInt(postCount.rows[0]?.count || 0);

        if (count > 0) {
            await pool.query('DELETE FROM Post_Tags WHERE tag_id = $1', [req.params.id]);
        }

        const result = await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Tag not found' });

        res.json({
            success: true,
            message: count > 0 ? `Tag deleted successfully and removed from ${count} post(s)` : 'Tag deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting tag:', err);
        res.status(500).json({ success: false, error: 'Failed to delete tag' });
    }
}
