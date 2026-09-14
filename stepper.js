// ============================================================
// Päringuvorm – one question at a time (kinnisvara.lindjanar.ee)
//   Replaces the old five-field form. Four paths: korter, eramaja,
//   äripind, and "ei tea veel – ise või maakleriga" (Richard's call).
//   Posts to the same Formspree endpoint as before, with the answers
//   as structured fields; fires the existing generate_lead conversion
//   through window.LINDJANAR_fireLead; every step is a PostHog event.
//   Answers persist in localStorage so a scroll-away loses nothing.
//   On phones the sticky "Broneeri" bar opens the same form as a
//   bottom sheet (the form element is moved, not cloned).
//   Copy is bilingual via the T() helper – ET/EN pairs, en dashes only.
// ============================================================
(function () {
  'use strict';
  var root = document.getElementById('stepper');
  if (!root) return;

  var ENDPOINT = 'https://formspree.io/f/mkoanabz';
  var KEY = 'lj-paring';

  function lang() { try { return localStorage.getItem('lang') || 'et'; } catch (e) { return 'et'; } }
  function T(et, en) { return lang() === 'en' ? en : et; }
  function eur(n) { return n.toLocaleString('et-EE') + ' €'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- prices: mirror index.html #pricing; large-tier photo-only from B2B offers ----
  var P = {
    korter: {
      '1-2':  { lbl: ['Stuudio / 1–2 tuba', 'Studio / 1–2 rooms'], foto: 85,  tier: ['Põhi', 'Basic'],       fotos: ['25–30 fotot', '25–30 photos'], video: 240 },
      '3-4':  { lbl: ['3–4 tuba', '3–4 rooms'],                     foto: 95,  tier: ['Standard', 'Standard'],      fotos: ['35–45 fotot', '35–45 photos'], video: 270 },
      '5+':   { lbl: ['Suur korter / ridaelamu, 5+ tuba', 'Large apartment / terraced house, 5+ rooms'], foto: 115, tier: ['Premium', 'Premium'], fotos: ['50+ fotot', '50+ photos'], video: 300, premium: 479, eraldi: 554 }
    },
    eramaja: {
      '<100':    { lbl: ['kuni 99 m²', 'up to 99 m²'],      foto: 109, tier: ['Põhi', 'Basic'],  fotos: ['30–40 fotot', '30–40 photos'], video: 300 },
      '100-149': { lbl: ['100–149 m²', '100–149 m²'], foto: 129, tier: ['Standard', 'Standard'], fotos: ['40–50 fotot', '40–50 photos'], video: 320 },
      '150+':    { lbl: ['150–200 m²', '150–200 m²'], foto: 149, tier: ['Premium', 'Premium'], fotos: ['55+ fotot', '55+ photos'], video: 350, premium: 583, eraldi: 658 }
    },
    droon: 59
  };
  var L = function (pair) { return pair[lang() === 'en' ? 1 : 0]; };

  var S = {};
  try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { S = {}; }
  var idx = 0, history = [], sending = false;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function ph(ev, props) { if (window.posthog && window.posthog.capture) window.posthog.capture(ev, props || {}); }

  // ---- the flow, computed from state so branches stay honest ----
  function steps() {
    var list = [];
    list.push({ id: 'object', q: T('Mis objektiga on tegu?', 'What are we photographing?'), hint: T('Vali üks.', 'Pick one.'), opts: [
      { v: 'korter',  b: T('Korter', 'Apartment'), s: T('ka ridaelamu või boks', 'terraced house or maisonette too') },
      { v: 'eramaja', b: T('Eramaja', 'House'),    s: T('maja, suvila, villa', 'house, summer home, villa') },
      { v: 'aripind', b: T('Äripind', 'Commercial'), s: T('büroo, kauplus, ladu', 'office, retail, warehouse') },
      { v: 'maakler', b: T('Ei tea veel, kas müüa ise või maakleriga', 'Not sure yet – sell myself or with an agent?'), s: T('aitame otsustada – Richard helistab', 'we help you decide – Richard calls') }
    ], set: function (v) { S.object = v; delete S.size; delete S.need; } });

    if (S.object === 'korter' || S.object === 'eramaja') {
      var tiers = P[S.object];
      list.push({ id: 'size', q: S.object === 'korter' ? T('Kui suur korter?', 'How big is the apartment?') : T('Kui suur maja?', 'How big is the house?'),
        hint: S.object === 'korter' ? T('Sellest sõltub pakett ja hind.', 'This sets the package and the price.') : T('Köetav pind, umbes.', 'Heated area, roughly.'),
        opts: Object.keys(tiers).map(function (k) { var t = tiers[k]; return { v: k, b: L(t.lbl), s: L(t.tier) + ' · ' + L(t.fotos) }; }),
        set: function (v) { S.size = v; delete S.need; } });
      if (S.size) {
        var t = tiers[S.size];
        var all = t.premium ? t.premium : t.foto + P.droon + t.video;
        list.push({ id: 'need', q: T('Mida vajad?', 'What do you need?'),
          hint: S.size === '150+' ? T('Üle 200 m² ja villad hindame eraldi.', 'Over 200 m² and villas are quoted separately.') : T('Paketi hinnad.', 'Package prices.'),
          after: T('Transpordikulu 0,20 €/km lisandub.', 'Travel is added at 0.20 €/km.'),
          opts: [
            { v: 'foto',       b: T('Fotod', 'Photos'), s: L(t.fotos) + T(' · käes 48 h', ' · delivered in 48 h'), price: eur(t.foto) },
            { v: 'foto-droon', b: T('Fotod + droonifotod', 'Photos + drone photos'), s: S.object === 'korter' ? T('hoone ja ümbrus õhust', 'the building and surroundings from the air') : T('maja ja krunt õhust', 'the house and plot from the air'), price: eur(t.foto + P.droon) },
            { v: 'koik',       b: T('Kõik koos', 'Everything'), s: T('fotod + droon + kodu tutvustusvideo', 'photos + drone + home tour video') + (t.premium ? T(' + Listing Reel poole hinnaga', ' + Listing Reel at half price') : ''), price: (t.premium ? '' : T('alates ', 'from ')) + eur(all), strike: t.eraldi ? eur(t.eraldi) : null },
            { v: 'soovita',    b: T('Ei tea – soovita', 'Not sure – advise me'), s: T('ütleme, mis sellele objektile vajalik oleks – vastavalt sellele, kui kiire müügiga on', 'we tell you what this property needs – depending on how fast it has to sell') }
          ], set: function (v) { S.need = v; } });
      }
    }
    if (S.object === 'aripind') list.push({ id: 'aripind', q: T('Kirjelda paari sõnaga.', 'Describe it in a few words.'), hint: T('Äripinnad hindame eraldi – mis pind, kus, kui suur.', 'Commercial spaces are quoted individually – what, where, how big.'),
      fields: [{ n: 'desc', l: T('Objekt', 'Property'), ph: T('nt 120 m² büroo Tartu kesklinnas, 4 ruumi', 'e.g. 120 m² office in central Tartu, 4 rooms'), ta: true }] });

    if (S.object === 'maakler') {
      list.push({ id: 'where', q: T('Kus kodu asub?', 'Where is the home?'), hint: T('Asulast piisab.', 'The town is enough.'), fields: [{ n: 'place', l: T('Asula või aadress', 'Town or address'), ph: T('nt Elva', 'e.g. Elva') }] });
      list.push({ id: 'stage', q: T('Kus sa otsusega oled?', 'Where are you with the decision?'), hint: T('Et Richard teaks, millest alustada.', 'So Richard knows where to start.'), opts: [
        { v: 'motlen',  b: T('Pole veel kindel, mis teed pidi minna.', 'Not sure yet which way to go.') },
        { v: 'hind',    b: T('Tahan teada, mis mu kodu väärt on.', 'I want to know what my home is worth.') },
        { v: 'vordlen', b: T('Pole varem maakleriga koostööd teinud. Keda üldse usaldada saaksin?', 'Never worked with an agent. Who could I even trust?') }
      ], set: function (v) { S.stage = v; } });
    } else if (S.object) {
      list.push({ id: 'when', q: T('Kus ja millal?', 'Where and when?'), hint: T('Aadress ja umbkaudne aeg.', 'Address and a rough time.'),
        fields: [{ n: 'address', l: T('Objekti aadress', 'Property address'), ph: T('Tänav, maja, asula', 'Street, number, town') }],
        chips: { n: 'when', l: T('Millal', 'When'), opts: [T('Sel nädalal', 'This week'), T('Järgmisel nädalal', 'Next week'), T('Pole kiire', 'No hurry'), T('Kokkuleppel', 'To be agreed')] } });
    }
    if (S.object) {
      list.push({ id: 'contact',
        q: S.object === 'maakler' ? T('Kuidas ma ühendust võiksin võtta?', 'How should I reach you?') : T('Kuidas sinuga ühendust võtame?', 'How do we reach you?'),
        hint: S.object === 'maakler' ? '' : S.object === 'aripind' ? T('Pakkumine tuleb e-postile, täpsustame telefonis.', 'The quote comes by email; details by phone.') : T('Kinnitus tuleb e-postile, aja lepime kokku telefonis.', 'Confirmation by email; we agree the time by phone.'),
        fields: [
          { n: 'name',  l: T('Nimi', 'Name'),   ph: T('Ees- ja perekonnanimi', 'First and last name'), ac: 'name' },
          { n: 'phone', l: T('Telefon', 'Phone'), ph: '+372', type: 'tel', ac: 'tel' },
          { n: 'email', l: T('E-post', 'Email'), ph: T('nimi@näide.ee', 'name@example.com'), type: 'email', ac: 'email' }
        ],
        chips: { n: 'channel', l: T('Kuidas eelistad', 'Preferred channel'), optional: true, opts: [T('Helista mulle', 'Call me'), T('Kirjuta SMS', 'Text me'), T('Kirjuta e-kiri', 'Email me')] } });
      list.push({ id: 'summary', q: T('Kontrolli üle ja saada.', 'Check and send.'), summary: true });
      list.push({ id: 'done', done: true });
    }
    return list;
  }

  function price() {
    if (!(S.object in P) || !S.size || !S.need) return null;
    var t = P[S.object][S.size];
    if (S.need === 'foto') return { n: t.foto, prefix: '' };
    if (S.need === 'foto-droon') return { n: t.foto + P.droon, prefix: '' };
    if (S.need === 'koik') return t.premium ? { n: t.premium, prefix: '' } : { n: t.foto + P.droon + t.video, prefix: T('alates ', 'from ') };
    return null;
  }
  var NEED_LBL = function () { return { 'foto': T('Fotod', 'Photos'), 'foto-droon': T('Fotod + droonifotod', 'Photos + drone photos'), 'koik': T('Fotod + droon + video', 'Photos + drone + video'), 'soovita': T('soovitus meilt', 'our recommendation') }; };
  var STAGE_LBL = function () { return { motlen: T('Pole veel kindel, mis teed pidi minna', 'Not sure which way to go'), hind: T('Tahan teada, mis mu kodu väärt on', 'Wants to know the home’s value'), vordlen: T('Pole varem maakleriga koostööd teinud', 'Never worked with an agent') }; };

  // ---- render ----
  function render(dir) {
    var list = steps(); idx = Math.min(idx, list.length - 1); var st = list[idx];
    var visible = list.filter(function (s) { return !s.done; });
    var pos = list.slice(0, idx).filter(function (s) { return !s.done; }).length;
    var total = Math.max(visible.length, S.object ? visible.length : 5);
    var h = '<div class="st-bar"><button type="button" class="st-back"' + (idx === 0 || st.done ? ' hidden' : '') + ' data-back>← ' + T('Tagasi', 'Back') + '</button><div class="st-dots" aria-hidden="true">';
    for (var i = 0; i < total; i++) h += '<i class="' + (i < pos ? 'done' : i === pos ? 'cur' : '') + '"></i>';
    h += '</div></div>';
    h += '<div class="st-step' + (dir === 'back' ? ' back-in' : '') + '" aria-live="polite">';

    if (st.done) {
      var first = S.name ? esc(S.name.split(' ')[0]) : '';
      h += '<div class="st-done">✓</div><p class="st-q">' + T('Aitäh', 'Thank you') + (first ? ', ' + first : '') + '.</p>';
      h += '<p class="st-hint st-hint--lg">' + (S.object === 'maakler'
        ? T('Richard võtab ühendust 24 h jooksul. Viisteist minutit, ja räägime rahulikult läbi, kumb tee sulle mõistlik on.', 'Richard will be in touch within 24 h. Fifteen minutes, and we calmly talk through which route makes sense for you.')
        : S.object === 'aripind'
        ? T('Richard võtab ühendust 24 h jooksul ja saadab pakkumise.', 'Richard will be in touch within 24 h with a quote.')
        : T('Kinnitus on su e-postis. Richard võtab ühendust 24 h jooksul ja saate aja kokku leppida.', 'A confirmation is in your inbox. Richard will be in touch within 24 h to agree a time.')) + '</p>';
      if (S.object === 'korter' || S.object === 'eramaja') h += '<p class="st-promise"><i></i>' + T('Vahepeal: ', 'Meanwhile: ') + '<a href="/tood.html">' + T('vaata näiteid', 'see examples') + '</a> ' + T('või', 'or') + ' <a href="/blogi/kodu-ettevalmistus-pildistamiseks.html">' + T('loe, kuidas kodu pildistamiseks ette valmistada', 'read how to prepare a home for the shoot') + '</a>.</p>';
      h += '<button type="button" class="st-next st-next--ghost" data-reset>' + T('Uus päring', 'New enquiry') + '</button>';
    } else {
      h += '<p class="st-q">' + st.q + '</p>' + (st.hint ? '<p class="st-hint">' + st.hint + '</p>' : '');
      if (st.opts) {
        var cur = S[st.id === 'object' ? 'object' : st.id];
        h += '<div class="st-opts">' + st.opts.map(function (o) {
          return '<button type="button" class="st-opt' + (cur === o.v ? ' sel' : '') + '" data-v="' + o.v + '"><b>' + o.b + '</b>' + (o.s ? '<small>' + o.s + '</small>' : '') +
            (o.price ? '<span class="st-price">' + (o.strike ? '<s>' + o.strike + '</s>' : '') + o.price + '</span>' : '') + '</button>';
        }).join('') + '</div>';
        if (st.after) h += '<p class="st-hint st-after">' + st.after + '</p>';
      }
      if (st.fields) {
        h += st.fields.map(function (f) {
          var v = esc(S[f.n] || '');
          return '<div class="st-field"><label for="st-' + f.n + '">' + f.l + '</label>' + (f.ta
            ? '<textarea id="st-' + f.n + '" name="' + f.n + '" rows="3" placeholder="' + esc(f.ph) + '">' + v + '</textarea>'
            : '<input id="st-' + f.n + '" name="' + f.n + '" type="' + (f.type || 'text') + '" placeholder="' + esc(f.ph) + '" value="' + v + '" autocomplete="' + (f.ac || 'off') + '"' + (f.type === 'tel' ? ' inputmode="tel"' : '') + '>') + '</div>';
        }).join('') + '<p class="st-err" data-err role="alert"></p>';
      }
      if (st.chips) {
        h += '<div class="st-field"><label>' + st.chips.l + (st.chips.optional ? ' <span class="st-opt-note">(' + T('valikuline', 'optional') + ')</span>' : '') + '</label><div class="st-chips">' +
          st.chips.opts.map(function (c) { return '<button type="button" class="st-chip' + (S[st.chips.n] === c ? ' sel' : '') + '" data-chip="' + st.chips.n + '" data-c="' + esc(c) + '">' + c + '</button>'; }).join('') + '</div></div>';
      }
      if (st.summary) {
        var pr = price(); var t = (S.object in P) && S.size ? P[S.object][S.size] : null;
        h += '<div class="st-sum"><dl>';
        if (S.object === 'maakler') {
          h += '<dt>' + T('Kodu', 'Home') + '</dt><dd>' + esc(S.place || '–') + '</dd><dt>' + T('Seis', 'Status') + '</dt><dd>' + (STAGE_LBL()[S.stage] || '–') + '</dd>';
        } else {
          h += '<dt>' + T('Objekt', 'Property') + '</dt><dd>' + (S.object === 'aripind' ? T('Äripind', 'Commercial') + ' – ' + esc(S.desc || '') : (S.object === 'korter' ? T('Korter', 'Apartment') : T('Eramaja', 'House')) + (t ? ', ' + L(t.lbl) : '')) + '</dd>';
          if (S.need) h += '<dt>' + T('Pakett', 'Package') + '</dt><dd>' + NEED_LBL()[S.need] + '</dd>';
          h += '<dt>' + T('Aadress', 'Address') + '</dt><dd>' + esc(S.address || '–') + '</dd><dt>' + T('Millal', 'When') + '</dt><dd>' + esc(S.when || T('kokkuleppel', 'to be agreed')) + '</dd>';
        }
        h += '<dt>' + T('Kontakt', 'Contact') + '</dt><dd>' + esc(S.name || '') + '<br>' + esc(S.phone || '') + ' · ' + esc(S.email || '') + (S.channel ? '<br>' + esc(S.channel) : '') + '</dd></dl>';
        if (pr) h += '<div class="st-total"><small>' + T('Paketi hind · transpordikulu 0,20 €/km lisandub', 'Package price · travel added at 0.20 €/km') + '</small><b>' + pr.prefix + eur(pr.n) + '</b></div>';
        else if (S.object !== 'maakler') h += '<div class="st-total"><small>' + T('Hind pakkumisega, objekti järgi', 'Priced by quote, per property') + '</small><b>' + T('pakkumine', 'quote') + '</b></div>';
        h += '</div>';
        h += '<p class="st-promise"><i></i>' + (S.object === 'maakler'
          ? T('Richard võtab ühendust 24 h jooksul. 15-minutiline vestlus, tasuta ja kohustusteta.', 'Richard will be in touch within 24 h. A 15-minute conversation, free and without obligation.')
          : S.object === 'aripind'
          ? T('Richard võtab ühendust 24 h jooksul ja saadab pakkumise.', 'Richard will be in touch within 24 h with a quote.')
          : T('Richard võtab ühendust 24 h jooksul ja saate aja kokku leppida. Kui on kiire, helista: ', 'Richard will be in touch within 24 h to agree a time. In a hurry? Call ') + '<a href="tel:+37253053253">+372 5305 3253</a>.') + '</p>';
        h += '<p class="st-err" data-err role="alert"></p>';
      }
      if (!st.opts || st.summary) h += '<button type="button" class="st-next" data-next' + (sending ? ' disabled' : '') + '>' + (st.summary ? (sending ? T('Saadan…', 'Sending…') : T('Saada päring', 'Send enquiry')) : T('Edasi', 'Next')) + '</button>' + (st.summary ? '' : '<span class="st-kbd">Enter ↵</span>');
    }
    h += '</div>';
    root.innerHTML = h;
    if (dir !== 'silent') {
      ph('form_step', { step: st.id, n: pos + 1, path: S.object || null });
      var f = root.querySelector('input,textarea');
      if (f && window.matchMedia('(min-width: 900px)').matches) f.focus();
    }
  }

  function validate() {
    var st = steps()[idx]; var ok = true; var err = root.querySelector('[data-err]');
    root.querySelectorAll('input,textarea').forEach(function (el) { S[el.name] = el.value.trim(); el.classList.remove('bad'); });
    if (st.fields) {
      st.fields.forEach(function (f) {
        var v = S[f.n] || ''; var bad = !v;
        if (f.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) bad = true;
        if (f.type === 'tel' && v && v.replace(/\D/g, '').length < 7) bad = true;
        if (bad) { ok = false; var el = root.querySelector('[name="' + f.n + '"]'); if (el) el.classList.add('bad'); }
      });
      if (err) err.textContent = ok ? '' : (st.id === 'contact' ? T('Nimi, telefon ja e-post – kõik kolm on vajalikud.', 'Name, phone and email – all three are needed.') : T('See väli on vajalik.', 'This field is required.'));
    }
    save(); return ok;
  }

  function submit() {
    if (sending) return;
    sending = true; render('silent');
    var fd = new FormData();
    var path = S.object;
    fd.append('_subject', path === 'maakler' ? 'Maakleri nõu päring – kinnisvara.lindjanar.ee' : 'Uus päring – kinnisvara.lindjanar.ee');
    fd.append('path', path);
    ['size', 'need', 'desc', 'place', 'stage', 'address', 'when', 'name', 'phone', 'email', 'channel'].forEach(function (k) { if (S[k]) fd.append(k, S[k]); });
    var pr = price(); if (pr) fd.append('price_estimate', pr.prefix + pr.n);
    fd.append('lang', lang());
    fd.append('_gotcha', '');
    fetch(ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).then(function (res) {
      if (!res.ok) throw new Error('bad response');
      var params = { method: path === 'maakler' ? 'advice_call' : 'contact_form', path: path };
      if (S.need) params.package = S.object + '-' + S.size + '-' + S.need;
      if (pr) { params.value = pr.n; params.currency = 'EUR'; }
      if (typeof window.LINDJANAR_fireLead === 'function') window.LINDJANAR_fireLead('contact', { email: S.email, phone: S.phone }, params);
      ph('form_submit', params);
      var keep = { name: S.name }; S = keep; save();
      history.push(idx); idx++; sending = false; render('fwd');
    }).catch(function () {
      sending = false; render('silent');
      var err = root.querySelector('[data-err]');
      if (err) err.textContent = T('Midagi läks valesti. Proovi uuesti või kirjuta hello@lindjanar.ee.', 'Something went wrong. Try again or email hello@lindjanar.ee.');
    });
  }

  function go(dir) {
    var list = steps(); var cur = root.querySelector('.st-step');
    if (dir === 'next') {
      if (!validate()) return;
      if (list[idx].summary) { submit(); return; }
      history.push(idx); idx++;
    } else { idx = history.length ? history.pop() : Math.max(0, idx - 1); }
    if (cur) cur.classList.add('out');
    setTimeout(function () { render(dir === 'next' ? 'fwd' : 'back'); }, 180);
  }

  root.addEventListener('click', function (e) {
    var o = e.target.closest('.st-opt');
    if (o) { steps()[idx].set(o.dataset.v); save(); root.querySelectorAll('.st-opt').forEach(function (x) { x.classList.toggle('sel', x === o); }); setTimeout(function () { go('next'); }, 140); return; }
    var c = e.target.closest('.st-chip');
    if (c) { S[c.dataset.chip] = c.dataset.c; save(); root.querySelectorAll('[data-chip="' + c.dataset.chip + '"]').forEach(function (x) { x.classList.toggle('sel', x === c); }); return; }
    if (e.target.closest('[data-next]')) go('next');
    if (e.target.closest('[data-back]')) go('back');
    if (e.target.closest('[data-reset]')) { S = {}; save(); idx = 0; history = []; render('fwd'); }
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); go('next'); }
    if (e.key === 'Escape') { if (sheet && sheet.classList.contains('open')) closeSheet(); else go('back'); }
  });
  // language toggle re-renders in the other language
  document.querySelectorAll('[data-lang-toggle], .lang-toggle, #langToggle').forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { render('silent'); }, 0); }); });

  // ---- deep-link / CTA: any element with data-stepper-path opens the form on that path ----
  function startPath(v) { S = {}; steps()[0].set(v); save(); idx = 1; history = [0]; render('fwd'); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-stepper-path]'); if (!a) return;
    e.preventDefault(); startPath(a.getAttribute('data-stepper-path'));
    if (window.matchMedia('(max-width: 640px)').matches) openSheet(); else document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    ph('form_cta', { path: a.getAttribute('data-stepper-path'), from: a.getAttribute('data-stepper-from') || 'link' });
  });

  // ---- phone bottom sheet: move the same form in and out ----
  var sheet = document.getElementById('stepperSheet');
  var home = root.parentNode;
  function openSheet() {
    if (!sheet) return;
    sheet.querySelector('.st-sheet-body').appendChild(root);
    sheet.hidden = false; requestAnimationFrame(function () { sheet.classList.add('open'); });
    document.documentElement.classList.add('st-lock');
    ph('form_sheet_open');
  }
  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove('open'); document.documentElement.classList.remove('st-lock');
    setTimeout(function () { sheet.hidden = true; home.appendChild(root); }, 320);
  }
  if (sheet) {
    sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.closest('[data-sheet-close]')) closeSheet(); });
    var bookBtn = document.querySelector('.mob-bar-book');
    if (bookBtn) bookBtn.addEventListener('click', function (e) { e.preventDefault(); openSheet(); });
  }

  // resume at the first unanswered step, so a reload or a scroll-away
  // never sends someone back to question one
  (function resume() {
    var list = steps();
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      if (st.done || st.summary) { idx = i; break; }
      var answered = st.opts ? !!S[st.id === 'object' ? 'object' : st.id]
        : st.fields ? st.fields.every(function (f) { return !!S[f.n]; }) : true;
      if (!answered) { idx = i; break; }
    }
    if (idx > 0 && list[idx] && list[idx].done) idx = 0;   // finished earlier -> fresh start
    history = []; for (var j = 0; j < idx; j++) history.push(j);
  })();
  render('silent');
})();
