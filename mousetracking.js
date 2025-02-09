let targetX = 0, targetY = 0;  // Cursor position
let currentX = 0, currentY = 0; // Smoothed position
let delayFactor = 0.04; // Adjust this for more/less delay (0.1 = slower, 0.2 = faster)

document.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
});

function updateGradient() {
    // Smoothly interpolate towards the target position
    currentX += (targetX - currentX) * delayFactor;
    currentY += (targetY - currentY) * delayFactor;

    document.body.style.background = `radial-gradient(circle at ${currentX}px ${currentY}px, rgba(255, 100, 100, 0.1) 10%, transparent 50%)`;

    requestAnimationFrame(updateGradient); // Continuously update
}

updateGradient(); // Start animation loop
