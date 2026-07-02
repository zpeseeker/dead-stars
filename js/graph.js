/* ─────────────────────────────────────────────────────────────
   graph.js — "Relationship Map": a force-directed network of every
   documented figure linked to the institutions they worked for.
   People ↔ organizations (via DATA[].affiliations); shared agencies
   pull the players into clusters. Dependency-free canvas + a small
   spring/repulsion simulation. Hover to trace links, drag to arrange,
   scroll to zoom, click a person to open their timeline case.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  if (typeof DATA === 'undefined') return;
  var stage = document.getElementById('netmap-stage');
  var canvas = document.getElementById('netmap-canvas');
  if (!stage || !canvas) return;
  var ctx = canvas.getContext('2d');
  var tipEl = document.getElementById('netmap-tip');
  var legendEl = document.getElementById('netmap-legend');
  var focusEl = document.getElementById('netmap-focus');
  var resetBtn = document.getElementById('netmap-reset');

  var meta = window.DEAD_STARS || {};
  var ORG_BADGES = meta.ORG_BADGES || {};
  var SHIPPED_LOGOS = meta.SHIPPED_LOGOS || {};
  var LOGO_ALIAS = meta.LOGO_ALIAS || {};
  var slugByIndex = meta.slugByIndex || [];

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CAT = {
    death: '#ff4d6d',
    suppressed: '#ff9e3d',
    plasma: '#b98cff',
    classified: '#38bdf8',
    misfortune: '#2dd4bf',
    aerospace: '#4ade80',
    network: '#d946ef',
  };
  var CAT_LABEL = {
    death: 'Deaths',
    suppressed: 'Suppressed',
    plasma: 'Plasma / Fusion',
    classified: 'Classified',
    misfortune: 'Misfortune',
    aerospace: 'Aerospace',
    network: 'Network',
  };

  function decodeEntities(s) {
    return String(s)
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }
  function stripTags(s) { return decodeEntities(String(s).replace(/<[^>]+>/g, '')); }
  function shortName(name) {
    var n = stripTags(name);
    var comma = n.indexOf(',');
    return comma > 2 ? n.slice(0, comma) : n;
  }

  // ── Build the graph ──────────────────────────────────────────
  var nodes = [];
  var edges = [];
  var orgIndex = {}; // key -> node
  var byId = {};

  DATA.forEach(function (e, i) {
    var cat = CAT[e.type] ? e.type : (e.tags && e.tags[0]) || 'classified';
    var node = {
      id: 'p' + i,
      kind: 'person',
      label: shortName(e.name),
      full: stripTags(e.name),
      role: e.role ? stripTags(e.role) : '',
      cat: cat,
      color: CAT[cat] || '#8aa0c8',
      idx: i,
      r: 6,
      deg: 0,
    };
    nodes.push(node);
    byId[node.id] = node;
  });

  DATA.forEach(function (e, i) {
    var affs = e.affiliations || [];
    affs.forEach(function (key) {
      if (!ORG_BADGES[key]) return;
      var org = orgIndex[key];
      if (!org) {
        var file = LOGO_ALIAS[key] || key;
        org = {
          id: 'o' + key,
          kind: 'org',
          key: key,
          label: ORG_BADGES[key].abbr || key,
          full: ORG_BADGES[key].label || key,
          logo: SHIPPED_LOGOS[file] ? 'img/logos/' + file + '.webp' : null,
          img: null,
          r: 12,
          deg: 0,
          color: '#9fb4e6',
        };
        orgIndex[key] = org;
        byId[org.id] = org;
        nodes.push(org);
      }
      edges.push({ a: byId['p' + i], b: org });
      org.deg++;
      byId['p' + i].deg++;
    });
  });

  // Size org nodes by how many people they connect.
  nodes.forEach(function (n) {
    if (n.kind === 'org') n.r = 11 + Math.min(16, Math.sqrt(n.deg) * 4);
    else n.r = 5 + Math.min(4, n.deg);
  });

  // Preload org logos for on-node rendering.
  nodes.forEach(function (n) {
    if (n.kind === 'org' && n.logo) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { n.img = im; };
      im.src = n.logo;
    }
  });

  // Seed positions on a circle (deterministic — no Math.random needed).
  var N = nodes.length;
  nodes.forEach(function (n, k) {
    var ang = (k / N) * Math.PI * 2;
    var rad = n.kind === 'org' ? 120 : 260;
    n.x = Math.cos(ang) * rad;
    n.y = Math.sin(ang) * rad;
    n.vx = 0;
    n.vy = 0;
  });

  // ── View state ───────────────────────────────────────────────
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var scale = 1, tx = 0, ty = 0;
  var alpha = 1;
  var hovered = null, selected = null, dragging = null, panning = false;
  var lastPX = 0, lastPY = 0, downX = 0, downY = 0, moved = false;

  function resize() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }

  function fit() {
    // Center the layout in the viewport.
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    nodes.forEach(function (n) {
      if (n.x < minx) minx = n.x;
      if (n.y < miny) miny = n.y;
      if (n.x > maxx) maxx = n.x;
      if (n.y > maxy) maxy = n.y;
    });
    var gw = Math.max(1, maxx - minx), gh = Math.max(1, maxy - miny);
    var s = Math.min(W / (gw + 120), H / (gh + 120));
    scale = Math.max(0.25, Math.min(1.6, s));
    tx = W / 2 - ((minx + maxx) / 2) * scale;
    ty = H / 2 - ((miny + maxy) / 2) * scale;
  }

  // ── Simulation step ──────────────────────────────────────────
  function step() {
    var repulse = 5200;
    for (var i = 0; i < N; i++) {
      var a = nodes[i];
      if (a === dragging) continue;
      for (var j = i + 1; j < N; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy + 0.01;
        var d = Math.sqrt(d2);
        var f = (repulse * alpha) / d2;
        var fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        if (b !== dragging) { b.vx -= fx; b.vy -= fy; }
      }
    }
    edges.forEach(function (e) {
      var a = e.a, b = e.b;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      var ideal = 70 + (a.r + b.r);
      var f = ((d - ideal) * 0.015 * alpha);
      var fx = (dx / d) * f, fy = (dy / d) * f;
      if (a !== dragging) { a.vx += fx; a.vy += fy; }
      if (b !== dragging) { b.vx -= fx; b.vy -= fy; }
    });
    for (var k = 0; k < N; k++) {
      var n = nodes[k];
      if (n === dragging) { n.vx = 0; n.vy = 0; continue; }
      n.vx += -n.x * 0.006 * alpha;
      n.vy += -n.y * 0.006 * alpha;
      n.vx *= 0.86; n.vy *= 0.86;
      n.x += n.vx; n.y += n.vy;
    }
    if (alpha > 0.05) alpha *= 0.992;
  }

  // ── Rendering ────────────────────────────────────────────────
  function neighborsOf(node) {
    var set = {};
    if (!node) return set;
    edges.forEach(function (e) {
      if (e.a === node) set[e.b.id] = 1;
      if (e.b === node) set[e.a.id] = 1;
    });
    return set;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    var active = hovered || selected;
    var nbr = active ? neighborsOf(active) : null;

    // Edges
    ctx.lineWidth = 1 / scale;
    edges.forEach(function (e) {
      var on = active && (e.a === active || e.b === active);
      ctx.strokeStyle = on
        ? 'rgba(103,232,249,0.55)'
        : active
          ? 'rgba(150,180,255,0.05)'
          : 'rgba(150,180,255,0.13)';
      ctx.lineWidth = (on ? 1.6 : 1) / scale;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    });

    // Nodes
    nodes.forEach(function (n) {
      var dim = active && n !== active && !(nbr && nbr[n.id]);
      ctx.globalAlpha = dim ? 0.22 : 1;
      if (n.kind === 'org') {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(12,16,28,0.96)';
        ctx.fill();
        ctx.lineWidth = (n === active ? 2 : 1.2) / scale;
        ctx.strokeStyle = n === active ? '#67e8f9' : 'rgba(103,232,249,0.5)';
        ctx.stroke();
        if (n.img) {
          var s = n.r * 1.35;
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r - 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.globalAlpha = dim ? 0.2 : 0.92;
          ctx.drawImage(n.img, n.x - s / 2, n.y - s / 2, s, s);
          ctx.restore();
        }
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n === active) {
          ctx.lineWidth = 2 / scale;
          ctx.strokeStyle = '#e6ecff';
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });

    // Labels: orgs always; people when active/neighbor or zoomed in.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    nodes.forEach(function (n) {
      var isPerson = n.kind === 'person';
      var showP = active && (n === active || (nbr && nbr[n.id]));
      if (isPerson && !showP && scale < 1.15) return;
      var dim = active && n !== active && !(nbr && nbr[n.id]);
      if (dim && isPerson) return;
      ctx.globalAlpha = dim ? 0.35 : 1;
      var fs = (n.kind === 'org' ? 11 : 10.5) / scale;
      ctx.font =
        (n.kind === 'org' ? '600 ' : '500 ') + fs + 'px "JetBrains Mono", monospace';
      var label = n.label;
      var ly = n.y + n.r + 3 / scale;
      // readability backing
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(5,6,13,0.7)';
      ctx.fillRect(n.x - tw / 2 - 3 / scale, ly - 1 / scale, tw + 6 / scale, fs + 4 / scale);
      ctx.fillStyle = n.kind === 'org' ? '#c7d4f5' : '#e6ecff';
      ctx.fillText(label, n.x, ly);
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  var running = false;
  function frame() {
    if (!running) return;
    if (!reduceMotion) step();
    draw();
    requestAnimationFrame(frame);
  }

  // ── Interaction ──────────────────────────────────────────────
  function toWorld(px, py) {
    return { x: (px - tx) / scale, y: (py - ty) / scale };
  }
  function pickNode(px, py) {
    var w = toWorld(px, py);
    var best = null, bestD = 1e9;
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      var dx = n.x - w.x, dy = n.y - w.y;
      var d = dx * dx + dy * dy;
      var rr = (n.r + 6) * (n.r + 6);
      if (d < rr && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }
  function relPos(ev) {
    var rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function showTip(n, px, py) {
    if (!tipEl) return;
    if (!n) { tipEl.classList.remove('is-on'); return; }
    var html;
    if (n.kind === 'org') {
      html = '<strong>' + n.full + '</strong><span>' + n.deg + ' linked ' + (n.deg === 1 ? 'person' : 'people') + '</span>';
    } else {
      html = '<strong>' + n.full + '</strong>' + (n.role ? '<span>' + n.role.slice(0, 90) + '</span>' : '') +
        '<em>Click to open case</em>';
    }
    tipEl.innerHTML = html;
    tipEl.classList.add('is-on');
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var x = Math.min(Math.max(8, px + 14), W - tw - 8);
    var y = Math.min(Math.max(8, py + 14), H - th - 8);
    tipEl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  canvas.addEventListener('mousemove', function (ev) {
    var p = relPos(ev);
    if (dragging) {
      var w = toWorld(p.x, p.y);
      dragging.x = w.x; dragging.y = w.y; dragging.vx = 0; dragging.vy = 0;
      moved = true;
      alpha = Math.max(alpha, 0.25);
      showTip(dragging, p.x, p.y);
      return;
    }
    if (panning) {
      tx += p.x - lastPX; ty += p.y - lastPY;
      lastPX = p.x; lastPY = p.y;
      return;
    }
    var n = pickNode(p.x, p.y);
    hovered = n;
    canvas.style.cursor = n ? (n.kind === 'person' ? 'pointer' : 'grab') : 'grab';
    showTip(n, p.x, p.y);
    if (reduceMotion) draw();
  });

  canvas.addEventListener('mousedown', function (ev) {
    var p = relPos(ev);
    downX = p.x; downY = p.y; moved = false;
    var n = pickNode(p.x, p.y);
    if (n) { dragging = n; canvas.style.cursor = 'grabbing'; }
    else { panning = true; lastPX = p.x; lastPY = p.y; canvas.style.cursor = 'grabbing'; }
  });

  window.addEventListener('mouseup', function (ev) {
    if (dragging && !moved) {
      // treated as a click
      selected = (selected === dragging) ? null : dragging;
      if (dragging.kind === 'person' && selected === dragging) {
        var slug = slugByIndex[dragging.idx];
        if (slug) { location.hash = slug; }
      }
      updateLegendActive();
    }
    dragging = null; panning = false;
    if (reduceMotion) draw();
  });

  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var p = relPos(ev);
    var before = toWorld(p.x, p.y);
    var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    scale = Math.max(0.25, Math.min(3, scale * factor));
    // keep the point under the cursor stable
    tx = p.x - before.x * scale;
    ty = p.y - before.y * scale;
    if (reduceMotion) draw();
  }, { passive: false });

  canvas.addEventListener('mouseleave', function () {
    hovered = null; showTip(null);
    if (reduceMotion) draw();
  });

  // ── Legend + focus control ───────────────────────────────────
  function buildLegend() {
    if (!legendEl) return;
    var used = {};
    nodes.forEach(function (n) { if (n.kind === 'person') used[n.cat] = 1; });
    var html = '<span class="netmap__legend-title">Players</span>';
    Object.keys(CAT).forEach(function (k) {
      if (!used[k]) return;
      html += '<span class="netmap__key"><span class="netmap__dot" style="background:' + CAT[k] + '"></span>' + CAT_LABEL[k] + '</span>';
    });
    html += '<span class="netmap__key"><span class="netmap__dot netmap__dot--org"></span>Organization</span>';
    legendEl.innerHTML = html;
  }
  function updateLegendActive() { /* reserved for future filtering */ }

  function buildFocus() {
    if (!focusEl) return;
    var orgs = nodes.filter(function (n) { return n.kind === 'org'; })
      .sort(function (a, b) { return b.deg - a.deg; });
    var html = '<option value="">All organizations</option>';
    orgs.forEach(function (o) {
      html += '<option value="' + o.id + '">' + o.full.replace(/</g, '&lt;') + ' (' + o.deg + ')</option>';
    });
    focusEl.innerHTML = html;
    focusEl.addEventListener('change', function () {
      selected = byId[focusEl.value] || null;
      if (selected) {
        // gently recenter on the focused org
        tx = W / 2 - selected.x * scale;
        ty = H / 2 - selected.y * scale;
      }
      if (reduceMotion) draw();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      selected = null; hovered = null;
      if (focusEl) focusEl.value = '';
      nodes.forEach(function (n) { n.vx = 0; n.vy = 0; });
      alpha = 1;
      fit();
      if (reduceMotion) { settle(); draw(); }
    });
  }

  function settle() {
    // Run the sim to a resting state without animating (reduced motion / init).
    var a = alpha; alpha = 1;
    for (var i = 0; i < 320; i++) step();
    alpha = a;
  }

  // ── Boot: lay out once, animate only while visible ───────────
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    resize();
    buildLegend();
    buildFocus();
    settle();
    fit();
    draw();
  }

  window.addEventListener('resize', function () {
    if (!booted) return;
    resize();
    draw();
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          boot();
          if (!reduceMotion && !running) { running = true; requestAnimationFrame(frame); }
        } else {
          running = false;
        }
      });
    }, { threshold: 0.08 });
    io.observe(stage);
  } else {
    boot();
    if (!reduceMotion) { running = true; requestAnimationFrame(frame); }
  }
})();
