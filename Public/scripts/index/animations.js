document.addEventListener('DOMContentLoaded', () => {
    const selectors = [
      '.info-banner-item',
      '.offer-card',
      '.filter-group',
      '.carousel-slide',
      '.category-card',
      '.testimonial-card',
      '.newsletter-section'
    ];
    selectors.forEach(sel =>
      document.querySelectorAll(sel).forEach(el => el.classList.add('scroll-reveal'))
    );

    // Configura el Intersection Observer
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          obs.unobserve(entry.target); // deja de observarlo tras animar
        }
      });
    }, {
      threshold: 0.2 // cuando el 20% del elemento esté visible
    });

    // Empieza a observar todos los marcados
    document.querySelectorAll('.scroll-reveal').forEach(el =>
      observer.observe(el)
    );
});

// Carrusel principal: navegación
const carousel = document.getElementById('main-carousel');
let slideIndex = 0;
const slides = Array.from(carousel.children);
function showSlide(idx) {
  slides.forEach((s,i)=> s.style.display=i===idx?"block":"none");
  if (idx < 0) slideIndex = slides.length-1;
    else if (idx >= slides.length) slideIndex = 0; else slideIndex=idx;
      slides[slideIndex].style.display="block";
}
slides.forEach(s=>s.style.display='none');
showSlide(0);

document.getElementById('carouselNext').onclick=
()=>{showSlide((slideIndex+1)%slides.length);}
document.getElementById('carouselPrev').onclick=
()=>{showSlide((slideIndex-1+slides.length)%slides.length);}

// Ocultar slides no actuales en móvil
window.addEventListener("resize", function() {
  showSlide(slideIndex);
});