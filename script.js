// Footer year
document.querySelectorAll('.year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// ============================================================
// Language switcher — ET (default) / EN
//
// HOW TO EDIT TRANSLATIONS:
//   Estonian copy → find the element in HTML and edit data-et="..."
//   English copy  → edit the data-en="..." attribute
//   For form placeholders → edit data-et-placeholder / data-en-placeholder
// ============================================================
function applyLanguage(lang) {
  document.querySelectorAll('[data-et]').forEach(el => {
    el.textContent = el.getAttribute('data-' + lang);
  });
  document.querySelectorAll('[data-et-placeholder]').forEach(el => {
    el.placeholder = el.getAttribute('data-' + lang + '-placeholder');
  });
  document.querySelectorAll('.lang-toggle').forEach(btn => {
    btn.textContent = lang === 'et' ? 'EN' : 'ET';
    btn.setAttribute('aria-label', lang === 'et' ? 'Switch to English' : 'Lülitu eesti keelele');
  });
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
}

function toggleLanguage() {
  const current = localStorage.getItem('lang') || 'et';
  applyLanguage(current === 'et' ? 'en' : 'et');
}

window.toggleLanguage = toggleLanguage;

// Apply saved language on every page load (default: Estonian)
applyLanguage(localStorage.getItem('lang') || 'et');

// ============================================================
// Gallery carousel — auto-advance + manual arrows + native swipe
//   Slides are built from assets/galerii/gallery-NN.jpg using the
//   data-count on #galleryTrack. Pauses on hover/touch and when the
//   section is off-screen.
// ============================================================
(function () {
  const track = document.getElementById('galleryTrack');
  if (!track) return;

  const count = parseInt(track.getAttribute('data-count'), 10) || 0;
  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(2, '0');
    const slide = document.createElement('div');
    slide.className = 'gallery-slide';
    const img = document.createElement('img');
    img.src = 'assets/galerii/gallery-' + n + '.jpg';
    img.loading = 'lazy';
    img.alt = 'Kinnisvarafoto ' + i;
    slide.appendChild(img);
    track.appendChild(slide);
  }

  const carousel = track.closest('.gallery-carousel');
  const prev = carousel.querySelector('.gallery-arrow--prev');
  const next = carousel.querySelector('.gallery-arrow--next');

  function stepWidth() {
    const slide = track.querySelector('.gallery-slide');
    if (!slide) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    return slide.getBoundingClientRect().width + gap;
  }

  function go(dir) {
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    const atStart = track.scrollLeft <= 4;
    if (dir > 0 && atEnd) { track.scrollTo({ left: 0, behavior: 'smooth' }); return; }
    if (dir < 0 && atStart) { track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' }); return; }
    track.scrollBy({ left: dir * stepWidth(), behavior: 'smooth' });
  }

  if (next) next.addEventListener('click', () => go(1));
  if (prev) prev.addEventListener('click', () => go(-1));

  // Auto-advance
  let timer = null;
  const DELAY = 3500;
  function start() { stop(); timer = setInterval(() => go(1), DELAY); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Pause on hover (desktop)
  carousel.addEventListener('mouseenter', stop);
  carousel.addEventListener('mouseleave', start);

  // Pause on touch (mobile), resume shortly after
  let resumeT;
  track.addEventListener('touchstart', () => { stop(); clearTimeout(resumeT); }, { passive: true });
  track.addEventListener('touchend', () => { clearTimeout(resumeT); resumeT = setTimeout(start, 4000); }, { passive: true });

  // Only run while the carousel is visible
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? start() : stop()));
    }, { threshold: 0.25 });
    io.observe(carousel);
  } else {
    start();
  }
})();

// ============================================================
// Conversion tracking — contact-form submit
//   Fires a GA4 "generate_lead" event and (when a real Google Ads
//   label is configured in index.html) a Google Ads conversion.
//   Safe no-op until IDs/label are filled in.
// ============================================================
(function () {
  const form = document.querySelector('.contact-form');
  if (!form) return;
  form.addEventListener('submit', function () {
    if (typeof window.gtag !== 'function') return;
    // Google Analytics 4 lead event
    window.gtag('event', 'generate_lead', { method: 'contact_form' });
    // Google Ads conversion (only once a real send_to label is set)
    const label = window.ADS_CONTACT_LABEL;
    if (label && label.indexOf('XXXX') === -1) {
      window.gtag('event', 'conversion', { send_to: label });
    }
  });
})();
