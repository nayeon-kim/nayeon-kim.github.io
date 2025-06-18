// navbar.js
class NavBar extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        // Check if body has 'bento-body' class
        const isBento = document.body.classList.contains('bento-body');
        const paddingClass = isBento ? '' : 'p-3';
        this.innerHTML = `
            <header class="navbar navbar-expand-md fixed-top ${paddingClass}">
                <div class="container-fluid container">
                    <a href="${isBento ? '/bento.html' : '/index.html'}" class="nav-logo">
                        <img src="/media/favicon.png">
                    </a>
                    <nav class="navbar-nav-wrapper">
                        <ul class="navbar-nav">
                            ${isBento ? '<div class="nav-indicator"></div>' : ''}
                            <li><a href="/work.html" class="nav-link">Work</a></li>
                            <li><a href="/play.html" class="nav-link">Play</a></li>
                            <li><a href="/about.html" class="nav-link">About</a></li>
                        </ul>
                    </nav>
                </div>
            </header>
        `;

        // Sliding indicator logic for bento style
        if (isBento) {
            const nav = this.querySelector('.navbar-nav');
            const indicator = nav.querySelector('.nav-indicator');
            const links = nav.querySelectorAll('.nav-link');

            // Track current indicator target to prevent unnecessary animations
            let currentTarget = null;

            // Highlight active link based on current page (bento)
            const path = window.location.pathname;
            let activeLink = null;
            let isHomePage = path === '/bento.html';
            
            links.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');
                if (
                    (href === '/work.html' && path.includes('work')) ||
                    (href === '/play.html' && path.includes('play')) ||
                    (href === '/about.html' && path.includes('about'))
                ) {
                    link.classList.add('active');
                    activeLink = link;
                }
            });

            function moveIndicator(link, animate = true) {
                // Don't animate if already positioned correctly for this link
                if (currentTarget === link && animate) {
                    return;
                }
                
                // Update current target
                currentTarget = link;
                
                // Temporarily disable transitions if not animating
                if (!animate) {
                    indicator.style.transition = 'none';
                } else {
                    indicator.style.transition = 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1), top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s';
                }
                
                indicator.style.left = (link.offsetLeft) + 'px';
                indicator.style.width = link.offsetWidth + 'px';
                indicator.style.top = (link.offsetTop) + 'px';
                indicator.style.height = link.offsetHeight + 'px';
                indicator.style.opacity = 1;
                
                // Re-enable transitions after positioning
                if (!animate) {
                    // Use requestAnimationFrame to ensure the position is set before re-enabling transitions
                    requestAnimationFrame(() => {
                        indicator.style.transition = 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1), top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s';
                    });
                }
            }

            function hideIndicator() {
                indicator.style.opacity = 0;
                currentTarget = null;
            }

            function showActiveIndicator(animate = false) {
                if (activeLink) {
                    moveIndicator(activeLink, animate);
                }
            }

            // Position indicator for active link initially without animation
            // Hide indicator if on home page (no active nav link)
            if (isHomePage) {
                hideIndicator();
            } else if (activeLink) {
                moveIndicator(activeLink, false);
            }

            links.forEach(link => {
                link.addEventListener('mouseenter', () => moveIndicator(link, true));
                link.addEventListener('focus', () => moveIndicator(link, true));
                link.addEventListener('mouseleave', () => {
                    // Hide indicator if on home page, otherwise show active indicator
                    if (isHomePage) {
                        hideIndicator();
                    } else if (link !== activeLink) {
                        hideIndicator();
                    }
                });
                link.addEventListener('blur', () => {
                    // Hide indicator if on home page, otherwise show active indicator
                    if (isHomePage) {
                        hideIndicator();
                    } else if (link !== activeLink) {
                        hideIndicator();
                    }
                });
            });
        } else {
            // Classic (non-bento) pages: highlight active link
            const nav = this.querySelector('.navbar-nav');
            const links = nav.querySelectorAll('.nav-link');
            const path = window.location.pathname;
            links.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');
                if (
                    (href.includes('index.html') && (path === '/' || path.includes('index.html'))) ||
                    (href.includes('creative.html') && path.includes('creative')) ||
                    (href.includes('about.html') && path.includes('about'))
                ) {
                    link.classList.add('active');
                }
            });
        }
    }
}

customElements.define('nav-bar', NavBar);

// removed:
// <a class="nav-logo" href="/index.html">NAYEON KIM</a>