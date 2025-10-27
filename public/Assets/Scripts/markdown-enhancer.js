// Enhanced Markdown Functionality
document.addEventListener('DOMContentLoaded', function() {
    const markdownContent = document.querySelector('.markdown-content');
    
    if (!markdownContent) return;

    // Add copy functionality to CSS pseudo-element buttons
    addPseudoElementCopyFunctionality();
    
    // Add reading progress indicator
    addReadingProgress();
    
    // Add table of contents generation
    generateTableOfContents();
    
    // Add smooth scroll for anchor links
    addSmoothScrolling();
    
    // Add image zoom functionality
    addImageZoom();

    function addPseudoElementCopyFunctionality() {
        const codeBlocks = markdownContent.querySelectorAll('pre');
        
        codeBlocks.forEach(pre => {
            pre.addEventListener('click', async (e) => {
                // Check if click is in the copy button area (top right corner)
                const rect = pre.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                
                // Approximate area where the pseudo-element copy button is
                const buttonWidth = 40; // Approximate width of button
                const buttonHeight = 30; // Approximate height of button
                const margin = 8; // 0.5rem margin
                
                if (clickX >= rect.width - buttonWidth - margin && 
                    clickX <= rect.width - margin &&
                    clickY >= margin && 
                    clickY <= margin + buttonHeight) {
                    
                    try {
                        const codeElement = pre.querySelector('code') || pre;
                        const textToCopy = codeElement.textContent;
                        
                        await navigator.clipboard.writeText(textToCopy);
                        
                        // Add copied class for visual feedback
                        pre.classList.add('copied');
                        
                        setTimeout(() => {
                            pre.classList.remove('copied');
                        }, 2000);
                        
                    } catch (err) {
                        console.error('Failed to copy code:', err);
                        
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        const codeElement = pre.querySelector('code') || pre;
                        textArea.value = codeElement.textContent;
                        textArea.style.position = 'fixed';
                        textArea.style.top = '0';
                        textArea.style.left = '0';
                        textArea.style.opacity = '0';
                        
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        
                        try {
                            document.execCommand('copy');
                            pre.classList.add('copied');
                            setTimeout(() => {
                                pre.classList.remove('copied');
                            }, 2000);
                        } catch (fallbackErr) {
                            console.error('Fallback copy failed:', fallbackErr);
                        }
                        
                        document.body.removeChild(textArea);
                    }
                }
            });
        });
    }

    function addReadingProgress() {
        const article = document.querySelector('article');
        if (!article) return; // Exit if no article found
        
        const updateProgress = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const articleRect = article.getBoundingClientRect();
            const articleTop = article.offsetTop;
            const articleHeight = article.offsetHeight;
            
            // Calculate how much of the article has been scrolled past
            const articleScrolled = Math.max(0, scrollTop - articleTop);
            
            // Total scrollable distance within the article
            const maxScroll = Math.max(1, articleHeight);
            
            // Calculate percentage
            let scrollPercent = (articleScrolled / maxScroll) * 100;
            
            // Clamp between 0 and 100
            scrollPercent = Math.min(Math.max(scrollPercent, 0), 100);
            
            document.documentElement.style.setProperty('--scroll-progress', `${scrollPercent}%`);
        };

        window.addEventListener('scroll', updateProgress);
        window.addEventListener('resize', updateProgress);
        updateProgress();
    }

    function generateTableOfContents() {
        const headings = markdownContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        if (headings.length < 3) return; // Only generate TOC if there are enough headings

        const toc = document.createElement('div');
        toc.className = 'table-of-contents';
        toc.innerHTML = '<h3>📑 Table of Contents</h3><ul></ul>';
        
        const tocList = toc.querySelector('ul');
        
        headings.forEach((heading, index) => {
            const id = `heading-${index}`;
            heading.id = id;
            
            const listItem = document.createElement('li');
            listItem.className = `toc-${heading.tagName.toLowerCase()}`;
            
            const link = document.createElement('a');
            link.href = `#${id}`;
            link.textContent = heading.textContent.replace(/^[📚📖📄]\s*/, ''); // Remove emoji prefixes
            
            listItem.appendChild(link);
            tocList.appendChild(listItem);
        });
        
        markdownContent.insertBefore(toc, markdownContent.firstChild);
    }

    function addSmoothScrolling() {
        markdownContent.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
                e.preventDefault();
                const targetId = e.target.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    }

    function addImageZoom() {
        const images = markdownContent.querySelectorAll('img');
        
        images.forEach(img => {
            img.addEventListener('click', () => {
                // Create overlay
                const overlay = document.createElement('div');
                overlay.className = 'image-zoom-overlay';
                
                // Create zoomed image
                const zoomedImg = img.cloneNode();
                zoomedImg.className = 'zoomed-image';
                
                overlay.appendChild(zoomedImg);
                document.body.appendChild(overlay);
                
                // Close on click
                overlay.addEventListener('click', () => {
                    document.body.removeChild(overlay);
                });
                
                // Close on escape key
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        document.body.removeChild(overlay);
                        document.removeEventListener('keydown', handleEscape);
                    }
                };
                document.addEventListener('keydown', handleEscape);
            });
            
            img.style.cursor = 'zoom-in';
        });
    }
});