(() => {
  let theme = 'light';
  try { theme = localStorage.getItem('spandr-theme') === 'dark' ? 'dark' : 'light'; } catch { /* preference storage is optional */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1d2c27' : '#f2ecdf');
})();
