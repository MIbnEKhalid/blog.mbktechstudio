document.addEventListener('DOMContentLoaded', () => {
    const assetsToPreload = [
        // CSS Files
        '/Assets/blog-main.css',
        '/Assets/markdown.css',
        '/Assets/post-card.css',
        '/Assets/search-filter.css',
        '/Assets/post-detail.css',
        '/Assets/blog-archive.css',
        '/Assets/table-of-contents.css',

        // JS Files
        '/Assets/Scripts/blog-main.js',
        '/Assets/Scripts/markdown-enhancer.js',
        '/Assets/Scripts/post-detail.js'
    ];

    window.addEventListener('load', () => {
        assetsToPreload.forEach(url => {
            fetch(url).catch(err => console.error(`Failed to preload ${url}:`, err));
        });
    });
});
