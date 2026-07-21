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
// Lightbox — gallery carousel + example strips.
//   Click any photo in the homepage carousel or in a .example-track
//   strip to view it full size. Close: X, backdrop or Esc.
//   Navigate within the clicked collection: arrows or ←/→ keys.
// ============================================================
(function () {
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  const img = lb.querySelector('.lightbox-img');
  let list = [];   // [{src, alt}] of the active collection
  let cur = 0;     // index into list

  function show(i) {
    cur = (i + list.length) % list.length;
    img.src = list[cur].src;
    img.alt = list[cur].alt || 'Kinnisvarafoto täissuuruses';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lb.hidden = true;
    document.body.style.overflow = '';
  }

  // Homepage carousel: full-size files follow the gallery-NN pattern.
  const track = document.getElementById('galleryTrack');
  if (track) {
    const count = parseInt(track.getAttribute('data-count'), 10) || 0;
    track.addEventListener('click', function (e) {
      const t = e.target.closest('img');
      if (!t) return;
      const m = t.src.match(/gallery-(\d+)/);
      if (!m) return;
      list = [];
      for (let i = 1; i <= count; i++) {
        list.push({ src: 'assets/galerii/gallery-' + String(i).padStart(2, '0') + '.jpg',
                    alt: 'Kinnisvarafoto ' + i + ' täissuuruses' });
      }
      show(parseInt(m[1], 10) - 1);
    });
  }

  // Example strips: the collection is the strip's own images.
  document.querySelectorAll('.example-track').forEach(function (strip) {
    strip.addEventListener('click', function (e) {
      const t = e.target.closest('img');
      if (!t) return;
      const imgs = [...strip.querySelectorAll('img')];
      list = imgs.map(function (im) { return { src: im.getAttribute('src'), alt: im.alt }; });
      show(imgs.indexOf(t));
    });
  });

  lb.addEventListener('click', function (e) {
    if (e.target === lb) close();
  });
  lb.querySelector('.lightbox-close').addEventListener('click', close);
  lb.querySelector('.lightbox-prev').addEventListener('click', function () { show(cur - 1); });
  lb.querySelector('.lightbox-next').addEventListener('click', function () { show(cur + 1); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
})();

// ============================================================
// Contact form — Formspree AJAX submit + conversion tracking
//   Submits without leaving the page, shows an inline status message,
//   and fires the GA4 "generate_lead" event plus the Google Ads
//   conversion (when a real send_to label is set) only on success.
// ============================================================
(function () {
  const forms = document.querySelectorAll('.contact-form');
  if (!forms.length) return;

  function t(et, en) {
    let lang = 'et';
    try { lang = localStorage.getItem('lang') || 'et'; } catch (e) {}
    return lang === 'en' ? en : et;
  }

  function fireConversion(type, userData, form) {
    // Referral partner signups and contact requests are both leads.
    const method = type === 'referral' ? 'referral_signup' : 'contact_form';

    // Meta — booking/contact requests are Leads; referral-partner signups
    // are CompleteRegistration, so the two are separable in Ads Manager.
    // fbTrack mirrors the event to the server-side CAPI Worker (when
    // configured) with a shared event_id for dedup; falls back to the
    // browser Pixel alone otherwise.
    const fbEvent = type === 'referral' ? 'CompleteRegistration' : 'Lead';
    if (typeof window.fbTrack === 'function') {
      window.fbTrack(fbEvent, { content_name: method }, userData || {});
    } else if (typeof window.fbq === 'function') {
      window.fbq('track', fbEvent, { content_name: method });
    }

    // Google Analytics 4 + Google Ads
    if (typeof window.gtag !== 'function') return;
    // Enrich the lead with the chosen package (+ its € value parsed from the
    // option label, so it never drifts from the displayed price) and, on the
    // referral form, the client type — lets GA4 segment which packages and
    // audiences actually convert.
    var params = { method: method };
    if (form) {
      var pkgEl = form.querySelector('[name="package"]');
      if (pkgEl && pkgEl.value) {
        params.package = pkgEl.value;
        var opt = pkgEl.options[pkgEl.selectedIndex];
        var m = opt && opt.text ? opt.text.match(/€\s?(\d+)/) : null;
        if (m) { params.value = parseInt(m[1], 10); params.currency = 'EUR'; }
      }
      var clientEl = form.querySelector('[name="referrer_type"]');
      if (clientEl && clientEl.value) params.client_type = clientEl.value;
    }
    window.gtag('event', 'generate_lead', params);
    const label = window.ADS_CONTACT_LABEL;
    if (label && label.indexOf('XXXX') === -1) {
      window.gtag('event', 'conversion', { send_to: label });
    }
  }

  forms.forEach(function (form) {
    const type = form.getAttribute('data-form-type') || 'contact';

    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    form.appendChild(status);

    function showStatus(ok, msg) {
      status.hidden = false;
      status.classList.toggle('form-status--ok', ok);
      status.classList.toggle('form-status--error', !ok);
      status.textContent = msg;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const btn = form.querySelector('.btn-submit');
      const original = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = t('Saadan…', 'Sending…'); }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (!res.ok) throw new Error('bad response');
        // Capture PII for CAPI match quality before the form is reset.
        const emailEl = form.querySelector('[name="email"]');
        const phoneEl = form.querySelector('[name="phone"]');
        fireConversion(type, {
          email: emailEl ? emailEl.value : '',
          phone: phoneEl ? phoneEl.value : ''
        }, form);
        form.reset();
        showStatus(true, type === 'referral'
          ? t(
              'Aitäh! Võtame sinuga ühendust ja saadame sinu soovituskoodi.',
              'Thank you! We will be in touch and send you your referral code.'
            )
          : t(
              'Aitäh! Sõnum on saadetud — vastame 24 tunni jooksul.',
              'Thank you! Your message has been sent — we reply within 24 hours.'
            ));
      }).catch(function () {
        showStatus(false, t(
          'Midagi läks valesti. Proovi uuesti või kirjuta hello@lindjanar.ee.',
          'Something went wrong. Please try again or email hello@lindjanar.ee.'
        ));
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      });
    });
  });
})();

