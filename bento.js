document.addEventListener('DOMContentLoaded', function() {
    const artCards = document.querySelectorAll('.art-card');
    
    artCards.forEach(card => {
        card.addEventListener('click', function() {
            // Toggle expanded class
            this.classList.toggle('expanded');
            
            // If this card is expanded, collapse others
            if (this.classList.contains('expanded')) {
                artCards.forEach(otherCard => {
                    if (otherCard !== this) {
                        otherCard.classList.remove('expanded');
                    }
                });
            }
        });
    });

    // Close expanded card when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.art-card')) {
            artCards.forEach(card => {
                card.classList.remove('expanded');
            });
        }
    });
}); 