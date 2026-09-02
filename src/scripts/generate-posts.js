import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';
import { marked } from 'marked';
import Prism from 'prismjs';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { PUBLIC_DIR } from '../config/constants.js';
import path from 'path';
import fs from 'fs';

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

const window = new JSDOM('').window;
const purify = DOMPurify(window);

async function generatePosts() {
    console.log('Starting static blog post data generation...');
    const outputDir = path.join(PUBLIC_DIR, 'posts');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // Fetch all published posts
        const postsResult = await pool.query(
            `SELECT p.id, p.slug
             FROM Posts p
             WHERE p.status = 'published'`
        );

        console.log(`Found ${postsResult.rows.length} published posts.`);

        for (const simplePost of postsResult.rows) {
            const slug = simplePost.slug;
            console.log(`Generating cached data for: ${slug}`);

            // Fetch detailed post data (same query logic as src/routes/blog.routes.js)
            const postQuery = await pool.query(
                `SELECT p.*, 
                STRING_AGG(DISTINCT c.name, ', ') as categories,
                u."UserName" as author_name,
                ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) as category_ids,
                ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as category_names
                FROM Posts p
                LEFT JOIN "Users" u ON p."UserName" = u."UserName"
                LEFT JOIN Post_Categories pc ON p.id = pc.post_id
                LEFT JOIN Categories c ON pc.category_id = c.id
                WHERE p.slug = $1 AND p.status = 'published'
                GROUP BY p.id, u."UserName"`,
                [slug]
            );

            if (!postQuery.rows[0]) continue;
            const post = postQuery.rows[0];

            // Process Markdown
            if (post.content_markdown) {
                const dirtyHtml = marked(post.content_markdown);
                post.content_html = purify.sanitize(dirtyHtml);
            } else {
                post.content_html = post.content || '';
            }

            // Fetch Tags
            const tagsQuery = await pool.query(
                `SELECT t.name
                FROM Tags t
                INNER JOIN Post_Tags pt ON t.id = pt.tag_id
                WHERE pt.post_id = $1`,
                [post.id]
            );
            post.tags = tagsQuery.rows;

            // Fetch Comments (Public view only - approved comments)
            const commentsQuery = await pool.query(
                `SELECT c.id, c.content, c."UserName", c.created_at, c.parent_id, c.is_approved,
                u."UserName" as author_name,
                pc.content as parent_content, pu."UserName" as parent_author_name
                FROM Comments c
                LEFT JOIN "Users" u ON c."UserName" = u."UserName"
                LEFT JOIN Comments pc ON c.parent_id = pc.id
                LEFT JOIN "Users" pu ON pc."UserName" = pu."UserName"
                WHERE c.post_id = $1 AND c.is_approved = true
                ORDER BY c.created_at DESC`,
                [post.id]
            );

            const comments = commentsQuery.rows;

            comments.forEach(comment => {
                comment.replyCount = comments.filter(reply => reply.parent_id === comment.id).length;
                comment.content = purify.sanitize(comment.content);
                if (comment.parent_content) {
                    comment.parent_content = purify.sanitize(comment.parent_content);
                }
            });

            // Save processed data as JSON
            const postData = {
                post: post,
                comments: comments
            };

            // Save to file
            const filePath = path.join(outputDir, `${slug}.json`);
            fs.writeFileSync(filePath, JSON.stringify(postData, null, 2));
        }

        console.log('Successfully generated all blog post cache data.');
        process.exit(0);

    } catch (err) {
        console.error('Error generating posts:', err);
        process.exit(1);
    }
}

generatePosts();
