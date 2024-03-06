let carousel = document.querySelector( '.carousel' ),
    track = carousel.querySelector( '.carousel--track' ),
    row = carousel.querySelector( '.carousel--row' );

let clonedRow = row.cloneNode( true );

track.appendChild( clonedRow );

