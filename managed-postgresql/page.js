/* ---------------- calculation engine ----------------
   A scenario is a size, not a unit. For every offer the engine keeps the SKUs that meet it and prices the
   cheapest one: compute (hourly rate of all nodes x hours) + storage (billed the way that vendor bills it)
   + backup data the user entered. Nothing here estimates a price the vendor does not publish. */
/* Monthly totals, not unit prices: shared/ui.js renderRanking prints a unit price, so this page draws its
   bars with the same markup and classes, formatted in euros per month, with "≥ " in front of a lower bound. */
const fmtM = v => v === null ? "—" : Math.round(v).toLocaleString("en-GB") + " €";
function renderRankingMonthly(elId, items){
  const el = document.getElementById(elId);
  if(!items.length){ el.innerHTML = ""; return; }
  const max = Math.max(...items.map(i => i.value));
  el.innerHTML = items.map(i => {
    const exo = i.exo ? " is-exo" : "";
    const w = Math.max(1.5, i.value / max * 100);
    return '<div class="rk-name' + exo + '">' + esc(i.vendor) + " · " + esc(i.cls) + "</div>"
      + '<div class="rk-track"><div class="rk-bar' + exo + (i.short ? " is-short" : "")
      + '" style="width:' + w.toFixed(2) + '%"></div></div>'
      + '<div class="rk-val' + exo + '">' + (i.mark || "") + fmtM(i.value) + "</div>";
  }).join("");
}

const S = { vcpu:2, ram:8, tol:0, disk:100, ha:0, pitr:0, bk:0, hours:730, burst:false, gated:false, panel:"all" };

const PRESETS = {
  s1: { label:"Small, no HA",           vcpu:2, ram:8,  disk:100, ha:0, pitr:0 },
  s2: { label:"Production, HA + PITR",  vcpu:4, ram:16, disk:200, ha:1, pitr:7 },
  s3: { label:"Large, HA + PITR",       vcpu:8, ram:32, disk:500, ha:1, pitr:14 },
  s4: { label:"Critical, 2 standbys",   vcpu:8, ram:32, disk:500, ha:2, pitr:30 }
};

/* months' worth of a rate quoted per hour, per 30 days (IONOS), or per month */
const perF = per => per === "hour" ? S.hours : per === "d30" ? S.hours / 720 : 1;
const isBurst = s => s.cpu === "burstable" || s.cpu === "shared";
const gib = n => num(Math.round(n * 10) / 10) + " GiB";

/* Storage as this SKU is billed. Returns money in the offer's currency (not converted yet).
   disk = { bundled, rate, per, perNode, min, max, step, fixedH }
     step    the vendor sells storage in steps of this many GiB (DigitalOcean: 10)
     fixedH  a fee per node and per hour that comes with the disk whatever its size (STACKIT performance class) */
function storagePart(s){
  const d = s.disk, short = [];
  let billed = Math.max(S.disk, d.min || 0);
  if(d.step) billed = Math.ceil(billed / d.step) * d.step;
  if(d.max != null && billed > d.max){ short.push("disk caps at " + gib(d.max)); billed = d.max; }
  const extra = Math.max(0, billed - (d.bundled || 0));
  let cost = 0;
  if(extra > 0 && d.rate != null)
    cost = extra * d.rate * perF(d.per) * (d.perNode ? s.nodes : 1);
  if(d.fixedH) cost += d.fixedH * S.hours * s.nodes;
  return { cost, short, billed, extra };
}

function costOf(r, s){
  const st = storagePart(s), fx = FX[r.cur];
  const short = st.short.slice();
  if(S.pitr > 0){
    if(s.pitr == null)       short.push("no point-in-time recovery documented");
    else if(s.pitr < S.pitr) short.push("PITR up to " + s.pitr + " d");
  }
  const comp = (s.m != null ? s.m : s.h * S.hours) * fx, stor = st.cost * fx, bk = S.bk * (r.backupRate || 0) * fx;
  return { s, comp, stor, bk, total: comp + stor + bk, short, lb: !!s.lb, st };
}

