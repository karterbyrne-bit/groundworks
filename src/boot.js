/* Runs before anything else. If the app can't start (no 3D support, a crash while loading, a damaged saved design),
   swap the loading screen for a friendly card instead of leaving a blank page. Once the app is running, later errors
   show a small notice and leave the design alone. */
(function(){
  var KEY = "groundworks-v6";
  var started = false, shown = false;
  function card(title, text, fresh){
    if (shown) return; shown = true;
    var el = document.getElementById("fatal"); if (!el) return;
    el.querySelector("h2").textContent = title;
    el.querySelector("p").textContent = text;
    el.querySelector("[data-fresh]").hidden = !fresh;
    el.hidden = false;
    document.documentElement.classList.add("failed");
  }
  function hasWebGL(){
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch(e){ return false; }
  }
  var gl = hasWebGL();
  function fail(err){
    if (!gl) return card("This device can't show the 3D view", "Groundworks needs 3D graphics (WebGL). Try an up-to-date Chrome, Safari, Firefox or Edge, and check hardware acceleration is switched on.", false);
    if (!started) return card("Groundworks couldn't start", "Something went wrong while loading. Reloading usually fixes it. If it keeps happening, start with a fresh design: your saved designs are kept.", true);
    if (window.gwToast) window.gwToast("<b>Something went wrong.</b> Your design is saved. If anything looks odd, reload the page.");
  }
  window.addEventListener("error", function(e){ if (e && e.message && !/ResizeObserver loop/.test(e.message)) fail(e.error || e.message); });
  window.addEventListener("unhandledrejection", function(e){ fail(e.reason); });
  window.gwStarted = function(){ started = true; document.documentElement.classList.add("ready"); };
  document.addEventListener("click", function(e){
    var t = e.target;
    if (t.closest && t.closest("[data-reload]")) location.reload();
    if (t.closest && t.closest("[data-fresh]")){ try { localStorage.removeItem(KEY); } catch(err) {} location.href = location.pathname; }
  });
  if (!gl) document.addEventListener("DOMContentLoaded", function(){ fail(); });
  /* Offline support: keep a copy of the app so it opens without a connection next time. */
  if ("serviceWorker" in navigator && location.protocol === "https:") window.addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
})();
