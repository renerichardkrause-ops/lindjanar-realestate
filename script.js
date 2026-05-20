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
