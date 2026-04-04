// Navbar scroll effect
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// Mobile menu toggle
const hamburger = document.getElementById('nav-hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

// Close mobile menu on outside click
document.addEventListener('click', (e) => {
  if (!nav.contains(e.target) && !mobileMenu.contains(e.target)) {
    closeMobileMenu();
  }
});

// ─── Smart CTA: if user has a session, show Dashboard link instead ─────────
(function() {
  // Check for any sign of an active Nexus session in localStorage
  const hasSession = localStorage.getItem('nexus_researcher_profile') ||
                     localStorage.getItem('nexus_saved_papers') ||
                     localStorage.getItem('nexus_usage_local');

  if (hasSession) {
    // Update nav Sign in link → Go to Dashboard
    const signInLink = document.querySelector('.nav-cta .btn-ghost');
    if (signInLink) {
      signInLink.textContent = 'Go to Dashboard →';
      signInLink.href = 'pages/dashboard.html';
      signInLink.style.color = 'var(--cyan)';
      signInLink.style.borderColor = 'rgba(34,211,238,0.3)';
    }

    // Add subtle prompt under hero actions
    const heroActions = document.getElementById('hero-cta')?.parentElement;
    if (heroActions) {
      const prompt = document.createElement('a');
      prompt.href = 'pages/dashboard.html';
      prompt.className = 'hero-dashboard-cta';
      prompt.textContent = 'Already using Nexus? Go to your dashboard →';
      prompt.style.display = 'block';
      heroActions.after(prompt);
    }
  }
})();

// Scroll-triggered animations using IntersectionObserver
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.step-card, .feature-card, .price-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Stagger delays within grids
document.querySelectorAll('.steps-grid, .features-grid, .pricing-grid').forEach(grid => {
  [...grid.children].forEach((child, i) => {
    if (child.classList.contains('step-arrow')) return;
    child.style.transitionDelay = `${i * 0.08}s`;
  });
});

