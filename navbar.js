// navbar.js
class NavBar extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
            <header class="navbar navbar-expand-md fixed-top p-3">
                <div class="container-fluid">
					<div class="nav-logo">	
						<img src="/media/favicon.png">
					</div>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation" style="border-style: none;">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <nav class="collapse navbar-collapse justify-content-end" id="navbarSupportedContent">
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