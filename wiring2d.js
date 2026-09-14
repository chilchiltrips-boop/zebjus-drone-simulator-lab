const NS = "http://www.w3.org/2000/svg";
const COLORS = { power: "#f14b43", ground: "#76848d", signal: "#f5f8f6", phase: "#398cff", invalid: "#ff4fd8" };
const IO = ["IO0", "IO1", "IO3", "IO6"];
const PHASES = ["U", "V", "W"];

function key(a, b) { return [a, b].sort().join("|"); }
function escNumber(id) { return Number(id.match(/(?:motor|esc|pdb\.esc|fc\.esc)(\d)/)?.[1] || 0); }

export function getPortDetail(id) {
  const n = escNumber(id);
  const phase = id.match(/\.(u|v|w)$/)?.[1]?.toUpperCase();
  if (/^motor\d\.[uvw]$/.test(id)) return {
    id, kind: "MOTOR PHASE", color: COLORS.phase, title: `M${n} motor phase ${phase}`,
    component: `M${n} A2212 brushless motor`, direction: "Three-phase input",
    connects: `ESC ${n} ${phase} phase output`, electrical: "Switched motor phase · not DC +/−",
    safety: "Any two motor phases may be swapped to reverse rotation. Never swap battery polarity."
  };
  if (/^esc\d\.[uvw]$/.test(id)) return {
    id, kind: "MOTOR PHASE", color: COLORS.phase, title: `ESC ${n} phase ${phase}`,
    component: `30 A ESC ${n}`, direction: "Three-phase output",
    connects: `M${n} motor phase ${phase}`, electrical: "High-current commutated phase",
    safety: "Seat and insulate every bullet connector. Exposed metal can short between phases."
  };
  if (/^esc\d\.power\+$/.test(id)) return {
    id, kind: "BATTERY +", color: COLORS.power, title: `ESC ${n} positive power lead`, component: `30 A ESC ${n}`,
    direction: "DC power input", connects: `PDB ESC${n} + solder pad`, electrical: "LiPo positive · red wire",
    safety: "Reversed battery polarity can destroy the ESC immediately."
  };
  if (/^esc\d\.power-$/.test(id)) return {
    id, kind: "GROUND / −", color: COLORS.ground, title: `ESC ${n} negative power lead`, component: `30 A ESC ${n}`,
    direction: "DC return input", connects: `PDB ESC${n} − / GND pad`, electrical: "LiPo negative · black wire",
    safety: "Solder only with the LiPo disconnected, then inspect for a + to − bridge."
  };
  if (/^pdb\.esc\d\+$/.test(id)) return {
    id, kind: "PDB + PAD", color: COLORS.power, title: `PDB ESC${n} + pad`, component: "F450 bottom power-distribution plate",
    direction: "Distributed DC output", connects: `ESC ${n} red positive lead`, electrical: "Battery positive copper rail",
    safety: "The + and − pads must stay physically separated by clean solder joints."
  };
  if (/^pdb\.esc\d-$/.test(id)) return {
    id, kind: "PDB − / GND", color: COLORS.ground, title: `PDB ESC${n} − pad`, component: "F450 bottom power-distribution plate",
    direction: "Distributed DC return", connects: `ESC ${n} black negative lead`, electrical: "Battery negative / power ground rail",
    safety: "Check there is no continuity between BAT + and BAT − before connecting the LiPo."
  };
  if (/^esc\d\.s$/.test(id)) return {
    id, kind: "PWM SIGNAL", color: COLORS.signal, title: `ESC ${n} signal wire`, component: `30 A ESC ${n} control lead`,
    direction: "Command input", connects: `FC ESC${n} signal (${IO[n - 1]})`, electrical: "Low-power PWM command · S",
    safety: "Keep ESC numbering one-to-one with the firmware motor map."
  };
  if (/^fc\.esc\d\.s$/.test(id)) return {
    id, kind: "PWM OUTPUT", color: COLORS.signal, title: `FC ESC${n} signal pin`, component: "ZEBJUS custom flight controller",
    direction: "Motor command output", connects: `ESC ${n} signal wire`, electrical: `${IO[n - 1]} · ESC${n} PWM`,
    safety: "This signal is not a motor-power output; it only commands the ESC."
  };
  if (/^esc\d\.vcc$/.test(id)) return {
    id, kind: "CONTROL VCC", color: COLORS.power, title: `ESC ${n} control VCC`, component: `ESC ${n} three-wire control plug`,
    direction: "Supply/BEC rail — verify direction", connects: `FC ESC${n} VCC row`, electrical: "VCC · actual voltage depends on the ESC/BEC",
    safety: "Do not parallel multiple BEC outputs until the ESC and FC power policy is confirmed."
  };
  if (/^fc\.esc\d\.vcc$/.test(id)) return {
    id, kind: "CONTROL VCC", color: COLORS.power, title: `FC ESC${n} VCC pin`, component: "ZEBJUS custom flight controller",
    direction: "Common supply rail", connects: `ESC ${n} VCC wire if permitted`, electrical: "VCC row · not the PWM signal",
    safety: "Gerber confirms the common net; confirm the real supply source before connecting all four red wires."
  };
  if (/^esc\d\.gnd$/.test(id)) return {
    id, kind: "SIGNAL GND", color: COLORS.ground, title: `ESC ${n} control ground`, component: `ESC ${n} three-wire control plug`,
    direction: "Signal reference", connects: `FC ESC${n} GND row`, electrical: "Logic ground · black/brown wire",
    safety: "PWM needs a shared ground reference even when the control VCC wire is not used."
  };
  if (/^fc\.esc\d\.gnd$/.test(id)) return {
    id, kind: "SIGNAL GND", color: COLORS.ground, title: `FC ESC${n} ground pin`, component: "ZEBJUS custom flight controller",
    direction: "Signal reference", connects: `ESC ${n} control ground`, electrical: "Common GND row",
    safety: "Do not confuse this header row with the adjacent VCC or signal row."
  };
  if (id === "battery.xt60+") return {
    id, kind: "BATTERY +", color: COLORS.power, title: "LiPo XT60 positive", component: "3S 2200 mAh LiPo",
    direction: "High-current DC output", connects: "PDB BAT +", electrical: "3S LiPo positive · red lead",
    safety: "Connect the battery last, after polarity and short-circuit checks."
  };
  if (id === "battery.xt60-") return {
    id, kind: "BATTERY −", color: COLORS.ground, title: "LiPo XT60 negative", component: "3S 2200 mAh LiPo",
    direction: "High-current DC return", connects: "PDB BAT − / GND", electrical: "3S LiPo negative · black lead",
    safety: "Never force or reverse an XT60 connector."
  };
  if (id === "pdb.bat+") return {
    id, kind: "PDB BAT +", color: COLORS.power, title: "PDB battery positive pad", component: "F450 bottom power-distribution plate",
    direction: "Main DC input", connects: "LiPo XT60 positive", electrical: "BAT + copper rail",
    safety: "Verify the printed + mark and physical pad before soldering."
  };
  return {
    id, kind: "PDB BAT −", color: COLORS.ground, title: "PDB battery negative pad", component: "F450 bottom power-distribution plate",
    direction: "Main DC return", connects: "LiPo XT60 negative", electrical: "BAT − / GND copper rail",
    safety: "Verify no continuity to BAT + before connecting the LiPo."
  };
}