/* An offer sold by the meter has no fixed sizes for that family: the SKU is the scenario itself, priced core by core
   and GB by GB, inside the vendor's rules. r.meters is a list (Google has several machine series).
     coreMin, coreMax, coreEven   vCPU limits ("1 or an even number")
     ramMin, ramMax, ramStep, ramPerCoreMin, ramPerCoreMax   RAM limits in GB, step, and ratio to vCPU
     haCore, haRam                rates when the vendor publishes its own HA rates (Google); then the price is the total
     nodesMax / maxStandbys       how many nodes or standbys the offer can hold
   Without haCore the price is per node and every node is billed (IONOS). Returns [] when a rule cannot hold the scenario. */
function meterSkus(r){
  const out = [];
  for(const m of (r.meters || (r.meter ? [r.meter] : []))){
    const ha = S.ha > 0;
    if(m.maxStandbys != null && S.ha > m.maxStandbys) continue;
    if(m.nodesMax != null && 1 + S.ha > m.nodesMax) continue;
    let cores = Math.max(S.vcpu, m.coreMin || 1);
    if(m.coreEven && cores > 1 && cores % 2) cores += 1;
    let ram = Math.max(S.ram * (1 - S.tol), m.ramMin || 1);
    if(m.ramPerCoreMin) ram = Math.max(ram, cores * m.ramPerCoreMin);
    if(m.ramStep) ram = Math.ceil(ram / m.ramStep - 1e-9) * m.ramStep;
    if(cores > m.coreMax || ram > m.ramMax || (m.ramPerCoreMax && ram > cores * m.ramPerCoreMax + 1e-9)) continue;
    const own = ha && m.haCore != null;
    const nodes = own ? 2 : 1 + S.ha;
    const h = own ? cores * m.haCore + ram * m.haRam : nodes * (cores * m.core + ram * m.ramRate + (m.baseH || 0));
    const disk = own && m.disk.haRate != null ? Object.assign({}, m.disk, { rate: m.disk.haRate }) : m.disk;
    out.push({ n: m.label + ": " + cores + " vCPU, " + ram + " GB" + (nodes > 1 ? ", " + nodes + " nodes" : ""),
               nodes, standbys: own ? 1 : S.ha, vcpu: cores, ram, cpu: m.cpu || "unspecified", h, disk, pitr: m.pitr,
               gated: false, lb: !!m.lb, metered: true, sla: m.sla });
  }
  return out;
}

/* The cheapest SKU that meets the whole scenario; if none does, the cheapest that meets the size and HA. */
function pick(r){
  const fits = r.skus.concat(meterSkus(r)).filter(s => s.vcpu >= S.vcpu && s.ram >= S.ram * (1 - S.tol) - 1e-9 && s.standbys >= S.ha
                              && (S.burst || !isBurst(s)) && (S.gated || !s.gated));
  if(!fits.length) return null;
  const priced = fits.map(s => costOf(r, s));
  const full = priced.filter(p => p.short.length === 0);
  const pool = full.length ? full : priced;
  pool.sort((a, b) => a.total - b.total || a.s.vcpu - b.s.vcpu);
  const best = pool[0];
  best.fitCount = fits.length;
  return best;
}

