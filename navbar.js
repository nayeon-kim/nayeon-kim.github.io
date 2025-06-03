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
                            <li><a href="/index.html#portfolio" class="nav-link">Work</a></li>
                            <li><a href="/creative.html" class="nav-link">Play</a></li>
                            <li><a href="/about.html" class="nav-link">About</a></li>
                        </ul>
                    </nav>
                </div>
            </header>
        `;
    }
}

customElements.define('nav-bar', NavBar);

// removed:
// <a class="nav-logo" href="/index.html">NAYEON KIM</a>