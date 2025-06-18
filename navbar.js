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
                            <li><a href="${isBento ? '/bento-work.html' : '/index.html#portfolio'}" class="nav-link">Work</a></li>
                            <li><a href="${isBento ? '/bento-play.html' : '/creative.html'}" class="nav-link">Play</a></li>
                            <li><a href="${isBento ? '/bento-about.html' : '/about.html'}" class="nav-link">About</a></li>
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

            // Highlight active link based on current page (bento)
            const path = window.location.pathname;
            let activeLink = null;
            links.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');
                if (
                    (href === '/bento-work.html' && path.includes('bento-work')) ||
                    (href === '/bento-play.html' && path.includes('bento-play')) ||
                    (href === '/bento-about.html' && path.includes('bento-about')) ||
                    (href === '/bento.html' && path === '/bento.html')
                ) {
                    link.classList.add('active');
                    activeLink = link;
                }
            });

            function moveIndicator(link) {
                indicator.style.left = (link.offsetLeft) + 'px';
                indicator.style.width = link.offsetWidth + 'px';
                indicator.style.top = (link.offsetTop) + 'px';
                indicator.style.height = link.offsetHeight + 'px';
                indicator.style.opacity = 1;
            }

            function hideIndicator() {
                indicator.style.opacity = 0;
            }

            function showActiveIndicator() {
                if (activeLink) {
                    moveIndicator(activeLink);
                }
            }

            // Position indicator for active link initially
            if (activeLink) {
                moveIndicator(activeLink);
            }

            links.forEach(link => {
                link.addEventListener('mouseenter', () => moveIndicator(link));
                link.addEventListener('focus', () => moveIndicator(link));
                link.addEventListener('mouseleave', () => {
                    // Only hide indicator if we're not leaving the active link
                    if (link !== activeLink) {
                        hideIndicator();
                    }
                });
                link.addEventListener('blur', () => {
                    // Only hide indicator if we're not blurring the active link
                    if (link !== activeLink) {
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