/* why an offer cannot deliver the scenario at all */
function whyNot(r){
  const ms = r.meters || (r.meter ? [r.meter] : []);
  if(ms.length && !r.skus.length){
    const m = ms[0];
    if(m.maxStandbys != null && S.ha > m.maxStandbys) return "at most " + m.maxStandbys + " standby node" + (m.maxStandbys > 1 ? "s" : "");
    if(m.nodesMax != null && 1 + S.ha > m.nodesMax) return "at most " + m.nodesMax + " nodes";
    if(S.vcpu > m.coreMax) return "at most " + m.coreMax + " cores per node";
    return "at most " + m.ramMax + " GB per node";
  }
  const usable = r.skus.filter(s => (S.burst || !isBurst(s)) && (S.gated || !s.gated));
  if(!usable.length) return "only burstable or gated sizes";
  const maxCpu = Math.max(...usable.map(s => s.vcpu)), maxRam = Math.max(...usable.map(s => s.ram));
  const maxHa = Math.max(...usable.map(s => s.standbys));
  if(S.ha > maxHa) return "no size with " + S.ha + " standby node" + (S.ha > 1 ? "s" : "");
  if(S.vcpu > maxCpu) return "largest is " + maxCpu + " vCPU";
  if(S.ram > maxRam) return "largest is " + gib(maxRam) + " RAM";
  return "no size has both " + S.vcpu + " vCPU and " + gib(S.ram) + " RAM" + (S.ha ? " with " + S.ha + " standby" : "");
}

/* ---------------- formatting ---------------- */

function skuCell(p){
  const s = p.s;
  const nodes = s.nodes > 1 ? s.nodes + " nodes × " : "";
  const cpu = s.cpu === "burstable" ? ' <span class="np">burstable</span>' : s.cpu === "shared" ? ' <span class="np">shared</span>' : "";
  const rng = s.range ? ' <span class="np" title="The range Scaleway files this type under on its pricing page">' + esc(s.range) + "</span>" : "";
  const gated = s.gated ? ' <span class="np" title="Sold only after activation for the account">on request</span>' : "";
  const disputed = s.disputed ? ' <span class="np" title="' + esc(s.disputed) + '">⚠ price disputed</span>' : "";
  return "<b>" + esc(s.n) + "</b>" + cpu + rng + gated + disputed
    + '<span class="sub">' + nodes + s.vcpu + " vCPU, " + gib(s.ram) + " RAM"
    + (!s.metered && s.ram < S.ram - 1e-9 ? ' <span class="np" title="Accepted under the RAM rule: below the RAM asked for">' + Math.round((1 - s.ram / S.ram) * 100) + " % below</span>" : "") + "</span>";
}
function storageCell(p, r){
  const d = p.s.disk;
  const line = d.bundled >= S.disk
    ? '<span class="free">' + gib(d.bundled) + " included</span>"
    : d.bundled > 0 ? gib(d.bundled) + " included + " + gib(p.st.extra) + " extra"
    : gib(p.st.billed) + " billed";
  const perNode = d.perNode && p.s.nodes > 1 ? " on each of " + p.s.nodes + " nodes" : "";
  const note = d.note ? d.note : d.bundled > 0 && d.bundled < S.disk && d.rate == null ? "cannot be extended" : perNode.trim();
  return line + '<span class="sub">' + esc(note) + "</span>";
}
function pitrCell(p){
  const v = p.s.pitr;
  const txt = v == null ? '<span class="np">none stated</span>' : v + " d";
  const bad = S.pitr > 0 && (v == null || v < S.pitr);
  return (bad ? '<span class="short" title="Below the requested window">⚠ </span>' : "") + txt
    + (p.s.pitrNote ? '<span class="sub">' + esc(p.s.pitrNote) + "</span>" : "");
}

/* ---------------- rendering ---------------- */
const SORT = { col:null, dir:1 };
let LAST = [];