function buildLayout() {
  const ports = new Map();
  const units = [
    { n: 1, motor: [190, 105], esc: [380, 245], pad: [500, 305] },
    { n: 2, motor: [1010, 105], esc: [820, 245], pad: [700, 305] },
    { n: 3, motor: [1010, 655], esc: [820, 515], pad: [700, 455] },
    { n: 4, motor: [190, 655], esc: [380, 515], pad: [500, 455] }
  ];
  const add = (id, x, y) => ports.set(id, { id, x, y, ...getPortDetail(id) });
  units.forEach(unit => {
    const [mx, my] = unit.motor, [ex, ey] = unit.esc;
    const dx = ex - mx, dy = ey - my, len = Math.hypot(dx, dy), px = -dy / len, py = dx / len;
    PHASES.forEach((phase, index) => {
      const spread = (index - 1) * 17;
      add(`motor${unit.n}.${phase.toLowerCase()}`, mx + dx * .22 + px * spread, my + dy * .22 + py * spread);
      add(`esc${unit.n}.${phase.toLowerCase()}`, mx + dx * .76 + px * spread, my + dy * .76 + py * spread);
    });
    const inwardX = unit.pad[0] - ex, inwardY = unit.pad[1] - ey;
    add(`esc${unit.n}.power+`, ex + inwardX * .27 - 8, ey + inwardY * .27 - 8);
    add(`esc${unit.n}.power-`, ex + inwardX * .27 + 8, ey + inwardY * .27 + 8);
    add(`pdb.esc${unit.n}+`, unit.pad[0] - 9, unit.pad[1] - 9);
    add(`pdb.esc${unit.n}-`, unit.pad[0] + 9, unit.pad[1] + 9);
    const signalBaseX = ex + inwardX * .5, signalBaseY = ey + inwardY * .5;
    add(`esc${unit.n}.s`, signalBaseX - 12, signalBaseY + 16);
    add(`esc${unit.n}.vcc`, signalBaseX, signalBaseY + 16);
    add(`esc${unit.n}.gnd`, signalBaseX + 12, signalBaseY + 16);
    const fcX = 548 + (unit.n - 1) * 35;
    add(`fc.esc${unit.n}.s`, fcX - 8, 333);
    add(`fc.esc${unit.n}.vcc`, fcX, 333);
    add(`fc.esc${unit.n}.gnd`, fcX + 8, 333);
  });
  add("pdb.bat+", 578, 468); add("pdb.bat-", 622, 468);
  add("battery.xt60+", 578, 625); add("battery.xt60-", 622, 625);
  return { ports, units };
}

