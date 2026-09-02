import { pool } from '../config/db.js';

/**
 * 1. Comments Moderation Page
 */
export async function getCommentsList(req, res) {
    try {
        const [comments, stats] = await Promise.all([
            pool.query(`
                SELECT c.*, p.title as post_title, p.slug as post_slug 
                FROM comments c 
                LEFT JOIN posts p ON c.post_id = p.id 
                ORDER BY c.created_at DESC
            `),
            pool.query(`
                SELECT 
                    COUNT(*) as total_comments,
                    COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_comments,
                    COUNT(CASE WHEN is_approved = false THEN 1 END) as pending_comments
                FROM comments
            `)
        ]);

        const statsRow = stats.rows[0] || {};
        res.render('dashboard/comments.handlebars', {
            layout: 'dashboard',
            active: 'comments',
            comments: comments.rows || [],
            stats: statsRow,
            totalComments: statsRow.total_comments || 0,
            approvedComments: statsRow.approved_comments || 0,
            pendingComments: statsRow.pending_comments || 0,
            filters: { status: 'all', search: '' },
            pagination: { page: 1, totalPages: 1 }
        });
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).render('error.handlebars', { message: 'Error fetching comments', code: 500 });
    }
}

/**
 * 2. API: Moderate Comment (Approve / Unapprove)
 */
export async function moderateComment(req, res) {
    const { id, action } = req.params;
    if (!['approve', 'unapprove'].includes(action)) {
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    try {
        const result = await pool.query('UPDATE comments SET is_approved = $1 WHERE id = $2', [action === 'approve', id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Comment not found' });
        res.json({ success: true, message: `Comment ${action === 'approve' ? 'approved' : 'unapproved'} successfully` });
    } catch (err) {
        console.error('Error moderating comment:', err);
        res.status(500).json({ success: false, error: 'Failed to moderate comment' });
    }
}

/**
 * 3. API: Admin Reply to Comment
 */
export async function replyComment(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Reply content cannot be empty' });
        }

        const parent = await pool.query('SELECT post_id FROM Comments WHERE id = $1', [id]);
        if (!parent.rows[0]) return res.status(404).json({ success: false, message: 'Parent comment not found' });

        const result = await pool.query(
            'INSERT INTO Comments (content, "UserName", post_id, parent_id, is_approved, created_at) VALUES ($1, $2, $3, $4, true, NOW()) RETURNING id',
            [content.trim(), req.session?.user?.username || 'admin', parent.rows[0].post_id, parseInt(id)]
        );

        res.json({ success: true, message: 'Reply posted successfully', id: result.rows?.[0]?.id || 1 });
    } catch (err) {
        console.error('Error replying to comment:', err);
        res.status(500).json({ success: false, message: 'Failed to post reply' });
    }
}

/**
 * 4. API: Bulk Comments Action
 */
export async function bulkCommentsAction(req, res) {
    const { action, commentIds } = req.body;
    if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No comments selected' });
    }
    const ids = commentIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    try {
        if (action === 'approve') await pool.query('UPDATE Comments SET is_approved = true WHERE id = ANY($1)', [ids]);
        else if (action === 'unapprove') await pool.query('UPDATE Comments SET is_approved = false WHERE id = ANY($1)', [ids]);
        else if (action === 'delete') await pool.query('DELETE FROM Comments WHERE id = ANY($1)', [ids]);
        else return res.status(400).json({ success: false, message: 'Invalid action' });

        res.json({ success: true, message: `Successfully processed ${ids.length} comments` });
    } catch (err) {
        console.error('Error in bulk comments:', err);
        res.status(500).json({ success: false, message: 'Failed to process comments' });
    }
}

/**
 * 5. API: Delete Comment
 */
export async function deleteComment(req, res) {
    try {
        const result = await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Comment not found' });
        res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ success: false, error: 'Failed to delete comment' });
    }
}
