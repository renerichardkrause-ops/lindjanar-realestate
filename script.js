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
// Mobile menu – injected burger + slide-down panel (≤640px)
//
//   The desktop .nav is hidden below 640px and the header markup is
//   duplicated across 14 pages, so the button and the panel are built
//   here from whatever links the page's own .nav already contains –
//   one source of truth, nothing to keep in sync by hand.
//
//   The links are cloneNode() copies, so they keep their href and their
//   data-et / data-en attributes: applyLanguage() finds them in the DOM
//   like any other translated element and swaps the menu text too.
// ============================================================
(function () {
  const header = document.querySelector('.site-header');
  const inner  = header && header.querySelector('.header-inner');
  const nav    = header && header.querySelector('.nav');
  if (!header || !inner || !nav) return;

  const links = nav.querySelectorAll('a');
  if (!links.length) return;

  // ── Burger button (CSS keeps it hidden above 640px) ──
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.id = 'navToggle';
  btn.setAttribute('aria-controls', 'navPanel');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Ava menüü');
  btn.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true">' +
                  '<span></span><span></span><span></span></span>';
  inner.appendChild(btn);

  // ── Panel: backdrop + a copy of the nav links ──
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navPanel';

  const backdrop = document.createElement('div');
  backdrop.className = 'nav-drawer-backdrop';
  drawer.appendChild(backdrop);

  const panel = document.createElement('nav');
  panel.className = 'nav-drawer-panel';
  panel.setAttribute('aria-label', 'Peamenüü');
  links.forEach(function (a) { panel.appendChild(a.cloneNode(true)); });
  drawer.appendChild(panel);

  // Mirror the dark header variant onto the panel (it lives on <body>,
  // so it cannot inherit .site-header--dark through a descendant rule).
  if (header.classList.contains('site-header--dark')) {
    drawer.classList.add('nav-drawer--dark');
  }
  document.body.appendChild(drawer);

  // ── Open / close ──
  const lb      = document.getElementById('lightbox');
  const overlay = document.getElementById('galleryOverlay');
  let open = false;

  function setOpen(state) {
    open = state;
    drawer.classList.toggle('is-open', state);
    btn.setAttribute('aria-expanded', state ? 'true' : 'false');
    btn.setAttribute('aria-label', state ? 'Sulge menüü' : 'Ava menüü');
    if (state) {
      document.body.style.overflow = 'hidden';
      const first = panel.querySelector('a');
      if (first) first.focus();
    } else {
      // same guard the lightbox uses: only release the scroll lock when
      // nothing else still needs it
      if ((!lb || lb.hidden) && (!overlay || overlay.hidden)) {
        document.body.style.overflow = '';
      }
    }
  }

  function close(refocus) {
    if (!open) return;
    setOpen(false);
    if (refocus) btn.focus();
  }

  btn.addEventListener('click', function () {
    if (open) close(true); else setOpen(true);
  });

  backdrop.addEventListener('click', function () { close(true); });

  // Any link closes the panel – same-page #anchors never navigate, so it
  // would otherwise stay parked over the section it just scrolled to.
  panel.addEventListener('click', function (e) {
    if (e.target.closest('a')) close(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !open) return;
    // the lightbox and the gallery grid own Escape while they are up
    if ((lb && !lb.hidden) || (overlay && !overlay.hidden)) return;
    close(true);
  });

  // Rotating to landscape / resizing past the breakpoint would strand an
  // open panel behind the desktop nav.
  window.addEventListener('resize', function () {
    if (open && window.innerWidth > 640) close(false);
  });
})();

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

  const overlay = document.getElementById('galleryOverlay');

  function show(i) {
    cur = (i + list.length) % list.length;
    img.src = list[cur].src;
    img.alt = list[cur].alt || 'Kinnisvarafoto täissuuruses';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    // preload neighbours so arrows feel instant
    [cur + 1, cur - 1].forEach(function (n) {
      const item = list[(n + list.length) % list.length];
      if (item) { const pre = new Image(); pre.src = item.src; }
    });
  }
  function close() {
    lb.hidden = true;
    // keep scroll locked if the gallery grid is still open underneath
    if (!overlay || overlay.hidden) document.body.style.overflow = '';
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

  // Public hook so other pages (e.g. the portfolio wall) can drive the
  // lightbox with their own collection.
  window.LINDJANAR_openLightbox = function (collection, index) {
    if (!collection || !collection.length) return;
    list = collection;
    show(index || 0);
  };

  // Example albums: a card opens a grid overlay of thumbnails; clicking a
  // thumbnail opens the fullscreen lightbox (high-res -full files) at that
  // photo. Thumbs follow <base>NN.webp, full versions <base>NN-full.webp.
  const overlayGrid = document.getElementById('galleryOverlayGrid');
  const overlayTitle = document.getElementById('galleryOverlayTitle');

  function closeOverlay() {
    overlay.hidden = true;
    overlayGrid.innerHTML = '';
    document.body.style.overflow = '';
    if (/^#galerii-/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  if (overlay) {
    overlay.querySelector('.gallery-overlay-close').addEventListener('click', closeOverlay);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden && lb.hidden) closeOverlay();
    });
  }

  function openAlbumCard(card) {
    const base = card.getAttribute('data-base');
    const count = parseInt(card.getAttribute('data-count'), 10) || 0;
    const title = card.querySelector('.album-title');
    const name = title ? title.textContent : 'Galerii';
    overlayTitle.textContent = name + ' · ' + count + ' fotot';
    overlayGrid.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      const t = document.createElement('img');
      t.src = base + String(i).padStart(2, '0') + '.webp';
      t.alt = name + ' – foto ' + i;
      t.loading = 'lazy';
      t.addEventListener('click', function () {
        list = [];
        for (let j = 1; j <= count; j++) {
          list.push({ src: base + String(j).padStart(2, '0') + '-full.webp',
                      alt: name + ' – foto ' + j });
        }
        show(i - 1);
      });
      overlayGrid.appendChild(t);
    }
    overlay.hidden = false;
    overlay.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    // shareable link: put the gallery slug in the address bar
    if (card.dataset.gallery) {
      history.replaceState(null, '', '#galerii-' + card.dataset.gallery);
    }
  }

  document.querySelectorAll('.album-card').forEach(function (card) {
    card.addEventListener('click', function () { openAlbumCard(card); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlbumCard(card); }
    });
  });

  // deep link: #galerii-<slug> opens that album (on load and on hash change)
  function openGalleryFromHash() {
    const m = location.hash.match(/^#galerii-(.+)$/);
    if (!m) return;
    const card = document.querySelector('.album-card[data-gallery="' + m[1] + '"]');
    if (card) {
      card.scrollIntoView({ block: 'center' });
      openAlbumCard(card);
    }
  }
  window.addEventListener('hashchange', openGalleryFromHash);
  openGalleryFromHash();

  // Before/after figures: all four photos form one collection.
  document.querySelectorAll('.bna-grid').forEach(function (grid) {
    grid.addEventListener('click', function (e) {
      const t = e.target.closest('img');
      if (!t) return;
      const imgs = [...grid.querySelectorAll('img')];
      list = imgs.map(function (im) { return { src: im.getAttribute('src'), alt: im.alt }; });
      show(imgs.indexOf(t));
    });
  });

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