function referenceConnections() {
  const list = [];
  for (let n = 1; n <= 4; n += 1) {
    PHASES.forEach(phase => list.push({ a: `motor${n}.${phase.toLowerCase()}`, b: `esc${n}.${phase.toLowerCase()}`, kind: "phase", label: `M${n} ${phase} phase`, valid: true }));
    list.push({ a: `esc${n}.power+`, b: `pdb.esc${n}+`, kind: "power", label: `ESC${n} + to PDB +`, valid: true });
    list.push({ a: `esc${n}.power-`, b: `pdb.esc${n}-`, kind: "ground", label: `ESC${n} − to PDB −`, valid: true });
    list.push({ a: `esc${n}.s`, b: `fc.esc${n}.s`, kind: "signal", label: `ESC${n} S to ${IO[n - 1]}`, valid: true });
    list.push({ a: `esc${n}.vcc`, b: `fc.esc${n}.vcc`, kind: "power", label: `ESC${n} VCC rail`, valid: true });
    list.push({ a: `esc${n}.gnd`, b: `fc.esc${n}.gnd`, kind: "ground", label: `ESC${n} signal GND`, valid: true });
  }
  list.push({ a: "battery.xt60+", b: "pdb.bat+", kind: "power", label: "XT60 + to BAT +", valid: true });
  list.push({ a: "battery.xt60-", b: "pdb.bat-", kind: "ground", label: "XT60 − to BAT −", valid: true });
  return list.map((wire, index) => ({ ...wire, id: `reference-${index}` }));
}

const REFERENCE = referenceConnections();
const VALID = new Map(REFERENCE.map(wire => [key(wire.a, wire.b), wire]));

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  return node;
}

function route(a, b, offset = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / length * offset, py = dx / length * offset;
  return `M ${a.x} ${a.y} C ${a.x + dx * .34 + px} ${a.y + dy * .12 + py}, ${a.x + dx * .66 + px} ${a.y + dy * .88 + py}, ${b.x} ${b.y}`;
}