function render(){
  const panel = PANELS[S.panel];
  document.getElementById("panel-sub").textContent = panel.sub;
  document.getElementById("stamp-hours").textContent = S.hours + " h/month";
  const offers = panel.ids.map(id => ROWS.find(r => r.id === id)).filter(Boolean);
  const picks = offers.map(r => ({ r, p: pick(r) }));
  const exoRow = picks.find(x => x.r.brand);
  const exoTotal = exoRow && exoRow.p ? exoRow.p.total : null;
  LAST = picks;

  const need = num(S.vcpu) + " vCPU, " + gib(S.ram) + (S.tol ? " RAM (−10 % allowed)" : " RAM") + ", " + gib(S.disk) + " storage"
    + (S.ha ? ", " + S.ha + " standby node" + (S.ha > 1 ? "s" : "") : ", no standby")
    + (S.pitr ? ", PITR ≥ " + S.pitr + " d" : "");
  document.getElementById("rank-title").textContent = "Monthly price for " + need + " — cheapest size per offer";

  const ranked = picks.filter(x => x.p).map(x => ({
    vendor: x.r.label || x.r.vendor, cls: x.p.s.n,
    value: x.p.total, exo: !!x.r.brand, short: x.p.short.length > 0, mark: x.p.lb ? "≥ " : ""
  })).sort((a, b) => a.value - b.value);
  renderRankingMonthly("rank", ranked);
  document.getElementById("empty").hidden = ranked.length > 0;

  const hatched = ranked.filter(x => x.short).length;
  const lbs = ranked.filter(x => x.mark).length;
  const missing = picks.filter(x => !x.p);
  document.getElementById("legend").innerHTML =
    (hatched ? "<b>Hatched bars</b> fail a requirement (see the table) and show the cheapest size that gets closest. " : "Every bar meets the whole scenario. ")
    + (lbs ? "<b>≥</b> marks a lower bound: a cost the vendor does not publish is missing. " : "")
    + (missing.length ? "Not shown, cannot deliver the scenario: " + missing.map(x => esc(x.r.label || x.r.vendor) + " (" + esc(whyNot(x.r)) + ")").join("; ") + "." : "");

  const sortVal = {
    vendor: x => x.r.vendor + " " + x.r.offer, sku: x => x.p ? x.p.s.n : null, comp: x => x.p ? x.p.comp : null,
    stor: x => x.p ? x.p.stor : null, total: x => x.p ? x.p.total : null,
    pitr: x => x.p ? (x.p.s.pitr == null ? -1 : x.p.s.pitr) : null
  };
  const rows = sortRows(picks.map(x => Object.assign({ vendor: x.r.vendor, cls: x.r.offer }, x)), sortVal, SORT);
  applyAriaSort(SORT);

  document.getElementById("tbody").innerHTML = rows.map(x => {
    const r = x.r, p = x.p;
    const tr = r.brand ? ' class="is-exo"' : (p && p.short.length ? ' class="is-short"' : "");
    const head = '<td class="key">' + esc(r.vendor) + '<span class="sub">' + esc(r.offer) + " · " + esc(r.region) + "</span></td>";
    if(!p)
      return "<tr" + tr + ">" + head + '<td colspan="7"><span class="np">cannot deliver</span> · ' + esc(whyNot(r)) + "</td></tr>";
    const lb = p.lb ? '<span class="np" title="The vendor does not publish the cost of this part">≥ </span>' : "";
    const shorts = p.short.length ? ' <span class="short" title="' + esc(p.short.join("; ")) + '">&#9888;</span>' : "";
    return "<tr" + tr + ">" + head
      + "<td>" + skuCell(p) + shorts + "</td>"
      + '<td class="num">' + fmtM(p.comp) + "</td>"
      + '<td class="num">' + (p.stor === 0 && p.s.disk.bundled >= S.disk ? '<span class="free">incl.</span>' : fmtM(p.stor)) + "</td>"
      + '<td class="num big">' + lb + "<b>" + fmtM(p.total) + "</b></td>"
      + "<td>" + pitrCell(p) + "</td>"
      + "<td>" + storageCell(p, r) + "</td>"
      + '<td class="cls"><span class="sub" style="max-width:34ch">' + esc(r.priceBasis) + "</span></td>"
      + "</tr>";
  }).join("");
}