// ============================================================
// Cookie consent banner (GDPR / Consent Mode v2)
//   Shows until the visitor chooses. "Accept" grants consent and lets
//   GA/Ads set cookies; "Decline" keeps the denied default. Choice is
//   remembered in localStorage so the banner doesn't reappear.
// ============================================================
(function () {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;

  let stored = null;
  try { stored = localStorage.getItem('cookie-consent'); } catch (e) {}
  if (!stored) banner.hidden = false;

  function choose(state) {
    try { localStorage.setItem('cookie-consent', state); } catch (e) {}
    if (state === 'granted') {
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted'
        });
      }
      if (typeof window.fbq === 'function') {
        window.fbq('consent', 'grant');
        window.fbq('track', 'PageView');
      }
    }
    banner.hidden = true;
  }

  const accept = document.getElementById('cookieAccept');
  const decline = document.getElementById('cookieDecline');
  if (accept) accept.addEventListener('click', function () { choose('granted'); });
  if (decline) decline.addEventListener('click', function () { choose('denied'); });
})();

// ============================================================
// Micro-conversions — phone & email link clicks
//   People who call or email instead of using the form are invisible
//   otherwise. Delegated so it also covers links added later. Fires a
//   GA4 "contact_click" event (method: phone | email).
// ============================================================
(function () {
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!link || typeof window.gtag !== 'function') return;
    const isTel = link.getAttribute('href').indexOf('tel:') === 0;
    window.gtag('event', 'contact_click', { method: isTel ? 'phone' : 'email' });
  }, true);
})();


/* ── PROMO AUTO-EXPIRY: elements with data-promo-until vanish after the date ── */
document.querySelectorAll('[data-promo-until]').forEach(function (el) {
  var until = new Date(el.getAttribute('data-promo-until'));
  if (!isNaN(until.getTime()) && new Date() > until) el.remove();
});
