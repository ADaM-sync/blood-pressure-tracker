// Real PNG URLs are retained: some iOS versions ignore data/blob startup images.
(() => {
  const standalone = window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  const splash = document.getElementById("launchScreen");
  if (standalone && splash) {
    splash.hidden = false;
    // A short branded fallback while the page starts, even when iOS omits its
    // native launch image. It never waits for the database or blocks on a file.
    window.setTimeout(() => { splash.hidden = true; }, 500);
  }

  // Give Safari explicit, unconditional PNGs for this device. This avoids
  // relying on appearance media queries in the Home Screen install parser.
  const links = [...document.querySelectorAll('link[rel="apple-touch-startup-image"][media]')];
  for (const orientation of ["portrait", "landscape"]) {
    const candidate = links.find(link => {
      if (!link.media.includes(`(orientation: ${orientation})`) || !link.href.includes("-light.png")) return false;
      const deviceQuery = link.media.replace(/ and \(orientation: [^)]+\)/, "");
      return window.matchMedia(deviceQuery).matches;
    });
    if (!candidate) continue;
    const link = document.createElement("link");
    link.rel = "apple-touch-startup-image";
    link.href = candidate.href;
    link.media = `(orientation: ${orientation})`;
    document.head.appendChild(link);
  }
})();
