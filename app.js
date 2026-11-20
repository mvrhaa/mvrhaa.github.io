"use strict";

const DATA_URL = location.hostname.endsWith("github.io")
  ? "https://raw.githubusercontent.com/mvrhaa/mvrhaa/main/data/repos.json"
  : "data.json";
const SVG = "http://www.w3.org/2000/svg";
const TRUNK = "#3d444d";
const BG = "#0d1117";

const panel = document.getElementById("panel");
const graph = document.getElementById("graph");
const svg = document.getElementById("lanes");
const rowsBox = document.getElementById("rows");
const legendBox = document.getElementById("legend");

let data = null;
let geo = null;
let selected = null;

function slug(lang) {
  return lang.toLowerCase().replace(/\+/g, "p").replace(/#/g, "sharp").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function safe(url, prefix) {
  return typeof url === "string" && url.startsWith(prefix) ? url : null;
}

function el(name, attrs = {}, ns = null) {
  const node = ns ? document.createElementNS(ns, name) : document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function counts(repos) {
  const n = new Map();
  for (const r of repos) n.set(r.lang, (n.get(r.lang) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function laneOrder(repos) {
  const order = [];
  for (const r of [...repos].reverse()) if (!order.includes(r.lang)) order.push(r.lang);
  return order;
}

function measure() {
  const narrow = matchMedia("(max-width: 760px)").matches;
  const step = narrow ? 28 : 24;
  const slot = narrow ? 84 : 66;
  const top = 14;
  const order = laneOrder(data.repos);
  const width = graph.clientWidth;
  const span = step * order.length;
  const height = top + data.repos.length * slot + 30;
  const left = 6;
  return {
    step, slot, order, width, height,
    xs: Object.fromEntries(order.map((lang, i) => [lang, step * (i + 1)])),
    ys: data.repos.map((_, k) => top + k * slot + 11),
    centre: Math.round(width / 2 - span / 2),
    left,
    text: left + span + 30,
  };
}

function drawLanes() {
  geo = measure();
  const { width, height, xs, ys, step, order } = geo;
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  graph.style.height = `${height}px`;

  const defs = el("defs", {}, SVG);
  const grad = el("linearGradient", { id: "fade", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: height }, SVG);
  grad.append(el("stop", { offset: ".7", "stop-color": TRUNK }, SVG), el("stop", { offset: "1", "stop-color": TRUNK, "stop-opacity": 0 }, SVG));
  defs.append(grad);
  svg.append(defs);

  const tree = el("g", { id: "tree" }, SVG);
  tree.append(el("path", { d: `M0 0V${height}`, stroke: "url(#fade)", "stroke-width": 2.5, fill: "none" }, SVG));

  const oldest = {};
  data.repos.forEach((r, k) => { oldest[r.lang] = ys[k]; });
  const groups = {};
  for (const lang of order) {
    const g = el("g", { class: "lane", "data-lang": lang }, SVG);
    const x = xs[lang];
    const y = oldest[lang];
    g.append(el("path", {
      d: `M0 ${y + 30}C0 ${y + 14} ${x} ${y + 18} ${x} ${y}V0`,
      stroke: data.colors[lang] || "#8b949e", "stroke-width": 2.5, fill: "none", "stroke-linecap": "round",
    }, SVG));
    groups[lang] = g;
    tree.append(g);
  }
  data.repos.forEach((r, k) => {
    groups[r.lang].append(el("circle", { cx: xs[r.lang], cy: ys[k], r: 5.5, fill: data.colors[r.lang] || "#8b949e", stroke: BG, "stroke-width": 3 }, SVG));
  });
  for (const lang of order) {
    const hit = el("rect", { class: "hit", x: xs[lang] - step / 2, y: 0, width: step, height, "data-lang": lang }, SVG);
    hit.append(el("title", {}, SVG));
    hit.firstChild.textContent = `${lang}: show repositories`;
    tree.append(hit);
  }
  svg.append(tree);
  place(false);
}

function place(animate) {
  const tree = document.getElementById("tree");
  if (!tree) return;
  const lanes = svg.querySelectorAll(".lane");
  if (!animate) lanes.forEach((g) => { g.style.transition = "none"; });
  lanes.forEach((g) => g.classList.toggle("on", g.dataset.lang === selected));
  for (const b of legendBox.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.lang === selected));
  if (selected) panel.dataset.selected = selected;
  else delete panel.dataset.selected;
  if (!animate) tree.style.transition = "none";
  tree.style.transform = `translateX(${selected ? geo.left : geo.centre}px)`;
  if (!animate) {
    tree.getBoundingClientRect();
    tree.style.transition = "";
    lanes.forEach((g) => { g.style.transition = ""; });
  }
}

function showRows(animate) {
  for (const old of rowsBox.children) {
    old.classList.add("out");
    old.classList.remove("in");
  }
  const leaving = [...rowsBox.children];
  setTimeout(() => leaving.forEach((n) => n.remove()), animate ? 320 : 0);
  if (!selected) return;
  let i = 0;
  data.repos.forEach((r, k) => {
    if (r.lang !== selected) return;
    const li = el("li", { class: "row" });
    li.style.top = `${geo.ys[k] - 12}px`;
    li.style.left = `${geo.text}px`;
    li.style.width = `${geo.width - geo.text}px`;
    li.style.setProperty("--i", i++);
    const time = el("time", { datetime: r.date });
    time.textContent = r.date;
    const body = el("div", { class: "body" });
    const href = safe(r.url, "https://github.com/");
    const name = href ? el("a", { href, target: "_blank", rel: "noopener" }) : el("span");
    name.textContent = r.name;
    const about = el("p");
    about.textContent = r.about || "";
    body.append(name, about);
    li.append(time, body);
    rowsBox.append(li);
  });
  const fresh = [...rowsBox.querySelectorAll(".row:not(.out)")];
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => fresh.forEach((n) => n.classList.add("in"))));
  else fresh.forEach((n) => { n.style.transition = "none"; n.classList.add("in"); n.getBoundingClientRect(); n.style.transition = ""; });
}

function select(lang, animate = true) {
  selected = lang && geo.order.includes(lang) ? lang : null;
  place(animate);
  showRows(animate);
  const hash = selected ? `#${slug(selected)}` : "";
  if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
}

function fromHash() {
  const want = decodeURIComponent(location.hash.slice(1));
  return geo.order.find((lang) => slug(lang) === want) || null;
}

function fillSide() {
  document.getElementById("name").textContent = data.name;
  const about = document.getElementById("about");
  about.replaceChildren();
  data.about.forEach((line, i) => {
    if (i) about.append(el("br"));
    about.append(line);
  });
  legendBox.replaceChildren();
  for (const [lang, n] of counts(data.repos)) {
    const li = el("li");
    const b = el("button", { type: "button", "aria-pressed": "false" });
    b.dataset.lang = lang;
    const dot = el("span", { class: "dot" });
    dot.style.background = data.colors[lang] || "#8b949e";
    const name = el("span");
    name.textContent = lang;
    const num = el("span", { class: "n" });
    num.textContent = n;
    b.append(dot, name, num);
    li.append(b);
    legendBox.append(li);
  }
  const foot = document.getElementById("foot");
  for (const link of data.links || []) {
    const href = safe(link.url, "https://");
    if (!href) continue;
    const a = el("a", { href, target: "_blank", rel: "noopener" });
    a.textContent = link.label;
    foot.insertBefore(a, foot.lastElementChild);
  }
}

function wire() {
  legendBox.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) select(selected === b.dataset.lang ? null : b.dataset.lang);
  });
  svg.addEventListener("click", (e) => {
    const lang = e.target.dataset && e.target.dataset.lang;
    select(lang && lang !== selected ? lang : null);
  });
  graph.addEventListener("click", (e) => {
    if (e.target === graph || e.target === rowsBox) select(null);
  });
  svg.addEventListener("pointerover", (e) => {
    const lang = e.target.dataset && e.target.dataset.lang;
    if (!lang || selected) return;
    graph.classList.add("hovering");
    for (const g of svg.querySelectorAll(".lane")) g.classList.toggle("hover", g.dataset.lang === lang);
  });
  svg.addEventListener("pointerout", () => graph.classList.remove("hovering"));
  addEventListener("keydown", (e) => { if (e.key === "Escape") select(null); });
  addEventListener("hashchange", () => select(fromHash()));
  let pending = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { drawLanes(); showRows(false); });
  });
}

function fail() {
  const p = el("p", { class: "error" });
  p.textContent = "The repositories could not be loaded right now. They are all on ";
  const a = el("a", { href: "https://github.com/mvrhaa?tab=repositories" });
  a.textContent = "github.com/mvrhaa";
  p.append(a, ".");
  rowsBox.replaceWith(p);
}

fetch(DATA_URL, { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((json) => {
    data = json;
    fillSide();
    drawLanes();
    wire();
    const start = fromHash();
    if (start) setTimeout(() => select(start), 350);
  })
  .catch(fail);
