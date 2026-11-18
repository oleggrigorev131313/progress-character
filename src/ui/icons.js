function svg(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

const stroke = `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;

export function icon(name) {
  const paths = {
    home: `<path ${stroke} d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"/>`,
    wallet: `<path ${stroke} d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a1 1 0 0 1 1 1v2H6.5"/><path ${stroke} d="M4 8.5V17a2 2 0 0 0 2 2h13V8"/><path ${stroke} d="M16 13.5h2"/>`,
    spark: `<path ${stroke} d="M12 3.5c2.2 3.2 3.2 5.2 3.2 7.1A3.2 3.2 0 0 1 12 13.8 3.2 3.2 0 0 1 8.8 10.6c0-1.9 1-3.9 3.2-7.1Z"/><path ${stroke} d="M8 14.5c.4 2.4 1.8 4.2 4 5.5 2.2-1.3 3.6-3.1 4-5.5"/>`,
    clock: `<circle ${stroke} cx="12" cy="12" r="8"/><path ${stroke} d="M12 8v4.5l3 2"/>`,
    gear: `<circle ${stroke} cx="12" cy="12" r="3"/><path ${stroke} d="M12 3.5v2.2M12 18.3v2.2M4.8 6.2l1.6 1.6M17.6 16.2l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.8l1.6-1.6M17.6 7.8l1.6-1.6"/>`,
    mic: `<path ${stroke} d="M12 4a2.6 2.6 0 0 1 2.6 2.6v5a2.6 2.6 0 0 1-5.2 0v-5A2.6 2.6 0 0 1 12 4Z"/><path ${stroke} d="M7 11.2a5 5 0 0 0 10 0M12 16.2V20M9 20h6"/>`,
    book: `<path ${stroke} d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5H7.5A2.5 2.5 0 0 0 5 21Z"/><path ${stroke} d="M5 5.5V21"/>`,
    dumbbell: `<path ${stroke} d="M6 9v6M4 10v4M18 9v6M20 10v4M6 12h12"/>`,
    target: `<circle ${stroke} cx="12" cy="12" r="7"/><circle ${stroke} cx="12" cy="12" r="3"/><path ${stroke} d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5"/>`,
    chart: `<path ${stroke} d="M4 19h16"/><path ${stroke} d="M7 16V9M12 16V5M17 16v-4"/>`,
    calendar: `<rect ${stroke} x="4" y="5" width="16" height="14" rx="2"/><path ${stroke} d="M8 3.5V7M16 3.5V7M4 10h16"/>`,
    sparkle: `<path ${stroke} d="M12 3.2 13.2 8.8 18.8 10 13.2 11.2 12 16.8 10.8 11.2 5.2 10 10.8 8.8Z"/>`,
  };
  return svg(`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`);
}

export function gem() {
  return svg(`<svg class="gem" viewBox="0 0 88 88" aria-hidden="true">
    <defs>
      <linearGradient id="gem-face" x1="18" y1="8" x2="74" y2="82" gradientUnits="userSpaceOnUse">
        <stop stop-color="#e9fdff"/>
        <stop offset="0.42" stop-color="#3de1ff"/>
        <stop offset="1" stop-color="#2f6dff"/>
      </linearGradient>
    </defs>
    <path fill="url(#gem-face)" d="M44 6 74 30 44 82 14 30Z"/>
    <path fill="rgba(255,255,255,.38)" d="M44 6 56 30 44 82 32 30Z"/>
    <path fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.2" d="M14 30h60M32 30 44 82 56 30M44 6 32 30M44 6 56 30"/>
  </svg>`);
}
