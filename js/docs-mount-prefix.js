/**
 * Runs synchronously in <head> before stylesheets — fixes /mysql/ and /productDoc/ mounts
 * where relative css/images would otherwise resolve to the site root.
 */
(function () {
  'use strict';
  var path = (location.pathname || '').replace(/\\/g, '/');

  function docMountPrefix() {
    var markers = ['/mysql/', '/productDoc/', '/docs-site/'];
    var i;
    for (i = 0; i < markers.length; i++) {
      var m = markers[i];
      var idx = path.indexOf(m);
      if (idx !== -1) {
        return path.slice(0, idx) + m;
      }
    }
    if (/\/mysql$/i.test(path)) {
      return path + '/';
    }
    return '';
  }

  function resolveDocUrl(relative, mp) {
    if (!relative || /^(https?:|\/\/|#|data:|mailto:)/i.test(relative)) {
      return relative;
    }
    if (relative.indexOf('../') === 0) {
      return mp + relative.slice(3);
    }
    if (relative.indexOf('./') === 0) {
      return mp + relative.slice(2);
    }
    if (relative.charAt(0) === '/') {
      return relative;
    }
    return mp + relative;
  }

  var mp = docMountPrefix();
  if (!mp) {
    return;
  }
  window.__DOC_MOUNT_PREFIX__ = mp;

  var links = document.getElementsByTagName('link');
  var j;
  for (j = 0; j < links.length; j++) {
    var link = links[j];
    if (link.getAttribute('rel') !== 'stylesheet') {
      continue;
    }
    var href = link.getAttribute('href');
    if (href) {
      link.setAttribute('href', resolveDocUrl(href, mp));
    }
  }
})();