function renderStatus(){
  if(!STATUS_ROWS.length){ document.getElementById("status-block").innerHTML = ""; return; }
  const VERDICT = { GA:"generally available", announced:"announced, not available", partner_only:"partner offer only", none:"no such product", unknown:"unknown" };
  document.getElementById("status-block").innerHTML =
    '<h2 class="section-title">Vendors with no PostgreSQL price to compare</h2><div class="tablewrap"><table style="min-width:0"><thead><tr><th>Vendor</th><th>Status</th><th>What its own page says</th></tr></thead><tbody>'
    + STATUS_ROWS.map(v =>
      '<tr><td class="key">' + esc(v.vendor) + '</td><td><span class="chip">' + esc(VERDICT[v.verdict] || v.verdict) + "</span></td><td>“"
        + esc(v.exact_quote) + "”"
        + (v.quote_context ? '<span class="sub" style="max-width:70ch">' + esc(v.quote_context) + "</span>" : "")
        + (v.note ? '<span class="sub" style="max-width:70ch">' + esc(v.note) + "</span>" : "")
        + '<span class="sub" style="max-width:none"><a href="' + esc(v.url) + '">' + esc(v.url) + "</a>"
        + (v.page_date_if_shown ? " · page dated " + esc(v.page_date_if_shown) : " · no date on the page") + " · checked " + esc(v.checked_at) + "</span></td></tr>"
    ).join("") + "</tbody></table></div>";
}

function renderLists(){
  document.getElementById("stamp-date").textContent = OBSERVED;
  document.getElementById("gaps").innerHTML = GAPS.map(g => "<li><b>" + esc(g.who) + "</b> — " + esc(g.text) + "</li>").join("");
  document.getElementById("how").innerHTML = HOW.map(h => "<li><b>" + esc(h.who) + "</b> — " + esc(h.text) + "</li>").join("");
  document.getElementById("sources").innerHTML = SOURCES.map(g =>
    '<li style="grid-column:1/-1"><details><summary>' + esc(g.who) + " (" + g.urls.length + ")</summary><ul style=\"margin:6px 0 10px\">"
    + g.urls.map(u => '<li><a href="' + esc(u) + '">' + esc(u.replace(/^https?:\/\//, "")) + "</a></li>").join("") + "</ul></details></li>").join("");
}

/* ---------------- interface ---------------- */
const DEFAULTS = { "in-vcpu":2, "in-ram":8, "in-tol":0, "in-disk":100, "in-ha":0, "in-pitr":0, "in-bk":0, "in-hours":730 };
const RESET_STATE = { vcpu:2, ram:8, tol:0, disk:100, ha:0, pitr:0, bk:0, hours:730, burst:false, gated:false };

function syncInputs(){
  document.getElementById("in-vcpu").value = S.vcpu; document.getElementById("in-ram").value = S.ram;
  document.getElementById("in-disk").value = S.disk; document.getElementById("in-ha").value = S.ha;
  document.getElementById("in-pitr").value = S.pitr;
}

stampFx();
wireTabs(render);
wireSort(SORT, render);
bindControls({
  "in-vcpu": ["vcpu", true], "in-ram": ["ram", true], "in-tol": ["tol", true], "in-disk": ["disk", true],
  "in-ha": ["ha", true], "in-pitr": ["pitr", true], "in-bk": ["bk", true], "in-hours": ["hours", true]
}, render);

document.getElementById("presets").innerHTML = Object.entries(PRESETS).map(([k, p]) =>
  '<button type="button" data-p="' + k + '" aria-pressed="false">' + esc(p.label) + "</button>").join("");
document.getElementById("presets").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  Object.assign(S, PRESETS[b.dataset.p]);
  syncInputs();
  [...e.currentTarget.children].forEach(x => x.setAttribute("aria-pressed", x === b));
  render();
});
document.getElementById("opts").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  S[b.dataset.o] = !S[b.dataset.o];
  b.setAttribute("aria-pressed", S[b.dataset.o]);
  render();
});
wireReset(DEFAULTS, RESET_STATE, render, () => {
  [...document.getElementById("opts").children].forEach(b => b.setAttribute("aria-pressed", "false"));
  [...document.getElementById("presets").children].forEach(b => b.setAttribute("aria-pressed", "false"));
});
renderLists();
renderStatus();
render();
