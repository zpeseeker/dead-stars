(function () {
  'use strict';

  const TL_ORDER_KEY = 'dead-stars-tl-order';

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

  /** Markdown-style **bold** → <strong> and *italic* → <em> (data is trusted; not a full MD parser). */
  function formatInlineMd(s) {
    let r = String(s).replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(^|[^*\w])\*([^*\n][^*]*?)\*(?![\w*])/g, '$1<em>$2</em>');
    return r;
  }

  /**
   * Institutional badges for each timeline entry (keys on DATA[].affiliations).
   * All pills use `abbr` text — FA brand icons were unreliable (empty glyphs in some browsers).
   */
  const ORG_BADGES = {
    nasa: { label: 'NASA', abbr: 'NASA' },
    jpl: { label: 'NASA Jet Propulsion Laboratory', abbr: 'JPL' },
    caltech: { label: 'California Institute of Technology', abbr: 'Caltech' },
    ipac: { label: 'Caltech IPAC', abbr: 'IPAC' },
    mit: { label: 'Massachusetts Institute of Technology', abbr: 'MIT' },
    harvard: { label: 'Harvard University', abbr: 'Harvard' },
    cern: { label: 'CERN', abbr: 'CERN' },
    google: { label: 'Google', abbr: 'Google' },
    dod: { label: 'U.S. Department of Defense', abbr: 'DoD' },
    doe: { label: 'U.S. Department of Energy', abbr: 'DOE' },
    lanl: { label: 'Los Alamos National Laboratory', abbr: 'LANL' },
    afrl: { label: 'Air Force Research Laboratory', abbr: 'AFRL' },
    'wright-patterson': { label: 'Wright-Patterson Air Force Base', abbr: 'WPAFB' },
    usaf: { label: 'U.S. Air Force', abbr: 'USAF' },
    darpa: { label: 'Defense Advanced Research Projects Agency', abbr: 'DARPA' },
    nrl: { label: 'Naval Research Laboratory', abbr: 'NRL' },
    onr: { label: 'Office of Naval Research', abbr: 'ONR' },
    fbi: { label: 'Federal Bureau of Investigation', abbr: 'FBI' },
    nsa: { label: 'National Security Agency', abbr: 'NSA' },
    uspto: { label: 'United States Patent and Trademark Office', abbr: 'USPTO' },
    congress: { label: 'United States Congress', abbr: 'Congress' },
    westinghouse: { label: 'Westinghouse Electric', abbr: 'Westinghouse' },
    'continental-edison': { label: 'Continental Edison Company', abbr: 'Edison' },
    oap: { label: 'Office of Alien Property Custodian', abbr: 'OAP' },
    'univ-oslo': { label: 'University of Oslo', abbr: 'UiO' },
    'norsk-hydro': { label: 'Norsk Hydro', abbr: 'Hydro' },
    'us-navy': { label: 'U.S. Navy', abbr: 'USN' },
    tum: { label: 'Technical University of Munich', abbr: 'TUM' },
    man: { label: 'MAN SE', abbr: 'MAN' },
    'british-admiralty': { label: 'British Admiralty', abbr: 'Admiralty' },
    'univ-tehran': { label: 'University of Tehran', abbr: 'Tehran' },
    philips: { label: 'Philips Research', abbr: 'Philips' },
    'univ-washington': { label: 'University of Washington', abbr: 'UW' },
    fda: { label: 'U.S. Food and Drug Administration', abbr: 'FDA' },
    'new-school': { label: 'The New School', abbr: 'New School' },
    pks: { label: 'PKS Institute (Schauberger)', abbr: 'PKS' },
    denison: { label: 'Denison University', abbr: 'Denison' },
    utep: { label: 'University of Texas at El Paso', abbr: 'UTEP' },
    'univ-utah': { label: 'University of Utah', abbr: 'Utah' },
    southampton: { label: 'University of Southampton', abbr: 'Soton' },
    'royal-society': { label: 'Royal Society', abbr: 'RS' },
    uah: { label: 'University of Alabama in Huntsville', abbr: 'UAH' },
    msfc: { label: 'NASA Marshall Space Flight Center', abbr: 'MSFC' },
    jsc: { label: 'NASA Johnson Space Center', abbr: 'JSC' },
    ksc: { label: 'NASA Kennedy Space Center', abbr: 'KSC' },
    freescale: { label: 'Freescale Semiconductor', abbr: 'Freescale' },
    novartis: { label: 'Novartis', abbr: 'Novartis' },
    cfs: { label: 'Commonwealth Fusion Systems', abbr: 'CFS' },
    kcnsc: { label: 'Kansas City National Security Campus', abbr: 'KCNSC' },
    nnsa: { label: 'National Nuclear Security Administration', abbr: 'NNSA' },
    mod: { label: 'UK Ministry of Defence', abbr: 'MoD' },
    gec: { label: 'GEC-Marconi', abbr: 'GEC' },
    sdi: { label: 'Strategic Defense Initiative', abbr: 'SDI' },
    tae: { label: 'TAE Technologies', abbr: 'TAE' },
    'trump-media': { label: 'Trump Media & Technology Group', abbr: 'TMTG' },
    etsu: { label: 'East Tennessee State University', abbr: 'ETSU' },
    greyhound: { label: 'Greyhound Lines', abbr: 'Greyhound' },
    'utah-hosp': { label: 'Utah State Hospital', abbr: 'Utah Hosp' },
    afit: { label: 'Air Force Institute of Technology', abbr: 'AFIT' },
    aflcmc: { label: 'Air Force Life Cycle Management Center', abbr: 'AFLCMC' },
  };

  function renderOrgBadges(ids) {
    if (!ids || !ids.length) return '';
    const parts = [];
    ids.forEach(function (id) {
      const o = ORG_BADGES[id];
      if (!o) return;
      const title = escAttr(o.label);
      const t = escAttr(o.abbr || o.label);
      if (!t) return;
      parts.push(
        '<span class="org-badge org-badge--abbr" role="img" aria-label="' +
          title +
          '" title="' +
          title +
          '">' +
          t +
          '</span>'
      );
    });
    if (!parts.length) return '';
    return (
      '<div class="ch-aff" aria-label="Institutional affiliations">' + parts.join('') + '</div>'
    );
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

  /**
   * DATA[] display order for timeline + nav: sort by yearKey (first year in `entry.year` string).
   * Unparseable years sort to the end (oldest-first) or start (newest-first).
   */
  function orderIndices(newestFirst) {
    const n = DATA.length;
    const pairs = [];
    for (let i = 0; i < n; i++) {
      let k = yearKey(DATA[i]);
      if (k === 0) k = newestFirst ? -1e9 : 1e9;
      pairs.push({ i: i, k: k });
    }
    pairs.sort(function (a, b) {
      if (a.k !== b.k) return newestFirst ? b.k - a.k : a.k - b.k;
      return a.i - b.i;
    });
    return pairs.map(function (p) {
      return p.i;
    });
  }

  /** First entry in chronological order that matches each era (for dock jump chips). */
  function findEraIndices() {
    const chrono = orderIndices(false);
    function firstMatching(pred) {
      for (let j = 0; j < chrono.length; j++) {
        const i = chrono[j];
        const e = DATA[i];
        const y = yearKey(e);
        if (pred(e, y)) return i;
      }
      return -1;
    }
    const pre1950 = firstMatching(function (e, y) {
      return y > 0 && y < 1950;
    });
    const y1950 = firstMatching(function (e, y) {
      return y >= 1950 && y < 1990;
    });
    const y1990 = firstMatching(function (e, y) {
      return y >= 1990 && y < 2020;
    });
    const cluster = firstMatching(function (e, y) {
      return y >= 2022 || /202[3-6]/.test(e.year);
    });
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
  const tlWrap = document.querySelector('.tl-wrap');
  const sbNav = document.getElementById('sb-timeline-nav');
  const mobileJump = document.getElementById('mobile-jump');
  let timelineNewestFirst = false;
  try {
    timelineNewestFirst = localStorage.getItem(TL_ORDER_KEY) === 'newest';
  } catch (_) {}

  const newSet = new Set([
    'Michael David Hicks — JPL Asteroid Scientist',
    'Monica Jacinto Reza',
    'Rep. Burchett &amp; Rep. Burlison — Congressional Voices',
  ]);

  let __galleryUid = 0;
  function renderGallery(images) {
    if (!images || !images.length) return '';
    const gid = 'gal-' + ++__galleryUid;
    const slides = images
      .map(function (im, idx) {
        return (
          '<figure class="tl-gallery__slide" data-gal-idx="' +
          idx +
          '"' +
          (idx === 0 ? '' : ' hidden') +
          '>' +
          '<button type="button" class="tl-gallery__imgbtn" data-gal-zoom="' +
          idx +
          '" aria-label="Zoom image ' +
          (idx + 1) +
          ' of ' +
          images.length +
          '">' +
          '<img class="tl-gallery__img" src="' +
          encodeURI(im.src) +
          '" alt="' +
          escAttr(im.alt || '') +
          '" loading="lazy" decoding="async">' +
          '<span class="tl-gallery__zoom-hint" aria-hidden="true"><i class="fa-solid fa-magnifying-glass-plus"></i></span>' +
          '</button>' +
          '<figcaption class="tl-gallery__cap">' +
          formatInlineMd(im.caption || '') +
          '</figcaption>' +
          '</figure>'
        );
      })
      .join('');
    const dots = images
      .map(function (_, idx) {
        return (
          '<button type="button" class="tl-gallery__dot' +
          (idx === 0 ? ' is-active' : '') +
          '" data-gal-dot="' +
          idx +
          '" aria-label="Go to image ' +
          (idx + 1) +
          '"></button>'
        );
      })
      .join('');
    return (
      '<div class="tl-gallery" id="' +
      gid +
      '" data-gal-count="' +
      images.length +
      '" data-gal-index="0">' +
      '<div class="tl-gallery__viewport">' +
      '<button type="button" class="tl-gallery__nav tl-gallery__nav--prev" data-gal-prev aria-label="Previous image">' +
      '<i class="fa-solid fa-chevron-left"></i>' +
      '</button>' +
      '<div class="tl-gallery__track">' +
      slides +
      '</div>' +
      '<button type="button" class="tl-gallery__nav tl-gallery__nav--next" data-gal-next aria-label="Next image">' +
      '<i class="fa-solid fa-chevron-right"></i>' +
      '</button>' +
      '</div>' +
      '<div class="tl-gallery__bar">' +
      '<span class="tl-gallery__counter"><span data-gal-current>1</span> / ' +
      images.length +
      '</span>' +
      '<div class="tl-gallery__dots" role="tablist">' +
      dots +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function renderSections(sects) {
    if (!sects || !sects.length) return '';
    return sects
      .map(function (s) {
        if (typeof s === 'string') return '<p>' + formatInlineMd(s) + '</p>';
        const h = s.heading ? '<div class="sec-head">' + formatInlineMd(s.heading) + '</div>' : '';
        const b = Array.isArray(s.body)
          ? s.body.map(function (p) {
              return '<p>' + formatInlineMd(p) + '</p>';
            }).join('')
          : s.body
            ? '<p>' + formatInlineMd(s.body) + '</p>'
            : '';
        const fig = s.figure
          ? '<figure class="tl-figure"><img class="tl-figure-img" src="' +
            encodeURI(s.figure.src) +
            '" alt="' +
            escAttr(s.figure.alt || '') +
            '" loading="lazy" decoding="async"><figcaption class="tl-figure-cap">' +
            formatInlineMd(s.figure.caption || '') +
            '</figcaption></figure>'
          : '';
        const gal = s.gallery ? renderGallery(s.gallery) : '';
        return h + b + fig + gal;
      })
      .join('');
  }

  orderIndices(timelineNewestFirst).forEach(function (i) {
    const e = DATA[i];
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
            return '<p>' + formatInlineMd(p) + '</p>';
          })
          .join('');
    const connHtml =
      e.connections && e.connections.length
        ? '<div class="cd-section"><span class="dl g">🔗 Cluster connections</span><div class="cd-body">' +
          e.connections
            .map(function (p) {
              return '<p>' + formatInlineMd(p) + '</p>';
            })
            .join('') +
          '</div></div>'
        : '';
    const offHtml = (Array.isArray(e.off) ? e.off : e.off ? [e.off] : [])
      .map(function (p) {
        return '<p>' + formatInlineMd(p) + '</p>';
      })
      .join('');
    const briefHtml = e.brief ? '<div class="summary-bar">' + formatInlineMd(e.brief) + '</div>' : '';
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
    const affHtml = renderOrgBadges(e.affiliations);
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
      '</div></div>' +
      affHtml +
      '</div></div><div class="cs">' +
      formatInlineMd(e.summary) +
      '</div><div class="eh" id="h' +
      i +
      '" aria-expanded="false" aria-label="Show or hide full history, sources and links">' +
      '<span class="eh__text">' +
      '<span class="eh__row">' +
      '<span class="eh__line"><span class="eh__strong eh__when-collapsed">More</span><span class="eh__strong eh__when-open">Less</span></span>' +
      '<span class="eh__icon" aria-hidden="true"><i class="fa-solid fa-chevron-down eh__chev"></i></span>' +
      '</span>' +
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
      (e.quote ? '<div class="cd-section"><div class="qb">' + formatInlineMd(e.quote) + '</div></div>' : '') +
      linksHtml +
      '</div></div>';
    div.querySelector('.card').addEventListener('click', function (ev) {
      // Don't toggle when interacting with the image carousel or external links.
      if (ev.target.closest('.tl-gallery')) return;
      if (ev.target.closest('a')) return;
      const d = document.getElementById('d' + i);
      const h = document.getElementById('h' + i);
      const o = d.classList.toggle('open');
      h.classList.toggle('is-open', o);
      h.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
    tl.appendChild(div);
  });

  function reorderTimelineDom(newestFirst) {
    if (!tl) return;
    orderIndices(newestFirst).forEach(function (i) {
      const el = document.getElementById('entry-' + i);
      if (el) tl.appendChild(el);
    });
  }

  function populateJumpNav(newestFirst) {
    const indices = orderIndices(newestFirst);
    if (sbNav) {
      sbNav.innerHTML = '<div class="panel__title">Along the timeline</div>';
      const wrap = document.createElement('div');
      wrap.className = 'tl-nav-scroll';
      indices.forEach(function (i) {
        const e = DATA[i];
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
      mobileJump.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = 'Jump to an entry…';
      mobileJump.appendChild(opt0);
      indices.forEach(function (i) {
        const e = DATA[i];
        const opt = document.createElement('option');
        opt.value = String(i);
        const nameDecoded = decodeEntities(e.name);
        opt.textContent =
          e.year +
          ' — ' +
          (nameDecoded.length > 48 ? nameDecoded.slice(0, 46) + '…' : nameDecoded);
        mobileJump.appendChild(opt);
      });
    }
  }

  function applyTimelineOrder(newestFirst) {
    timelineNewestFirst = newestFirst;
    try {
      localStorage.setItem(TL_ORDER_KEY, newestFirst ? 'newest' : 'oldest');
    } catch (_) {}
    if (tlWrap) tlWrap.classList.toggle('tl-wrap--newest-first', newestFirst);
    document.querySelectorAll('[data-tl-order]').forEach(function (btn) {
      const isNewest = btn.getAttribute('data-tl-order') === 'newest';
      const on = isNewest === newestFirst;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    reorderTimelineDom(newestFirst);
    populateJumpNav(newestFirst);
  }

  const era = findEraIndices();
  document.querySelectorAll('[data-era-jump]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const k = btn.getAttribute('data-era-jump');
      const idx = era[k];
      if (idx !== undefined) scrollToEntry(idx);
    });
  });

  if (mobileJump) {
    mobileJump.addEventListener('change', function () {
      const v = mobileJump.value;
      if (v === '') return;
      scrollToEntry(parseInt(v, 10));
      mobileJump.value = '';
    });
  }

  const orderBar = document.getElementById('tl-order-bar');
  if (orderBar) {
    orderBar.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-tl-order]');
      if (!btn || !orderBar.contains(btn)) return;
      const newest = btn.getAttribute('data-tl-order') === 'newest';
      if (newest === timelineNewestFirst) return;
      applyTimelineOrder(newest);
    });
  }

  applyTimelineOrder(timelineNewestFirst);

  const clusterList = document.getElementById('sb-cluster-list');
  if (clusterList) {
    const MODERN_CLUSTER = [
      {
        find: function (e) {
          return /Michael David Hicks/.test(e.name);
        },
        when: 'Jul 2023',
        last: 'Hicks',
        st: 'Dead · JPL',
        cls: 'bad',
      },
      {
        find: function (e) {
          return /Frank Werner Maiwald/.test(e.name);
        },
        when: 'Jul 2024',
        last: 'Maiwald',
        st: 'Dead · JPL',
        cls: 'bad',
      },
      {
        find: function (e) {
          return e.name.indexOf("Tony' Chavez") >= 0;
        },
        when: 'May 2025',
        last: 'Chavez',
        st: 'Missing · LANL',
        cls: 'warn',
      },
      {
        find: function (e) {
          return e.name === 'Monica Jacinto Reza';
        },
        when: 'Jun 2025',
        last: 'Reza',
        st: 'Missing · JPL',
        cls: 'warn',
      },
      {
        find: function (e) {
          return e.name === 'Melissa Casias';
        },
        when: 'Jun 2025',
        last: 'Casias',
        st: 'Missing · LANL-linked',
        cls: 'warn',
      },
      {
        find: function (e) {
          return e.name === 'Jason Thomas';
        },
        when: 'Dec 2025',
        last: 'Thomas',
        st: 'Dead · Novartis',
        cls: 'bad',
      },
      {
        find: function (e) {
          return /Nuno Loureiro/.test(e.name);
        },
        when: 'Dec 2025',
        last: 'Loureiro',
        st: 'Dead · MIT Fusion',
        cls: 'bad',
      },
      {
        find: function (e) {
          return /Carl Grillmair/.test(e.name);
        },
        when: 'Feb 2026',
        last: 'Grillmair',
        st: 'Dead · Caltech',
        cls: 'bad',
      },
      {
        find: function (e) {
          return /William Neil McCasland/.test(e.name);
        },
        when: 'Feb 2026',
        last: 'McCasland',
        st: 'Missing · AFRL',
        cls: 'warn',
      },
    ];
    clusterList.innerHTML = MODERN_CLUSTER.map(function (row) {
      const idx = DATA.findIndex(row.find);
      const href = idx >= 0 ? '#entry-' + idx : '#timeline';
      const who =
        idx >= 0
          ? '<a class="cluster-list__link" href="' +
            escAttr(href) +
            '">' +
            escAttr(row.last) +
            '</a>'
          : escAttr(row.last);
      return (
        '<li class="cluster-list__item"><span class="cluster-list__when">' +
        escAttr(row.when) +
        '</span><span class="cluster-list__who">' +
        who +
        '</span><span class="cluster-list__st cluster-list__st--' +
        escAttr(row.cls) +
        '">' +
        escAttr(row.st) +
        '</span></li>'
      );
    }).join('');
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

  // ─────────────────────────────────────────────
  // Image gallery carousel + click-to-zoom lightbox
  // ─────────────────────────────────────────────
  function galleryGoTo(gal, nextIdx) {
    const count = parseInt(gal.getAttribute('data-gal-count'), 10) || 0;
    if (!count) return;
    let i = ((nextIdx % count) + count) % count;
    gal.setAttribute('data-gal-index', String(i));
    gal.querySelectorAll('[data-gal-idx]').forEach(function (sl) {
      const idx = parseInt(sl.getAttribute('data-gal-idx'), 10);
      if (idx === i) sl.removeAttribute('hidden');
      else sl.setAttribute('hidden', '');
    });
    gal.querySelectorAll('[data-gal-dot]').forEach(function (d) {
      const idx = parseInt(d.getAttribute('data-gal-dot'), 10);
      d.classList.toggle('is-active', idx === i);
    });
    const cur = gal.querySelector('[data-gal-current]');
    if (cur) cur.textContent = String(i + 1);
  }

  document.addEventListener('click', function (ev) {
    const prev = ev.target.closest('[data-gal-prev]');
    const next = ev.target.closest('[data-gal-next]');
    const dot = ev.target.closest('[data-gal-dot]');
    const zoom = ev.target.closest('[data-gal-zoom]');
    if (prev || next || dot || zoom) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    if (prev) {
      const gal = prev.closest('.tl-gallery');
      if (gal) {
        const i = parseInt(gal.getAttribute('data-gal-index'), 10) || 0;
        galleryGoTo(gal, i - 1);
      }
      return;
    }
    if (next) {
      const gal = next.closest('.tl-gallery');
      if (gal) {
        const i = parseInt(gal.getAttribute('data-gal-index'), 10) || 0;
        galleryGoTo(gal, i + 1);
      }
      return;
    }
    if (dot) {
      const gal = dot.closest('.tl-gallery');
      if (gal) {
        galleryGoTo(gal, parseInt(dot.getAttribute('data-gal-dot'), 10) || 0);
      }
      return;
    }
    if (zoom) {
      const gal = zoom.closest('.tl-gallery');
      if (gal) openLightbox(gal);
      return;
    }
  });

  // Keyboard nav: when a gallery is focused / hovered, arrow keys move.
  document.addEventListener('keydown', function (ev) {
    if (lightboxEl && lightboxEl.classList.contains('is-open')) {
      if (ev.key === 'Escape') {
        closeLightbox();
      } else if (ev.key === 'ArrowLeft') {
        lightboxStep(-1);
      } else if (ev.key === 'ArrowRight') {
        lightboxStep(1);
      }
      return;
    }
  });

  // ─── Lightbox ──────────────────────────────────
  let lightboxEl = null;
  let lightboxImgEl = null;
  let lightboxCapEl = null;
  let lightboxCounterEl = null;
  let lightboxActiveGal = null;
  let lightboxActiveIdx = 0;

  function ensureLightbox() {
    if (lightboxEl) return;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'tl-lightbox';
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-label', 'Image viewer');
    lightboxEl.innerHTML =
      '<button type="button" class="tl-lightbox__close" aria-label="Close">' +
      '<i class="fa-solid fa-xmark"></i>' +
      '</button>' +
      '<button type="button" class="tl-lightbox__nav tl-lightbox__nav--prev" aria-label="Previous image">' +
      '<i class="fa-solid fa-chevron-left"></i>' +
      '</button>' +
      '<button type="button" class="tl-lightbox__nav tl-lightbox__nav--next" aria-label="Next image">' +
      '<i class="fa-solid fa-chevron-right"></i>' +
      '</button>' +
      '<div class="tl-lightbox__stage">' +
      '<img class="tl-lightbox__img" alt="">' +
      '<div class="tl-lightbox__meta">' +
      '<span class="tl-lightbox__counter"></span>' +
      '<div class="tl-lightbox__cap"></div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(lightboxEl);
    lightboxImgEl = lightboxEl.querySelector('.tl-lightbox__img');
    lightboxCapEl = lightboxEl.querySelector('.tl-lightbox__cap');
    lightboxCounterEl = lightboxEl.querySelector('.tl-lightbox__counter');

    lightboxEl.addEventListener('click', function (ev) {
      if (ev.target.closest('.tl-lightbox__close')) {
        closeLightbox();
        return;
      }
      if (ev.target.closest('.tl-lightbox__nav--prev')) {
        lightboxStep(-1);
        return;
      }
      if (ev.target.closest('.tl-lightbox__nav--next')) {
        lightboxStep(1);
        return;
      }
      // click on backdrop (not on img/meta) closes
      if (ev.target === lightboxEl || ev.target.classList.contains('tl-lightbox__stage')) {
        closeLightbox();
      }
    });

    // Toggle zoom on image click
    lightboxImgEl.addEventListener('click', function (ev) {
      ev.stopPropagation();
      lightboxImgEl.classList.toggle('is-zoomed');
    });
  }

  function openLightbox(gal) {
    ensureLightbox();
    lightboxActiveGal = gal;
    lightboxActiveIdx = parseInt(gal.getAttribute('data-gal-index'), 10) || 0;
    updateLightbox();
    lightboxEl.classList.add('is-open');
    document.body.classList.add('tl-lightbox-open');
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('is-open');
    if (lightboxImgEl) lightboxImgEl.classList.remove('is-zoomed');
    document.body.classList.remove('tl-lightbox-open');
    lightboxActiveGal = null;
  }

  function lightboxStep(delta) {
    if (!lightboxActiveGal) return;
    const count = parseInt(lightboxActiveGal.getAttribute('data-gal-count'), 10) || 0;
    if (!count) return;
    lightboxActiveIdx = ((lightboxActiveIdx + delta) % count + count) % count;
    galleryGoTo(lightboxActiveGal, lightboxActiveIdx);
    updateLightbox();
  }

  function updateLightbox() {
    if (!lightboxActiveGal || !lightboxImgEl) return;
    const count = parseInt(lightboxActiveGal.getAttribute('data-gal-count'), 10) || 0;
    const slide = lightboxActiveGal.querySelector('[data-gal-idx="' + lightboxActiveIdx + '"]');
    if (!slide) return;
    const img = slide.querySelector('img');
    const cap = slide.querySelector('.tl-gallery__cap');
    if (img) {
      lightboxImgEl.src = img.src;
      lightboxImgEl.alt = img.alt || '';
      lightboxImgEl.classList.remove('is-zoomed');
    }
    if (lightboxCapEl && cap) lightboxCapEl.innerHTML = cap.innerHTML;
    else if (lightboxCapEl) lightboxCapEl.innerHTML = '';
    if (lightboxCounterEl) {
      lightboxCounterEl.textContent = lightboxActiveIdx + 1 + ' / ' + count;
    }
  }
})();
