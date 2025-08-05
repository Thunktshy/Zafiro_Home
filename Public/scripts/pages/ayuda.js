const accordions = document.querySelectorAll('.accordion-item');
    accordions.forEach((item, idx) => {
      const questionBtn = item.querySelector('.accordion-question');
      if (!questionBtn) return;
      questionBtn.addEventListener('click', function() {
        // Close other questions
        accordions.forEach(other => {
          const btn = other.querySelector('.accordion-question');
          const answer = other.querySelector('.accordion-answer');
          if (btn !== questionBtn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('open');
            answer.style.maxHeight = null;
            answer.style.opacity = 0.45;
          }
        });

        // Toggle current
        const open = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', !open);
        if (!open) {
          this.classList.add('open');
          item.querySelector('.accordion-answer').style.maxHeight = '350px';
          item.querySelector('.accordion-answer').style.opacity = 1;
          // Animate icon
          item.querySelector('.accordion-icon svg').style.transform = "rotate(90deg)";
        } else {
          this.classList.remove('open');
          item.querySelector('.accordion-answer').style.maxHeight = '0px';
          item.querySelector('.accordion-answer').style.opacity = 0.45;
          // Animate icon
          item.querySelector('.accordion-icon svg').style.transform = "rotate(0deg)";
        }
      });
    });

    // Optional: Add a small fade-in animation for FAQ container on load
    document.addEventListener('DOMContentLoaded', function() {
      const faqContainer = document.querySelector('.faq-container');
      setTimeout(() => {
        faqContainer.style.opacity = '1';
        faqContainer.style.transform = 'translateY(0)';
      }, 200);
    });