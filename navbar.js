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
                    <div class="nav-logo">
                        <img src="/media/favicon.png">
                    </div>
                    <nav class="navbar-nav-wrapper">
                        <ul class="navbar-nav">
                            ${isBento ? '<div class="nav-indicator"></div>' : ''}
                            <li><a href="/index.html#portfolio" class="nav-link">Work</a></li>
                            <li><a href="/creative.html" class="nav-link">Play</a></li>
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

            function moveIndicator(link) {
                const rect = link.getBoundingClientRect();
                const navRect = nav.getBoundingClientRect();
                indicator.style.left = (link.offsetLeft) + 'px';
                indicator.style.width = link.offsetWidth + 'px';
                indicator.style.top = (link.offsetTop) + 'px';
                indicator.style.height = link.offsetHeight + 'px';
                indicator.style.opacity = 1;
            }

            function hideIndicator() {
                indicator.style.opacity = 0;
            }

            links.forEach(link => {
                link.addEventListener('mouseenter', () => moveIndicator(link));
                link.addEventListener('focus', () => moveIndicator(link));
                link.addEventListener('mouseleave', hideIndicator);
                link.addEventListener('blur', hideIndicator);
            });

            hideIndicator();
        }
    }
}

customElements.define('nav-bar', NavBar);

// removed:
// <a class="nav-logo" href="/index.html">NAYEON KIM</a>