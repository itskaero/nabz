/*
 * The mobile menu.
 *
 * Below the breakpoint the nav links used to be display:none with nothing in
 * their place, so a phone could reach the logo and the GitHub button and no
 * page of the site at all. This gives them somewhere to go.
 *
 * Kept to plain DOM on purpose: the whole site is three static files and adding
 * a framework to open a menu would be the wrong trade.
 */
(function () {
  var toggle = document.querySelector('.navtoggle');
  var links = document.querySelector('.nav .links');
  if (!toggle || !links) return;

  function setOpen(open) {
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Tapping a destination should take you there, not leave the menu hanging
  // open over the thing you just asked for.
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setOpen(false);
  });

  document.addEventListener('click', function (e) {
    if (!links.contains(e.target) && e.target !== toggle) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  // Coming back over the breakpoint must not leave the panel stuck open on a
  // layout that no longer has a menu button to close it with.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 820) setOpen(false);
  });
})();
