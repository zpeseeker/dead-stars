/* ─────────────────────────────────────────────────────────────
   fx.js — ambient atmosphere for the plasma theme:
     1. an animated, drifting/twinkling starfield (dependency-free canvas)
     2. a custom cursor: glowing dot + trailing ring, with a comet trail
   Inspired by the 1shotgen.com landing effects, rebuilt from scratch in
   the site's cyan/magenta/violet palette. No three.js / gsap — vanilla JS.

   Guards: skipped for coarse (touch) pointers; motion is reduced when the
   user prefers reduced motion (static field, no trail).
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer =
    window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // Plasma-tinted star colors (white-hot, cyan, violet, magenta).
  var STAR_COLORS = [
    [230, 236, 255],
    [190, 210, 255],
    [103, 232, 249],
    [185, 140, 255],
    [217, 130, 239],
  ];

  // ── 1. Starfield ────────────────────────────────────────────
  function initStarfield() {
    var canvas = document.getElementById('starfield');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0,
      h = 0,
      stars = [];

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      // Density scales with viewport area, capped for performance.
      var count = Math.min(220, Math.round((w * h) / 9000));
      stars = [];
      for (var i = 0; i < count; i++) {
        var c = STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0];
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.3 + 0.3,
          // depth drives parallax drift speed and base brightness
          z: Math.random() * 0.8 + 0.2,
          c: c,
          tw: Math.random() * Math.PI * 2, // twinkle phase
          tws: Math.random() * 0.9 + 0.25, // twinkle speed
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var twinkle = reduceMotion ? 0.75 : 0.55 + 0.45 * Math.sin(s.tw + t * 0.001 * s.tws);
        var a = twinkle * (0.35 + s.z * 0.55);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + a.toFixed(3) + ')';
        ctx.fill();
        // Occasional soft glow on the brighter foreground stars.
        if (s.r > 1.05) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
          ctx.fillStyle =
            'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + (a * 0.12).toFixed(3) + ')';
          ctx.fill();
        }
        if (!reduceMotion) {
          // Slow upward drift; wrap around the edges.
          s.y -= s.z * 0.12;
          s.x += s.z * 0.05;
          if (s.y < -4) s.y = h + 4;
          if (s.x > w + 4) s.x = -4;
        }
      }
    }

    var raf;
    function loop(t) {
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    resize();
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(resize, 150);
    });

    if (reduceMotion) {
      draw(0); // one static render
    } else {
      raf = requestAnimationFrame(loop);
      // Pause when the tab is hidden.
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          cancelAnimationFrame(raf);
        } else {
          raf = requestAnimationFrame(loop);
        }
      });
    }
  }

  // ── 2. Custom cursor + comet trail ──────────────────────────
  function initCursor() {
    var dot = document.querySelector('.cursor');
    var ring = document.querySelector('.cursor-ring');
    var trail = document.getElementById('cursor-trail');
    if (!dot || !ring) return;

    var mx = window.innerWidth / 2,
      my = window.innerHeight / 2;
    var rx = mx,
      ry = my; // ring position (eased)

    document.documentElement.classList.add('has-cursor');

    window.addEventListener(
      'mousemove',
      function (e) {
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
        if (trailPts) trailPts.push({ x: mx, y: my, life: 1 });
      },
      { passive: true }
    );

    // Hover state over interactive targets.
    var HOVER_SEL = 'a, button, .card, .pill, .era-chip, .entry-share, .name-index__link, select, summary, [role="button"]';
    document.addEventListener(
      'mouseover',
      function (e) {
        if (e.target.closest && e.target.closest(HOVER_SEL)) ring.classList.add('is-hover');
      },
      { passive: true }
    );
    document.addEventListener(
      'mouseout',
      function (e) {
        if (e.target.closest && e.target.closest(HOVER_SEL) &&
            !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(HOVER_SEL))) {
          ring.classList.remove('is-hover');
        }
      },
      { passive: true }
    );
    window.addEventListener('mousedown', function () { ring.classList.add('is-down'); }, { passive: true });
    window.addEventListener('mouseup', function () { ring.classList.remove('is-down'); }, { passive: true });
    document.addEventListener('mouseleave', function () {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () {
      dot.style.opacity = '';
      ring.style.opacity = '';
    });

    // Comet trail on its own canvas (skipped under reduced motion).
    var trailPts = null,
      tctx = null,
      tw = 0,
      th = 0,
      tdpr = Math.min(window.devicePixelRatio || 1, 2);
    if (trail && !reduceMotion) {
      tctx = trail.getContext('2d');
      trailPts = [];
      var tresize = function () {
        tw = window.innerWidth;
        th = window.innerHeight;
        trail.width = Math.floor(tw * tdpr);
        trail.height = Math.floor(th * tdpr);
        trail.style.width = tw + 'px';
        trail.style.height = th + 'px';
        tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
      };
      tresize();
      window.addEventListener('resize', tresize);
    }

    function frame() {
      // Ease the ring toward the pointer for a trailing feel.
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';

      if (tctx) {
        tctx.clearRect(0, 0, tw, th);
        for (var i = trailPts.length - 1; i >= 0; i--) {
          var p = trailPts[i];
          p.life -= 0.06;
          if (p.life <= 0) {
            trailPts.splice(i, 1);
            continue;
          }
          tctx.beginPath();
          tctx.arc(p.x, p.y, 5 * p.life + 0.5, 0, Math.PI * 2);
          tctx.fillStyle = 'rgba(103,232,249,' + (p.life * 0.32).toFixed(3) + ')';
          tctx.fill();
        }
        if (trailPts.length > 60) trailPts.splice(0, trailPts.length - 60);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    initStarfield();
    if (finePointer) initCursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