export function initWiringDesigner({ workshop, toast, onPortInspect, onShow3D, onCountChange }) {
  const svg = document.querySelector("#wiringCanvas");
  const wrap = document.querySelector("#designerCanvasWrap");
  const hint = document.querySelector("#drawingHint");
  const selection = document.querySelector("#drawingSelection");
  const status = document.querySelector("#drawingStatus");
  const { ports, units } = buildLayout();
  const state = { wires: [], filter: "all", start: null, dragOrigin: null, selectedWire: null, selectedPort: null, dragging: false, moved: 0, history: [], suppressClick: false };

  try {
    const saved = JSON.parse(localStorage.getItem("zebjus-wire-drawing-v1") || "[]");
    if (Array.isArray(saved)) state.wires = saved.filter(wire => ports.has(wire.a) && ports.has(wire.b));
  } catch (_) {}

  function baseDrawing() {
    const base = svgNode("g", { class: "schematic-base" });
    units.forEach(unit => {
      const [mx, my] = unit.motor;
      const arm = svgNode("line", { x1: 600, y1: 380, x2: mx, y2: my, stroke: unit.n <= 2 ? "#b93131" : "#151d23", "stroke-width": 62, "stroke-linecap": "round", class: unit.n <= 2 ? "schematic-arm-red" : "schematic-arm-black" });
      base.append(arm);
      base.append(svgNode("line", { x1: 600, y1: 380, x2: mx, y2: my, class: "schematic-truss" }));
      base.append(svgNode("circle", { cx: mx, cy: my, r: 48, class: "schematic-motor" }));
      base.append(svgNode("circle", { cx: mx, cy: my, r: 25, class: "schematic-motor-core" }));
      const esc = svgNode("rect", { x: unit.esc[0] - 51, y: unit.esc[1] - 29, width: 102, height: 58, rx: 10, class: "schematic-esc", transform: `rotate(${unit.n === 1 || unit.n === 3 ? 36 : -36} ${unit.esc[0]} ${unit.esc[1]})` });
      base.append(esc);
      const mLabel = svgNode("text", { x: mx, y: my - 64, class: "schematic-label" }); mLabel.textContent = `M${unit.n} · ${unit.n % 2 ? "CW" : "CCW"}`; base.append(mLabel);
      const eLabel = svgNode("text", { x: unit.esc[0], y: unit.esc[1] + 6, class: "schematic-label" }); eLabel.textContent = `ESC ${unit.n}`; base.append(eLabel);
    });
    base.append(svgNode("path", { class: "schematic-plate", d: "M465 285 L735 285 L770 320 L770 440 L735 475 L465 475 L430 440 L430 320 Z" }));
    base.append(svgNode("rect", { x: 523, y: 322, width: 154, height: 116, rx: 12, class: "schematic-fc" }));
    const fc = svgNode("text", { x: 600, y: 382, class: "schematic-label" }); fc.textContent = "ZEBJUS FC"; base.append(fc);
    const fcSub = svgNode("text", { x: 600, y: 405, class: "schematic-sub" }); fcSub.textContent = "ESC1–ESC4 OUTPUT BANK"; base.append(fcSub);
    base.append(svgNode("rect", { x: 520, y: 635, width: 160, height: 82, rx: 12, class: "schematic-battery" }));
    const battery = svgNode("text", { x: 600, y: 676, class: "schematic-label" }); battery.textContent = "3S LiPo"; base.append(battery);
    const batterySub = svgNode("text", { x: 600, y: 699, class: "schematic-sub" }); batterySub.textContent = "XT60"; base.append(batterySub);
    const front = svgNode("text", { x: 600, y: 46, class: "schematic-front" }); front.textContent = "↑ FRONT"; base.append(front);
    const pdb = svgNode("text", { x: 600, y: 456, class: "schematic-sub" }); pdb.textContent = "BOTTOM PDB · + / − SOLDER PADS"; base.append(pdb);
    return base;
  }

  function drawPorts(layer) {
    ports.forEach(port => {
      const group = svgNode("g", { "data-port-group": port.id });
      const circle = svgNode("circle", { cx: port.x, cy: port.y, r: 8, fill: port.color, class: `wire-port ${state.selectedPort === port.id ? "active" : ""}`, "data-port": port.id, tabindex: 0, role: "button", "aria-label": `${port.title}. ${port.connects}` });
      group.append(circle);
      if (/pdb\.|fc\.esc/.test(port.id)) {
        const label = svgNode("text", { x: port.x, y: port.y - 13, class: "wire-port-label", "text-anchor": "middle" });
        label.textContent = port.id.includes(".s") ? "S" : port.id.includes("vcc") || port.id.endsWith("+") ? "+" : "−";
        group.append(label);
      }
      layer.append(group);
    });
  }

  function filterMatches(wire) {
    if (state.filter === "all") return true;
    if (state.filter === "power") return wire.kind === "power" || wire.kind === "ground";
    return wire.kind === state.filter;
  }

  function render() {
    svg.replaceChildren();
    svg.append(baseDrawing());
    const wireLayer = svgNode("g", { class: "wires-layer" });
    state.wires.forEach((wire, index) => {
      const a = ports.get(wire.a), b = ports.get(wire.b);
      if (!a || !b) return;
      const path = svgNode("path", {
        d: route(a, b, ((index % 5) - 2) * 2),
        class: `wire-path ${wire.kind} ${wire.valid ? "" : "invalid"} ${filterMatches(wire) ? "" : "dimmed"} ${state.selectedWire === wire.id ? "selected" : ""}`,
        stroke: wire.valid ? COLORS[wire.kind] : COLORS.invalid,
        "data-wire": wire.id,
        "aria-label": wire.label
      });
      wireLayer.append(path);
    });
    svg.append(wireLayer);
    const portLayer = svgNode("g", { class: "ports-layer" }); drawPorts(portLayer); svg.append(portLayer);
    const preview = svgNode("path", { id: "wirePreview", class: "wire-preview", d: "" }); svg.append(preview);
    bindSvgEvents();
    updateStatus();
  }

  function remember() { state.history.push(state.wires.map(wire => ({ ...wire }))); if (state.history.length > 40) state.history.shift(); }

  function createWire(a, b) {
    if (!ports.has(a) || !ports.has(b) || a === b) return;
    if (state.wires.some(wire => key(wire.a, wire.b) === key(a, b))) { toast("That wire is already in the drawing"); return; }
    remember();
    const exact = VALID.get(key(a, b));
    const occupied = state.wires.some(wire => wire.a === a || wire.b === a || wire.a === b || wire.b === b);
    const source = getPortDetail(a);
    const wire = exact && !occupied
      ? { ...exact, id: `wire-${Date.now()}-${state.wires.length}` }
      : { a, b, id: `wire-${Date.now()}-${state.wires.length}`, kind: source.kind.includes("PHASE") ? "phase" : source.kind.includes("SIGNAL") || source.kind.includes("PWM") ? "signal" : source.kind.includes("GND") || source.kind.includes("−") ? "ground" : "power", label: occupied ? "Port already used" : "Incorrect terminal pair", valid: false };
    state.wires.push(wire);
    state.selectedWire = wire.id;
    state.selectedPort = null;
    toast(wire.valid ? `${wire.label} drawn` : `${wire.label} — shown in magenta`);
    render();
  }

  function showPort(id, event) {
    const port = ports.get(id); if (!port) return;
    state.selectedPort = id;
    selection.innerHTML = `<div class="selected-port-card" style="--port-color:${port.color}"><i></i><span><strong>${port.title}</strong><small>${port.component}<br>${port.direction} → ${port.connects}<br>${port.electrical}</small></span></div>`;
    onPortInspect?.(port, event ? { x: event.clientX, y: event.clientY } : null);
  }

  function bindSvgEvents() {
    svg.querySelectorAll(".wire-port").forEach(portNode => {
      portNode.addEventListener("pointerdown", event => {
        event.preventDefault(); event.stopPropagation();
        state.dragOrigin = portNode.dataset.port; state.dragging = true; state.moved = 0;
        showPort(state.dragOrigin, event);
        portNode.setPointerCapture?.(event.pointerId);
      });
      portNode.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const id = portNode.dataset.port;
        if (state.start && state.start !== id) { const first = state.start; state.start = null; createWire(first, id); }
        else { state.start = id; showPort(id, event); hint.innerHTML = `<strong>${getPortDetail(id).title}</strong> selected · choose its matching terminal.`; }
      });
    });
    svg.querySelectorAll(".wire-path").forEach(path => path.addEventListener("click", event => {
      event.stopPropagation(); state.selectedWire = path.dataset.wire; state.selectedPort = null; render();
      const wire = state.wires.find(item => item.id === path.dataset.wire);
      if (wire) hint.innerHTML = `<strong>${wire.valid ? "Correct" : "Check this wire"}:</strong> ${wire.label} · press Delete to remove.`;
    }));
  }

  svg.addEventListener("pointermove", event => {
    if (!state.dragging || !state.dragOrigin) return;
    const rect = svg.getBoundingClientRect();
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    const start = ports.get(state.dragOrigin); state.moved += Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
    const preview = svg.querySelector("#wirePreview"); if (preview) preview.setAttribute("d", route(start, local));
  });

  window.addEventListener("pointerup", event => {
    if (!state.dragging) return;
    const start = state.dragOrigin;
    state.dragOrigin = null;
    state.dragging = false;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".wire-port")?.dataset.port;
    const preview = svg.querySelector("#wirePreview"); if (preview) preview.setAttribute("d", "");
    if (target && target !== start) { state.start = null; state.suppressClick = true; createWire(start, target); return; }
    hint.innerHTML = `<strong>${getPortDetail(start).title}</strong> selected · now tap its matching terminal.`;
  });

  svg.addEventListener("click", event => {
    if (state.suppressClick) { state.suppressClick = false; return; }
    const portNode = event.target.closest?.(".wire-port");
    if (!portNode) return;
    const id = portNode.dataset.port;
    showPort(id, event);
    if (state.start && state.start !== id) { const first = state.start; state.start = null; createWire(first, id); }
    else state.start = id;
  });

  function updateStatus() {
    const valid = state.wires.filter(wire => wire.valid).length;
    const invalid = state.wires.length - valid;
    status.textContent = `${state.wires.length} WIRES${invalid ? ` · ${invalid} CHECK` : ""}`;
    status.classList.toggle("profile", invalid > 0);
    onCountChange?.({ total: state.wires.length, valid, invalid, referenceTotal: REFERENCE.length });
  }

  function setFilter(filter) {
    state.filter = filter;
    document.querySelectorAll("[data-wire-filter]").forEach(button => button.classList.toggle("active", button.dataset.wireFilter === filter));
    render();
  }

  function loadReference() {
    remember(); state.wires = REFERENCE.map((wire, index) => ({ ...wire, id: `reference-${Date.now()}-${index}` })); state.selectedWire = null;
    render(); toast("Correct F450 reference wiring loaded");
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) { toast("Nothing to undo"); return; }
    state.wires = previous; state.selectedWire = null; render();
  }

  function clear() {
    if (!state.wires.length) return;
    remember(); state.wires = []; state.selectedWire = null; state.selectedPort = null; selection.innerHTML = '<span class="empty-port">Select or drag from a port to inspect it.</span>'; render(); toast("Wiring canvas cleared");
  }

  function saveAndShow3D() {
    try { localStorage.setItem("zebjus-wire-drawing-v1", JSON.stringify(state.wires)); } catch (_) {}
    workshop?.setCustomWires?.(state.wires);
    onShow3D?.();
    const invalid = state.wires.filter(wire => !wire.valid).length;
    toast(invalid ? `Saved with ${invalid} connection${invalid === 1 ? "" : "s"} to correct` : `${state.wires.length} wires saved and mirrored in 3D`);
  }

  document.querySelectorAll("[data-wire-filter]").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.wireFilter)));
  document.querySelector("#loadReferenceWires")?.addEventListener("click", loadReference);
  document.querySelector("#undoWire")?.addEventListener("click", undo);
  document.querySelector("#clearWires")?.addEventListener("click", clear);
  document.querySelector("#saveWires3d")?.addEventListener("click", saveAndShow3D);
  window.addEventListener("keydown", event => {
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedWire && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
      event.preventDefault(); remember(); state.wires = state.wires.filter(wire => wire.id !== state.selectedWire); state.selectedWire = null; render();
    }
  });

  render();
  if (state.wires.length) workshop?.setCustomWires?.(state.wires);
  return { loadReference, undo, clear, saveAndShow3D, show: () => render(), getWires: () => state.wires.map(wire => ({ ...wire })) };
}
