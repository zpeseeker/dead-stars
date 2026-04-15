(function () {
  'use strict';

  function escAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function decodeEntities(s) {
    return String(s)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }

  function yearKey(entry) {
    const s = String(entry.year);
    const multi = s.match(/(\d{4})/g);
    if (multi && multi.length) return parseInt(multi[0], 10);
    const decade = s.match(/^(\d{4})s/);
    if (decade) return parseInt(decade[1], 10);
    const end = s.match(/(\d{4})\s*$/);
    if (end) return parseInt(end[1], 10);
    const mon = s.match(
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i
    );
    if (mon) return parseInt(mon[2], 10);
    return 0;
  }

  function findEraIndices() {
    const pre1950 = DATA.findIndex((e) => yearKey(e) > 0 && yearKey(e) < 1950);
    const y1950 = DATA.findIndex((e) => yearKey(e) >= 1950 && yearKey(e) < 1990);
    const y1990 = DATA.findIndex((e) => yearKey(e) >= 1990 && yearKey(e) < 2020);
    const cluster = DATA.findIndex((e) => yearKey(e) >= 2022 || /202[3-6]/.test(e.year));
    return {
      pre1950: pre1950 >= 0 ? pre1950 : 0,
      mid: y1950 >= 0 ? y1950 : 0,
      recent: y1990 >= 0 ? y1990 : 0,
      cluster: cluster >= 0 ? cluster : Math.max(0, DATA.length - 9),
    };
  }

  function scrollToEntry(index) {
    const el = document.getElementById('entry-' + index);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try {
        history.replaceState(null, '', '#entry-' + index);
      } catch (_) {}
    }
  }

  function applyHash() {
    const m = /^#entry-(\d+)$/.exec(location.hash || '');
    if (!m) return;
    const i = parseInt(m[1], 10);
    if (i >= 0 && i < DATA.length) {
      requestAnimationFrame(function () {
        scrollToEntry(i);
      });
    }
  }

  const ct = {
    death: 0,
    suppressed: 0,
    plasma: 0,
    classified: 0,
    misfortune: 0,
    aerospace: 0,
    network: 0,
  };
  DATA.forEach(function (e) {
    e.tags.forEach(function (t) {
      if (ct[t] !== undefined) ct[t]++;
    });
  });
  Object.keys(ct).forEach(function (k) {
    const el = document.getElementById('c-' + k);
    if (el) el.textContent = ct[k];
  });
  const totalEl = document.getElementById('c-total');
  if (totalEl) totalEl.textContent = DATA.length;

  const cMap = {};
  DATA.forEach(function (e) {
    if (e.diedIn) cMap[e.diedIn] = (cMap[e.diedIn] || 0) + 1;
  });
  const maxC = Math.max.apply(null, Object.values(cMap).concat([1]));
  const cEl = document.getElementById('sb-countries');
  if (cEl) {
    cEl.innerHTML =
      '<div class="panel__title">By country of incident</div>' +
      Object.entries(cMap)
        .sort(function (a, b) {
          return b[1] - a[1];
        })
        .map(function ([c, n]) {
          return (
            '<div class="stat-row"><span class="stat-row__label">' +
            escAttr(c) +
            '</span><span class="stat-row__num">' +
            n +
            '</span></div><div class="bar-track"><div class="bar-fill" style="width:' +
            Math.round((n / maxC) * 100) +
            '%"></div></div>'
          );
        })
        .join('');
  }

  const totalDeaths = DATA.filter(function (e) {
    return e.tags.indexOf('death') >= 0;
  }).length;
  const totalSupp = DATA.filter(function (e) {
    return e.tags.indexOf('suppressed') >= 0;
  }).length;
  const stillMissing = DATA.filter(function (e) {
    return e.diedLabel && e.diedLabel.indexOf('Missing') >= 0;
  }).length;
  const sEl = document.getElementById('sb-quickstats');
  if (sEl) {
    sEl.innerHTML =
      '<div class="panel__title">Quick stats</div>' +
      '<div class="stat-row"><span class="stat-row__label">Total documented cases</span><span class="stat-row__num">' +
      DATA.length +
      '</span></div>' +
      '<div class="stat-row"><span class="stat-row__label">Deaths / suspicious deaths</span><span class="stat-row__num">' +
      totalDeaths +
      '</span></div>' +
      '<div class="stat-row"><span class="stat-row__label">Suppressed / classified</span><span class="stat-row__num">' +
      totalSupp +
      '</span></div>' +
      '<div class="stat-row"><span class="stat-row__label">Currently missing (known)</span><span class="stat-row__num">' +
      stillMissing +
      '</span></div>' +
      '<div class="stat-row"><span class="stat-row__label">Modern cluster (2023–26)</span><span class="stat-row__num">10</span></div>' +
      '<div class="stat-row"><span class="stat-row__label">Active secrecy orders (2017)</span><span class="stat-row__num">5,784</span></div>' +
      '<div class="stat-row"><span class="stat-row__label">Congressmen on record</span><span class="stat-row__num">2</span></div>';
  }

  const tl = document.getElementById('tl');
  const newSet = new Set([
    'Michael David Hicks — JPL Asteroid Scientist',
    'Monica Jacinto Reza',
    'Rep. Burchett &amp; Rep. Burlison — Congressional Voices',
  ]);

  function renderSections(sects) {
    if (!sects || !sects.length) return '';
    return sects
      .map(function (s) {
        if (typeof s === 'string') return '<p>' + s + '</p>';
        const h = s.heading ? '<div class="sec-head">' + s.heading + '</div>' : '';
        const b = Array.isArray(s.body)
          ? s.body.map(function (p) {
              return '<p>' + p + '</p>';
            }).join('')
          : s.body
            ? '<p>' + s.body + '</p>'
            : '';
        const fig = s.figure
          ? '<figure class="tl-figure"><img class="tl-figure-img" src="' +
            encodeURI(s.figure.src) +
            '" alt="' +
            escAttr(s.figure.alt || '') +
            '" loading="lazy" decoding="async"><figcaption class="tl-figure-cap">' +
            (s.figure.caption || '') +
            '</figcaption></figure>'
          : '';
        return h + b + fig;
      })
      .join('');
  }

  DATA.forEach(function (e, i) {
    const div = document.createElement('div');
    div.className = 'entry';
    div.id = 'entry-' + i;
    div.setAttribute('data-tags', e.tags.join(' '));
    const nm = newSet.has(e.name) ? '<span class="nb">NEW</span>' : '';
    const br = '<div class="flag-row"><span>' + e.bornFlag + '</span>born</div>';
    const dl = e.diedLabel || '';
    const dr = e.diedFlag
      ? '<div class="flag-row"><span>' + e.diedFlag + '</span>died</div>'
        : dl.indexOf('alive') >= 0
        ? '<div class="flag-row flag-row--ok"><span>✓</span>alive</div>'
        : dl.indexOf('Missing') >= 0
          ? '<div class="flag-row flag-row--warn"><span>?</span>missing</div>'
          : dl.indexOf('Active') >= 0 ||
              dl.indexOf('pending') >= 0 ||
              dl.indexOf('active') >= 0
            ? '<div class="flag-row flag-row--warn"><span>⊘</span>ongoing</div>'
            : '';
    const conHtml = e.sections
      ? renderSections(e.sections)
      : (Array.isArray(e.con) ? e.con : e.con ? [e.con] : [])
          .map(function (p) {
            return '<p>' + p + '</p>';
          })
          .join('');
    const connHtml =
      e.connections && e.connections.length
        ? '<div class="cd-section"><span class="dl g">🔗 Cluster connections</span><div class="cd-body">' +
          e.connections
            .map(function (p) {
              return '<p>' + p + '</p>';
            })
            .join('') +
          '</div></div>'
        : '';
    const offHtml = (Array.isArray(e.off) ? e.off : e.off ? [e.off] : [])
      .map(function (p) {
        return '<p>' + p + '</p>';
      })
      .join('');
    const briefHtml = e.brief ? '<div class="summary-bar">' + e.brief + '</div>' : '';
    const linksHtml =
      e.links && e.links.length
        ? '<div class="cd-section"><span class="dl g">📚 Further Reading &amp; Sources</span><div class="links-grid">' +
          e.links
            .map(function (pair) {
              const l = pair[0];
              const u = pair[1];
              return (
                '<a href="' +
                u +
                '" target="_blank" rel="noopener noreferrer" class="ext-link">' +
                l +
                ' ↗</a>'
              );
            })
            .join('') +
          '</div></div>'
        : '';
    const photoHtml = e.photo
      ? '<div class="ch-photo-wrap"><img class="profile-photo" src="' +
        encodeURI(e.photo) +
        '" alt="' +
        escAttr(e.name) +
        '" width="168" height="168" loading="lazy" decoding="async"></div>'
      : '';
    div.innerHTML =
      '<div class="ey"><div class="ey-year">' +
      e.year +
      '</div><div class="ey-flags">' +
      br +
      dr +
      '</div></div><div class="edw"><div class="edot d-' +
      e.type +
      '"></div></div><div class="card"><div class="ch">' +
      photoHtml +
      '<div class="ch-text"><div class="ch-row"><div class="chl"><div class="cn">' +
      e.name +
      nm +
      '</div><div class="cr">' +
      e.role +
      '</div></div><div class="cb b-' +
      e.type +
      '">' +
      e.badge +
      '</div></div></div></div><div class="cs">' +
      e.summary +
      '</div><div class="eh" id="h' +
      i +
      '" aria-expanded="false" aria-label="Show or hide full history, sources and links">' +
      '<span class="eh__icon" aria-hidden="true">' +
      '<svg class="eh__chev" viewBox="0 0 24 24" width="24" height="24" focusable="false">' +
      '<path fill="currentColor" d="M12 15.4 4.6 8l1.4-1.4L12 12.5l6-5.9L19.4 8z"/>' +
      '</svg>' +
      '</span>' +
      '<span class="eh__text">' +
      '<span class="eh__line"><span class="eh__strong eh__when-collapsed">More</span><span class="eh__strong eh__when-open">Less</span></span>' +
      '<span class="eh__sub">Full history · sources · links</span>' +
      '</span>' +
      '</div><div class="cd" id="d' +
      i +
      '">' +
      (conHtml
        ? '<div class="cd-section"><span class="dl r">☢ Full history &amp; what researchers claim</span>' +
          briefHtml +
          '<div class="cd-body">' +
          conHtml +
          '</div></div>'
        : '') +
      connHtml +
      (offHtml
        ? '<div class="cd-section"><span class="dl b">⬛ Official verdict &amp; confirmed facts</span><div class="cd-body">' +
          offHtml +
          '</div></div>'
        : '') +
      (e.quote ? '<div class="cd-section"><div class="qb">' + e.quote + '</div></div>' : '') +
      linksHtml +
      '</div></div>';
    div.querySelector('.card').addEventListener('click', function () {
      const d = document.getElementById('d' + i);
      const h = document.getElementById('h' + i);
      const o = d.classList.toggle('open');
      h.classList.toggle('is-open', o);
      h.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
    tl.appendChild(div);
  });

  const era = findEraIndices();
  document.querySelectorAll('[data-era-jump]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const k = btn.getAttribute('data-era-jump');
      const idx = era[k];
      if (idx !== undefined) scrollToEntry(idx);
    });
  });

  const sbNav = document.getElementById('sb-timeline-nav');
  const mobileJump = document.getElementById('mobile-jump');
  if (sbNav) {
    sbNav.innerHTML = '<div class="panel__title">Along the timeline</div>';
    const wrap = document.createElement('div');
    wrap.className = 'tl-nav-scroll';
    DATA.forEach(function (e, i) {
      const raw = decodeEntities(e.name);
      const shortName = raw.length > 42 ? raw.slice(0, 40) + '…' : raw;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl-jump';
      const y = document.createElement('span');
      y.className = 'tl-jump-year';
      y.textContent = e.year;
      b.appendChild(y);
      b.appendChild(document.createTextNode(shortName));
      b.addEventListener('click', function () {
        scrollToEntry(i);
      });
      wrap.appendChild(b);
    });
    sbNav.appendChild(wrap);
  }
  if (mobileJump) {
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Jump to an entry…';
    mobileJump.appendChild(opt0);
    DATA.forEach(function (e, i) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent =
        e.year +
        ' — ' +
        (decodeEntities(e.name).length > 48
          ? decodeEntities(e.name).slice(0, 46) + '…'
          : decodeEntities(e.name));
      mobileJump.appendChild(opt);
    });
    mobileJump.addEventListener('change', function () {
      const v = mobileJump.value;
      if (v === '') return;
      scrollToEntry(parseInt(v, 10));
      mobileJump.value = '';
    });
  }

  function setFilter(tag) {
    document.querySelectorAll('#filter-bar [data-filter]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-filter') === tag);
    });
    document.querySelectorAll('.entry').forEach(function (el) {
      const t = el.getAttribute('data-tags') || '';
      el.classList.toggle('hidden', tag !== 'all' && t.indexOf(tag) < 0);
    });
  }

  const filterBar = document.getElementById('filter-bar');
  if (filterBar) {
    filterBar.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-filter]');
      if (!btn || !filterBar.contains(btn)) return;
      const tag = btn.getAttribute('data-filter');
      if (tag) setFilter(tag);
    });
  }

  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
