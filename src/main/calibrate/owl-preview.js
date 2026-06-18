/**
 * Mudrik owl preview — shared module for the calibration hero preview window.
 * Exposes window.MudrikOwlPreview.current() and .experimental().
 *
 * `current` is a faithful clone of src/renderer/components/OwlMascot.tsx
 * (idle state: eye tracking, ~2s blink, restless head tilt, reply pop omitted).
 * `experimental` starts from the same faithful clone and applies only the
 * user-approved tweaks so they can be A/B reviewed in isolation.
 *
 * Once approved, port the tweaks into OwlMascot.tsx and delete this module.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function newSvg() {
    const svg = el("svg", { viewBox: "0 0 256 256", width: "100%", height: "100%", "aria-hidden": "true" });
    svg.style.display = "block";
    svg.style.overflow = "visible";
    return svg;
  }

  // Shared animation logic. opts: { pupilTravel, tiltRange, blinkMs, blinkShutMs,
  // tiltWaitMin, tiltWaitMax, tiltHoldMin, tiltHoldMax, breathAmp }
  function attach(svg, root, head, eyeGroup, lids, opts) {
    const move = function (clientX, clientY) {
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const scale = Math.min(1, dist / 240) * opts.pupilTravel;
      const nx = (dx / (dist || 1)) * scale;
      const ny = (dy / (dist || 1)) * scale;
      eyeGroup.style.transform = "translate(" + nx + "px, " + ny + "px)";
    };
    const onMove = function (e) { move(e.clientX, e.clientY); };
    window.addEventListener("mousemove", onMove);

    // Blink
    const blinkLoop = function () {
      for (let i = 0; i < lids.length; i++) lids[i].style.transform = "scaleY(1)";
      setTimeout(function () {
        for (let i = 0; i < lids.length; i++) lids[i].style.transform = "scaleY(0)";
      }, opts.blinkShutMs);
      setTimeout(blinkLoop, opts.blinkMs + (Math.random() - 0.5) * 800);
    };
    setTimeout(blinkLoop, 1200);

    // Restless head tilt
    const scheduleTilt = function () {
      const wait = opts.tiltWaitMin + Math.random() * (opts.tiltWaitMax - opts.tiltWaitMin);
      setTimeout(function () {
        const angle = Math.random() * opts.tiltRange * 2 - opts.tiltRange;
        head.style.transform = "rotate(" + angle + "deg)";
        setTimeout(function () {
          head.style.transform = "rotate(0deg)";
          scheduleTilt();
        }, opts.tiltHoldMin + Math.random() * (opts.tiltHoldMax - opts.tiltHoldMin));
      }, wait);
    };
    scheduleTilt();

    // Subtle idle breath
    let phase = 0;
    let rafId = 0;
    const breath = function () {
      phase += 0.04;
      const s = 1 + Math.sin(phase) * opts.breathAmp;
      root.style.transform = "scale(" + s + ")";
      rafId = requestAnimationFrame(breath);
    };
    rafId = requestAnimationFrame(breath);

    return function destroy() {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // CURRENT — faithful clone of OwlMascot.tsx (idle)
  // ──────────────────────────────────────────────────────────────────────
  const CUR = {
    body: "#7499C2", bodyDeep: "#4F7399", bodyLight: "#9DB8D6", line: "#2D4A63",
    belly: "#E8EEF5", bellyShade: "#C9D5E4", iris: "#F2C94C", irisRing: "#D99A1E",
    pupil: "#1C1C1C", beak: "#F2A93A", beakHi: "#FFC06A", white: "#FFFFFF",
  };
  const CUR_EYE_L = { cx: 100, cy: 94 };
  const CUR_EYE_R = { cx: 156, cy: 94 };
  const CUR_EYE_R_WHITE = 30;

  function buildCurrent(container) {
    const svg = newSvg();
    const root = el("g", {});
    root.style.transition = "transform 200ms ease";
    svg.appendChild(root);

    root.appendChild(el("ellipse", { cx: 128, cy: 246, rx: 70, ry: 4.5, fill: CUR.line, opacity: "0.18" }));

    const feet = el("g", { fill: CUR.beak, stroke: CUR.line, "stroke-width": 2, "stroke-linejoin": "round" });
    feet.appendChild(el("path", { d: "M 100 234 Q 102 244 108 244 L 114 244 Q 118 244 116 238 Z" }));
    feet.appendChild(el("path", { d: "M 118 234 Q 120 245 126 245 L 132 245 Q 136 244 134 238 Z" }));
    feet.appendChild(el("path", { d: "M 138 234 Q 140 245 146 245 L 152 245 Q 156 244 154 238 Z" }));
    root.appendChild(feet);

    root.appendChild(el("path", {
      fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round",
      d: "M 128 86 C 74 86, 40 128, 40 172 C 40 218, 80 238, 128 238 C 176 238, 216 218, 216 172 C 216 128, 182 86, 128 86 Z",
    }));

    // Left wing
    root.appendChild(el("path", { fill: CUR.bodyDeep, stroke: CUR.line, "stroke-width": 3, "stroke-linejoin": "round", d: "M 52 148 C 40 180, 48 214, 74 226 L 92 222 L 88 150 Z" }));
    root.appendChild(el("path", { fill: CUR.body, opacity: "0.85", d: "M 60 158 C 52 184, 58 210, 78 220 L 86 218 L 84 162 Z" }));
    const lfl = el("g", { stroke: CUR.line, "stroke-width": 2, fill: "none", "stroke-linecap": "round", opacity: "0.7" });
    lfl.appendChild(el("path", { d: "M 74 172 Q 70 192 78 210" }));
    lfl.appendChild(el("path", { d: "M 64 166 Q 60 190 72 214" }));
    root.appendChild(lfl);

    // Right wing
    root.appendChild(el("path", { fill: CUR.bodyDeep, stroke: CUR.line, "stroke-width": 3, "stroke-linejoin": "round", d: "M 204 148 C 216 180, 208 214, 182 226 L 164 222 L 168 150 Z" }));
    root.appendChild(el("path", { fill: CUR.body, opacity: "0.85", d: "M 196 158 C 204 184, 198 210, 178 220 L 170 218 L 172 162 Z" }));
    const rfl = el("g", { stroke: CUR.line, "stroke-width": 2, fill: "none", "stroke-linecap": "round", opacity: "0.7" });
    rfl.appendChild(el("path", { d: "M 182 172 Q 186 192 178 210" }));
    rfl.appendChild(el("path", { d: "M 192 166 Q 196 190 184 214" }));
    root.appendChild(rfl);

    // Belly
    root.appendChild(el("ellipse", { cx: 128, cy: 186, rx: 46, ry: 50, fill: CUR.belly, stroke: CUR.line, "stroke-width": 2 }));
    root.appendChild(el("ellipse", { cx: 128, cy: 212, rx: 38, ry: 18, fill: CUR.bellyShade, opacity: "0.55" }));
    root.appendChild(el("path", { d: "M 116 158 Q 128 170 140 158", fill: "none", stroke: CUR.body, "stroke-width": 2.5, "stroke-linecap": "round" }));
    root.appendChild(el("path", { d: "M 116 198 Q 128 208 140 198", fill: "none", stroke: CUR.bodyDeep, "stroke-width": 2.2, "stroke-linecap": "round", opacity: "0.6" }));

    // Head group
    const head = el("g", {});
    head.style.transformOrigin = "128px 100px";
    head.style.transformBox = "fill-box";
    head.style.transition = "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    root.appendChild(head);

    head.appendChild(el("path", {
      fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round", "stroke-linecap": "round",
      d: "M 54 108 C 54 80, 66 60, 82 50 C 72 40, 66 28, 72 20 C 82 26, 92 38, 100 46 C 110 40, 118 36, 128 36 C 138 36, 146 40, 156 46 C 164 38, 174 26, 184 20 C 190 28, 184 40, 174 50 C 190 60, 202 80, 202 108 L 54 108 Z",
    }));
    head.appendChild(el("path", { d: "M 76 54 C 92 46, 108 42, 122 42", fill: "none", stroke: CUR.bodyLight, "stroke-width": 5, "stroke-linecap": "round", opacity: "0.6" }));

    // Eye whites
    head.appendChild(el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE, fill: CUR.white, stroke: CUR.line, "stroke-width": 3 }));
    head.appendChild(el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE, fill: CUR.white, stroke: CUR.line, "stroke-width": 3 }));

    // Clip paths
    const defs = el("defs", {});
    const cl = el("clipPath", { id: "curEyeClipL" });
    cl.appendChild(el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE }));
    defs.appendChild(cl);
    const cr = el("clipPath", { id: "curEyeClipR" });
    cr.appendChild(el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE }));
    defs.appendChild(cr);
    svg.appendChild(defs);

    const eyeGroup = el("g", {});
    eyeGroup.style.transition = "transform 80ms linear";
    head.appendChild(eyeGroup);

    function eye(cx, cy, clipId) {
      const g = el("g", { "clip-path": "url(#" + clipId + ")" });
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 18, fill: CUR.irisRing }));
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 15, fill: CUR.iris }));
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 8, fill: CUR.pupil }));
      g.appendChild(el("circle", { cx: cx + 3, cy: cy - 4, r: 3, fill: CUR.white }));
      g.appendChild(el("circle", { cx: cx - 4, cy: cy + 5, r: 1.4, fill: CUR.white }));
      return g;
    }
    eyeGroup.appendChild(eye(CUR_EYE_L.cx, CUR_EYE_L.cy, "curEyeClipL"));
    eyeGroup.appendChild(eye(CUR_EYE_R.cx, CUR_EYE_R.cy, "curEyeClipR"));

    // Eyelids
    const lidsG = el("g", { fill: CUR.body, stroke: CUR.line, "stroke-width": 3 });
    const lidL = el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE });
    lidL.style.transformOrigin = CUR_EYE_L.cx + "px " + (CUR_EYE_L.cy - CUR_EYE_R_WHITE) + "px";
    lidL.style.transformBox = "fill-box";
    lidL.style.transform = "scaleY(0)";
    lidL.style.transition = "transform 60ms ease-in-out";
    lidsG.appendChild(lidL);
    const lidR = el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE });
    lidR.style.transformOrigin = CUR_EYE_R.cx + "px " + (CUR_EYE_R.cy - CUR_EYE_R_WHITE) + "px";
    lidR.style.transformBox = "fill-box";
    lidR.style.transform = "scaleY(0)";
    lidR.style.transition = "transform 60ms ease-in-out";
    lidsG.appendChild(lidR);
    head.appendChild(lidsG);

    // Beak
    head.appendChild(el("path", { fill: CUR.beak, stroke: CUR.line, "stroke-width": 2.5, "stroke-linejoin": "round", d: "M 128 120 L 118 134 Q 128 140 138 134 Z" }));
    head.appendChild(el("path", { d: "M 123 124 L 126 130", fill: "none", stroke: CUR.beakHi, "stroke-width": 2, "stroke-linecap": "round", opacity: "0.85" }));

    container.appendChild(svg);

    const destroy = attach(svg, root, head, eyeGroup, [lidL, lidR], {
      pupilTravel: 14,
      tiltRange: 12,
      blinkMs: 2000,
      blinkShutMs: 120,
      tiltWaitMin: 2000,
      tiltWaitMax: 7000,
      tiltHoldMin: 600,
      tiltHoldMax: 1100,
      breathAmp: 0,
    });
    root.style.transform = "scale(1)";
    return { svg: svg, destroy: destroy };
  }

  // ──────────────────────────────────────────────────────────────────────
  // EXPERIMENTAL — faithful clone + only user-approved tweaks
  // ──────────────────────────────────────────────────────────────────────
  function buildExperimental(container) {
    const svg = newSvg();
    const root = el("g", {});
    root.style.transition = "transform 200ms ease";
    svg.appendChild(root);

    root.appendChild(el("ellipse", { cx: 128, cy: 246, rx: 70, ry: 4.5, fill: CUR.line, opacity: "0.18" }));

    // Feet — 2 toes per foot = 4 toes total
    const feet = el("g", { fill: CUR.beak, stroke: CUR.line, "stroke-width": 2, "stroke-linejoin": "round" });
    feet.appendChild(el("path", { d: "M 104 236 Q 106 246 112 246 L 118 246 Q 122 244 120 238 Z" }));
    feet.appendChild(el("path", { d: "M 118 236 Q 120 246 126 246 L 132 246 Q 136 244 134 238 Z" }));
    feet.appendChild(el("path", { d: "M 140 236 Q 142 246 148 246 L 154 246 Q 158 244 156 238 Z" }));
    feet.appendChild(el("path", { d: "M 154 236 Q 156 246 162 246 L 168 246 Q 172 244 170 238 Z" }));
    root.appendChild(feet);

    root.appendChild(el("path", {
      fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round",
      d: "M 128 86 C 74 86, 40 128, 40 172 C 40 218, 80 238, 128 238 C 176 238, 216 218, 216 172 C 216 128, 182 86, 128 86 Z",
    }));

    // Left wing
    root.appendChild(el("path", { fill: CUR.bodyDeep, stroke: CUR.line, "stroke-width": 3, "stroke-linejoin": "round", d: "M 52 148 C 40 180, 48 214, 74 226 L 92 222 L 88 150 Z" }));
    root.appendChild(el("path", { fill: CUR.body, opacity: "0.85", d: "M 60 158 C 52 184, 58 210, 78 220 L 86 218 L 84 162 Z" }));
    const lfl = el("g", { stroke: CUR.line, "stroke-width": 2, fill: "none", "stroke-linecap": "round", opacity: "0.7" });
    lfl.appendChild(el("path", { d: "M 74 172 Q 70 192 78 210" }));
    lfl.appendChild(el("path", { d: "M 64 166 Q 60 190 72 214" }));
    root.appendChild(lfl);

    // Right wing
    root.appendChild(el("path", { fill: CUR.bodyDeep, stroke: CUR.line, "stroke-width": 3, "stroke-linejoin": "round", d: "M 204 148 C 216 180, 208 214, 182 226 L 164 222 L 168 150 Z" }));
    root.appendChild(el("path", { fill: CUR.body, opacity: "0.85", d: "M 196 158 C 204 184, 198 210, 178 220 L 170 218 L 172 162 Z" }));
    const rfl = el("g", { stroke: CUR.line, "stroke-width": 2, fill: "none", "stroke-linecap": "round", opacity: "0.7" });
    rfl.appendChild(el("path", { d: "M 182 172 Q 186 192 178 210" }));
    rfl.appendChild(el("path", { d: "M 192 166 Q 196 190 184 214" }));
    root.appendChild(rfl);

    // Belly
    root.appendChild(el("ellipse", { cx: 128, cy: 186, rx: 46, ry: 50, fill: CUR.belly, stroke: CUR.line, "stroke-width": 2 }));
    root.appendChild(el("ellipse", { cx: 128, cy: 212, rx: 38, ry: 18, fill: CUR.bellyShade, opacity: "0.55" }));
    root.appendChild(el("path", { d: "M 116 158 Q 128 170 140 158", fill: "none", stroke: CUR.body, "stroke-width": 2.5, "stroke-linecap": "round" }));
    root.appendChild(el("path", { d: "M 116 198 Q 128 208 140 198", fill: "none", stroke: CUR.bodyDeep, "stroke-width": 2.2, "stroke-linecap": "round", opacity: "0.6" }));

    // Head group
    const head = el("g", {});
    head.style.transformOrigin = "128px 100px";
    head.style.transformBox = "fill-box";
    head.style.transition = "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    root.appendChild(head);

    // Head dome — rounder cheeks at bottom left/right; ears thicker at base with curvy outer edge
    head.appendChild(el("path", {
      fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round", "stroke-linecap": "round",
      d: "M 54 108 C 54 82, 66 64, 84 56 C 78 52, 74 40, 78 28 C 86 34, 94 42, 102 48 C 110 42, 118 38, 128 38 C 138 38, 146 42, 154 48 C 162 42, 170 34, 178 28 C 182 40, 178 52, 172 56 C 190 64, 202 82, 202 108 L 54 108 Z",
    }));
    head.appendChild(el("path", { d: "M 76 54 C 92 46, 108 42, 122 42", fill: "none", stroke: CUR.bodyLight, "stroke-width": 5, "stroke-linecap": "round", opacity: "0.6" }));

    // Eye whites
    head.appendChild(el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE, fill: CUR.white, stroke: CUR.line, "stroke-width": 3 }));
    head.appendChild(el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE, fill: CUR.white, stroke: CUR.line, "stroke-width": 3 }));

    // Clip paths
    const defs = el("defs", {});
    const cl = el("clipPath", { id: "expEyeClipL" });
    cl.appendChild(el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE }));
    defs.appendChild(cl);
    const cr = el("clipPath", { id: "expEyeClipR" });
    cr.appendChild(el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE }));
    defs.appendChild(cr);
    svg.appendChild(defs);

    const eyeGroup = el("g", {});
    eyeGroup.style.transition = "transform 80ms linear";
    head.appendChild(eyeGroup);

    function eye(cx, cy, clipId) {
      const g = el("g", { "clip-path": "url(#" + clipId + ")" });
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 18, fill: CUR.irisRing }));
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 15, fill: CUR.iris }));
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 8, fill: CUR.pupil }));
      g.appendChild(el("circle", { cx: cx + 3, cy: cy - 4, r: 3, fill: CUR.white }));
      g.appendChild(el("circle", { cx: cx - 4, cy: cy + 5, r: 1.4, fill: CUR.white }));
      return g;
    }
    eyeGroup.appendChild(eye(CUR_EYE_L.cx, CUR_EYE_L.cy, "expEyeClipL"));
    eyeGroup.appendChild(eye(CUR_EYE_R.cx, CUR_EYE_R.cy, "expEyeClipR"));

    // Eyelids
    const lidsG = el("g", { fill: CUR.body, stroke: CUR.line, "stroke-width": 3 });
    const lidL = el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE });
    lidL.style.transformOrigin = CUR_EYE_L.cx + "px " + (CUR_EYE_L.cy - CUR_EYE_R_WHITE) + "px";
    lidL.style.transformBox = "fill-box";
    lidL.style.transform = "scaleY(0)";
    lidL.style.transition = "transform 60ms ease-in-out";
    lidsG.appendChild(lidL);
    const lidR = el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE });
    lidR.style.transformOrigin = CUR_EYE_R.cx + "px " + (CUR_EYE_R.cy - CUR_EYE_R_WHITE) + "px";
    lidR.style.transformBox = "fill-box";
    lidR.style.transform = "scaleY(0)";
    lidR.style.transition = "transform 60ms ease-in-out";
    lidsG.appendChild(lidR);
    head.appendChild(lidsG);

    // Beak
    head.appendChild(el("path", { fill: CUR.beak, stroke: CUR.line, "stroke-width": 2.5, "stroke-linejoin": "round", d: "M 128 120 L 118 134 Q 128 140 138 134 Z" }));
    head.appendChild(el("path", { d: "M 123 124 L 126 130", fill: "none", stroke: CUR.beakHi, "stroke-width": 2, "stroke-linecap": "round", opacity: "0.85" }));

    container.appendChild(svg);

    const destroy = attach(svg, root, head, eyeGroup, [lidL, lidR], {
      pupilTravel: 14,
      tiltRange: 12,
      blinkMs: 2000,
      blinkShutMs: 120,
      tiltWaitMin: 2000,
      tiltWaitMax: 7000,
      tiltHoldMin: 600,
      tiltHoldMax: 1100,
      breathAmp: 0,
    });
    root.style.transform = "scale(1)";
    return { svg: svg, destroy: destroy };
  }

  // ──────────────────────────────────────────────────────────────────────
  // GEMINI — another AI's take on the same 3 tweaks (isolated for review)
  // ──────────────────────────────────────────────────────────────────────
  function buildGemini(container) {
    const svg = newSvg();
    const root = el("g", {});
    root.style.transition = "transform 200ms ease";
    svg.appendChild(root);

    root.appendChild(el("ellipse", { cx: 128, cy: 246, rx: 70, ry: 4.5, fill: CUR.line, opacity: "0.18" }));

    root.appendChild(el("path", {
      fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round",
      d: "M 128 86 C 74 86, 40 128, 40 172 C 40 218, 80 238, 128 238 C 176 238, 216 218, 216 172 C 216 128, 182 86, 128 86 Z",
    }));

    // Left wing
    root.appendChild(el("path", { fill: CUR.bodyDeep, stroke: CUR.line, "stroke-width": 3, "stroke-linejoin": "round", d: "M 52 148 C 40 180, 48 214, 74 226 L 92 222 L 88 150 Z" }));
    root.appendChild(el("path", { fill: CUR.body, opacity: "0.85", d: "M 60 158 C 52 184, 58 210, 78 220 L 86 218 L 84 162 Z" }));

    // Right wing
    root.appendChild(el("path", { fill: CUR.bodyDeep, stroke: CUR.line, "stroke-width": 3, "stroke-linejoin": "round", d: "M 204 148 C 216 180, 208 214, 182 226 L 164 222 L 168 150 Z" }));
    root.appendChild(el("path", { fill: CUR.body, opacity: "0.85", d: "M 196 158 C 204 184, 198 210, 178 220 L 170 218 L 172 162 Z" }));

    // Belly
    root.appendChild(el("ellipse", { cx: 128, cy: 186, rx: 46, ry: 50, fill: CUR.belly, stroke: CUR.line, "stroke-width": 2 }));
    root.appendChild(el("ellipse", { cx: 128, cy: 212, rx: 38, ry: 18, fill: CUR.bellyShade, opacity: "0.55" }));
    root.appendChild(el("path", { d: "M 116 158 Q 128 170 140 158", fill: "none", stroke: CUR.body, "stroke-width": 2.5, "stroke-linecap": "round" }));
    root.appendChild(el("path", { d: "M 116 198 Q 128 208 140 198", fill: "none", stroke: CUR.bodyDeep, "stroke-width": 2.2, "stroke-linecap": "round", opacity: "0.6" }));

    // Feet — Gemini shapes (2 per foot, 4 total)
    const feet = el("g", { id: "owl-feet" });
    feet.appendChild(el("path", { d: "M 75 205 C 75 225, 95 225, 95 205 Z", fill: CUR.beak, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round" }));
    feet.appendChild(el("path", { d: "M 90 208 C 90 228, 110 228, 110 208 Z", fill: CUR.beak, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round" }));
    feet.appendChild(el("path", { d: "M 146 208 C 146 228, 166 228, 166 208 Z", fill: CUR.beak, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round" }));
    feet.appendChild(el("path", { d: "M 161 205 C 161 225, 181 225, 181 205 Z", fill: CUR.beak, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round" }));
    root.appendChild(feet);

    // Head group
    const head = el("g", {});
    head.style.transformOrigin = "128px 100px";
    head.style.transformBox = "fill-box";
    head.style.transition = "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    root.appendChild(head);

    // Ears — Gemini shapes
    const ears = el("g", { id: "owl-ears" });
    ears.appendChild(el("path", { d: "M 60 65 C 35 35, 55 15, 65 20 C 75 25, 80 35, 90 45 Z", fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round" }));
    ears.appendChild(el("path", { d: "M 196 65 C 221 35, 201 15, 191 20 C 181 25, 176 35, 166 45 Z", fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round" }));
    head.appendChild(ears);

    // Head dome — Gemini shape (rounder cheeks)
    head.appendChild(el("path", {
      id: "owl-head-dome",
      fill: CUR.body, stroke: CUR.line, "stroke-width": 4, "stroke-linejoin": "round",
      d: "M 60 90 C 60 30, 196 30, 196 90 C 210 135, 176 155, 128 155 C 80 155, 46 135, 60 90 Z",
    }));

    // Eye whites
    head.appendChild(el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE, fill: CUR.white, stroke: CUR.line, "stroke-width": 3 }));
    head.appendChild(el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE, fill: CUR.white, stroke: CUR.line, "stroke-width": 3 }));

    // Clip paths
    const defs = el("defs", {});
    const cl = el("clipPath", { id: "gemEyeClipL" });
    cl.appendChild(el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE }));
    defs.appendChild(cl);
    const cr = el("clipPath", { id: "gemEyeClipR" });
    cr.appendChild(el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE }));
    defs.appendChild(cr);
    svg.appendChild(defs);

    const eyeGroup = el("g", {});
    eyeGroup.style.transition = "transform 80ms linear";
    head.appendChild(eyeGroup);

    function eye(cx, cy, clipId) {
      const g = el("g", { "clip-path": "url(#" + clipId + ")" });
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 18, fill: CUR.irisRing }));
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 15, fill: CUR.iris }));
      g.appendChild(el("circle", { cx: cx, cy: cy, r: 8, fill: CUR.pupil }));
      g.appendChild(el("circle", { cx: cx + 3, cy: cy - 4, r: 3, fill: CUR.white }));
      g.appendChild(el("circle", { cx: cx - 4, cy: cy + 5, r: 1.4, fill: CUR.white }));
      return g;
    }
    eyeGroup.appendChild(eye(CUR_EYE_L.cx, CUR_EYE_L.cy, "gemEyeClipL"));
    eyeGroup.appendChild(eye(CUR_EYE_R.cx, CUR_EYE_R.cy, "gemEyeClipR"));

    // Eyelids
    const lidsG = el("g", { fill: CUR.body, stroke: CUR.line, "stroke-width": 3 });
    const lidL = el("circle", { cx: CUR_EYE_L.cx, cy: CUR_EYE_L.cy, r: CUR_EYE_R_WHITE });
    lidL.style.transformOrigin = CUR_EYE_L.cx + "px " + (CUR_EYE_L.cy - CUR_EYE_R_WHITE) + "px";
    lidL.style.transformBox = "fill-box";
    lidL.style.transform = "scaleY(0)";
    lidL.style.transition = "transform 60ms ease-in-out";
    lidsG.appendChild(lidL);
    const lidR = el("circle", { cx: CUR_EYE_R.cx, cy: CUR_EYE_R.cy, r: CUR_EYE_R_WHITE });
    lidR.style.transformOrigin = CUR_EYE_R.cx + "px " + (CUR_EYE_R.cy - CUR_EYE_R_WHITE) + "px";
    lidR.style.transformBox = "fill-box";
    lidR.style.transform = "scaleY(0)";
    lidR.style.transition = "transform 60ms ease-in-out";
    lidsG.appendChild(lidR);
    head.appendChild(lidsG);

    // Beak
    head.appendChild(el("path", { fill: CUR.beak, stroke: CUR.line, "stroke-width": 2.5, "stroke-linejoin": "round", d: "M 128 120 L 118 134 Q 128 140 138 134 Z" }));

    container.appendChild(svg);

    const destroy = attach(svg, root, head, eyeGroup, [lidL, lidR], {
      pupilTravel: 14,
      tiltRange: 12,
      blinkMs: 2000,
      blinkShutMs: 120,
      tiltWaitMin: 2000,
      tiltWaitMax: 7000,
      tiltHoldMin: 600,
      tiltHoldMax: 1100,
      breathAmp: 0,
    });
    root.style.transform = "scale(1)";
    return { svg: svg, destroy: destroy };
  }

  window.MudrikOwlPreview = {
    current: buildCurrent,
    experimental: buildExperimental,
    gemini: buildGemini,
  };
})();
