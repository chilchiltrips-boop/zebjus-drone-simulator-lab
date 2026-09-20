const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function initLearningLab({ workshop, buildState, steps, components, tests, toast, renderAssembly, setSceneMode }) {
  const lab = {
    mode: "assemble",
    component: "fc",
    inspectorTab: "function",
    test: "wiring",
    motor: 0,
    throttle: 0,
    aux: (() => {
      const defaults = { IO7: "unassigned", IO20: "unassigned", IO21: "unassigned", IO10: "unassigned" };
      try { return { ...defaults, ...JSON.parse(localStorage.getItem("zebjus-fc-aux-profile") || "{}") }; }
      catch (_) { return defaults; }
    })()
  };

  const ui = {
    steps: $("#stepsList"), shelf: $("#componentShelf"), testMenu: $("#testMenu"), drawingToolbox: $("#drawingToolbox"),
    panelEyebrow: $("#panelEyebrow"), panelTitle: $("#panelTitle"), progressNumber: $("#progressNumber"), progressTrack: $("#progressTrack"),
    assemble: $("#assembleGuide"), learn: $("#learnGuide"), test: $("#testGuide"), draw: $("#drawGuide"),
    sceneLabel: $("#sceneLabel"), sceneOperation: $("#sceneOperation"), sceneCounter: $("#sceneCounter"),
    targetHelp: $("#targetHelp"), benchStatus: $("#benchStatus"), stageHelp: $("#stageHelp"), partCount: $("#partCount"),
    componentImage: $("#componentImage"), componentFamily: $("#componentFamily"), componentTitle: $("#componentTitle"), componentModel: $("#componentModel"),
    componentStatus: $("#componentStatus"), inspector: $("#inspectorContent"), profileNote: $("#profileNote"), trace: $("#traceWiresBtn"),
    testTitle: $("#testTitle"), testDescription: $("#testDescription"), testControls: $("#testControls"), testResult: $("#testResult"), testSafety: $("#testSafety"),
    photoDialog: $("#photoDialog"), photoTitle: $("#photoTitle"), largePhoto: $("#largePhoto"), photoCaption: $("#photoCaption")
  };

  function selectedComponent() {
    return components.find(component => component.id === lab.component) || components[0];
  }

  function selectedTest() {
    return tests.find(test => test.id === lab.test) || tests[0];
  }

  function renderShelf() {
    const section = (title, list, note) => `
      <section class="shelf-section">
        <h3 class="shelf-title">${escapeText(title)} <span>${escapeText(note)}</span></h3>
        ${list.map(component => `
          <button class="shelf-card ${component.id === lab.component ? "active" : ""}" type="button" data-component="${component.id}">
            <img class="shelf-thumb" src="${component.image}" alt="" />
            <span><strong>${escapeText(component.title)}</strong><small>${escapeText(component.model)}</small></span>
            <span class="shelf-status ${component.optional ? "optional" : ""}">${component.optional ? "OPTION" : "CORE"}</span>
          </button>`).join("")}
      </section>`;
    ui.shelf.innerHTML = section("Core F450 kit", components.filter(component => !component.optional), "8 parts") +
      section("Expansion bay", components.filter(component => component.optional), "profile based");
    ui.shelf.querySelectorAll("[data-component]").forEach(button => button.addEventListener("click", () => selectComponent(button.dataset.component)));
  }

  function renderTestMenu() {
    ui.testMenu.innerHTML = tests.map((test, index) => `
      <button class="test-menu-card ${test.id === lab.test ? "active" : ""} ${test.planned ? "planned" : ""}" type="button" data-test="${test.id}" ${test.planned ? "aria-disabled=\"true\"" : ""}>
        <span class="test-index">${String(index + 1).padStart(2, "0")}</span>
        <span><strong>${escapeText(test.title)}</strong><small>${escapeText(test.sub)}</small></span>
        ${test.optional ? '<span class="shelf-status optional">OPTION</span>' : test.planned ? '<span class="shelf-status">FUTURE</span>' : ""}
      </button>`).join("");
    ui.testMenu.querySelectorAll("[data-test]").forEach(button => button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") {
        toast("Python hardware bridge is reserved for a future version");
        return;
      }
      selectTest(button.dataset.test);
    }));
  }

  function renderInspector() {
    const component = selectedComponent();
    ui.componentImage.src = component.image;
    ui.componentImage.alt = `${component.title} physical reference`;
    ui.componentFamily.textContent = component.family;
    ui.componentTitle.textContent = component.title;
    ui.componentModel.textContent = component.model;
    ui.componentStatus.textContent = component.status;
    ui.componentStatus.className = `status-pill ${component.optional ? "optional" : component.profile ? "profile" : ""}`;
    ui.profileNote.hidden = !component.profile;
    if (component.profile) {
      ui.profileNote.innerHTML = component.id === "fc"
        ? "<strong>Firmware assignment required</strong><p>STEP/Gerber verify the board geometry and nets. GPS/RX/Servo/LED names are not printed against individual AUX headers, so the app will not invent that mapping.</p>"
        : "<strong>Device profile required</strong><p>Logical wiring is available for study. Add the exact product model and pinout before using physical connector positions or supply values.</p>";
    }
    ui.trace.disabled = !component.wireable;
    ui.trace.textContent = component.optional ? "Connect virtual harness" : "Trace related wires";
    $$('[data-inspector-tab]').forEach(button => button.classList.toggle("active", button.dataset.inspectorTab === lab.inspectorTab));

    if (lab.inspectorTab === "function") {
      ui.inspector.innerHTML = `
        <div class="lesson-card"><strong>Purpose</strong><p>${escapeText(component.summary)}</p></div>
        <div class="lesson-card"><strong>Working principle</strong><p>${escapeText(component.working)}</p></div>
        <div class="lesson-card"><strong>Important safety</strong><p>${escapeText(component.safety)}</p></div>`;
    } else if (lab.inspectorTab === "ports") {
      const auxOptions = [["unassigned","Not assigned"],["gps","GPS data"],["rx","6CH receiver"],["servo1","SG90 Servo 1"],["servo2","SG90 Servo 2"],["led","Status LED"],["matrix-data","Matrix DIN (non-I²C)"]];
      const planner = component.id === "fc" ? `
        <div class="lesson-card port-planner">
          <strong>AUX firmware profile</strong>
          <p>Gerber-verified GPIOs; choose the intended firmware function. Selections are a lesson plan, not a live board configuration.</p>
          ${Object.entries(lab.aux).map(([pin,value]) => `<label><span>${pin}</span><select data-aux-pin="${pin}">${auxOptions.map(([option,label])=>`<option value="${option}" ${value===option?"selected":""}>${label}</option>`).join("")}</select></label>`).join("")}
          <div class="capacity-warning"><b>Capacity check</b><span>4 AUX signal pins are visible in the Gerber, while GPS + RX + 2 servos + status LED need five logical functions. Confirm whether GPS shares I²C/UART elsewhere or one function is onboard before final wiring.</span></div>
        </div>` : "";
      ui.inspector.innerHTML = `
        <div class="io-grid">
          <div class="io-card"><span>INPUTS</span><ul>${component.inputs.map(item => `<li>${escapeText(item)}</li>`).join("")}</ul></div>
          <div class="io-card output"><span>OUTPUTS</span><ul>${component.outputs.map(item => `<li>${escapeText(item)}</li>`).join("")}</ul></div>
        </div>
        <div class="port-table">${component.ports.map(([port, connection]) => `<div class="port-row"><strong><i class="pin-dot"></i>${escapeText(port)}</strong><span>${escapeText(connection)}</span></div>`).join("")}</div>${planner}`;
    } else {
      ui.inspector.innerHTML = `
        <div class="lesson-card"><strong>Before real connection</strong><ul class="check-list">${component.checks.map(item => `<li>${escapeText(item)}</li>`).join("")}</ul></div>
        <div class="lesson-card"><strong>Student checkpoint</strong><p>Explain the component's input, output and failure risk to a lab partner before moving to the next part.</p></div>`;
    }
    ui.sceneLabel.textContent = "COMPONENT INSPECTOR";
    ui.sceneOperation.textContent = component.title;
    ui.sceneCounter.textContent = component.optional ? "Optional expansion component" : "Core F450 component";
    ui.partCount.textContent = `${components.indexOf(component) + 1} / ${components.length} components`;
  }

  function testDefinition(id) {
    const definitions = {
      wiring: {
        description: "Reveal every core power, motor-phase and ESC control path. Signal wires remain visible even when the assembly lesson has not reached that step.",
        safety: "A visible route is a diagram, not proof of a correct real connection.",
        controls: `
          <div class="trace-map">
            <div class="trace-line"><span>LiPo XT60</span><i></i><span>PDB BAT + / −</span></div>
            <div class="trace-line"><span>PDB × 4</span><i></i><span>ESC red / black</span></div>
            <div class="trace-line"><span>ESC U / V / W</span><i></i><span>A2212 × 4</span></div>
            <div class="trace-line"><span>ESC1 / 2 / 3 / 4</span><i></i><span>IO0 / IO1 / IO3 / IO6</span></div>
          </div>
          <div class="button-grid" style="margin-top:9px">
            <button class="lab-button" type="button" data-action="trace-all">Show all S / VCC / GND</button>
            <button class="lab-button" type="button" data-action="top-view">Top wiring view</button>
          </div>`
      },
      continuity: {
        description: "Practise a battery-disconnected continuity and polarity check on the PDB before first power-up.",
        safety: "In the real lab, disconnect the LiPo before continuity mode.",
        controls: `<div class="control-card"><span class="control-label">Virtual probe test <output>BATTERY OFF</output></span><div class="button-grid"><button class="lab-button" type="button" data-action="short-test">Probe + to −</button><button class="lab-button" type="button" data-action="polarity-test">Trace all polarities</button></div></div>`
      },
      motor: {
        description: "Send a low virtual command to one motor at a time and compare the observed direction with the M1–M4 map.",
        safety: "Real motor-direction tests must be done with every propeller removed.",
        controls: `
          <div class="control-card"><span class="control-label">Select motor <output id="motorName">M1 · CW</output></span><div class="button-grid">${[1,2,3,4].map(value => `<button class="lab-button ${value === 1 ? "active" : ""}" type="button" data-motor="${value - 1}">M${value}</button>`).join("")}</div></div>
          <div class="control-card"><label for="throttleSlider">Virtual command <output id="throttleValue">0%</output></label><input id="throttleSlider" type="range" min="0" max="35" value="0" /><button class="lab-button stop" style="width:100%;margin-top:9px" type="button" data-action="motor-stop">STOP</button></div>`
      },
      receiver: {
        description: "Move six virtual radio channels and learn their neutral, low and high command values before a real receiver is bound.",
        safety: "Exact RX voltage, protocol and connector require the receiver model number and pinout.",
        controls: `<div class="control-card">${["CH1 Roll","CH2 Pitch","CH3 Throttle","CH4 Yaw","CH5 Mode","CH6 AUX"].map((name,index) => `<label class="channel-row"><span>${name}</span><input type="range" min="1000" max="2000" value="${index === 2 ? 1000 : 1500}" data-channel="${index}" /><output>${index === 2 ? 1000 : 1500} µs</output></label>`).join("")}</div>`
      },
      servo: {
        description: "Sweep two SG90 models while observing the separate signal, regulated power and common-ground requirements.",
        safety: "Do not power real servos from an MCU 3V3 pin. Confirm AUX assignments first.",
        controls: `<div class="control-card">${[1,2].map(value => `<label for="servo${value}">Servo ${value} angle <output id="servo${value}Value">0°</output></label><input id="servo${value}" data-servo="${value - 1}" type="range" min="-90" max="90" value="0" />`).join('<div style="height:12px"></div>')}</div>`
      },
      matrix: {
        description: "Preview status patterns and choose the electrical protocol only after checking the matrix controller or rear label.",
        safety: "A 16 × 16 panel needs its own correctly sized supply; the FC I²C header is a logic/sensor connection.",
        controls: `<div class="control-card"><span class="control-label">Connection profile <output>UNCONFIRMED</output></span><div class="matrix-controls"><select id="matrixProtocol"><option value="unknown">Choose after rear-label check</option><option value="i2c">I²C controller · SDA/SCL</option><option value="data">Addressable panel · DIN</option></select><input id="matrixColor" type="color" value="#6af4c5" aria-label="LED colour" /></div></div><div class="control-card"><span class="control-label">Virtual pattern <output>256 PIXELS</output></span><div class="button-grid"><button class="lab-button" data-pattern="arrow" type="button">Front arrow</button><button class="lab-button" data-pattern="status" type="button">Status bars</button><button class="lab-button" data-pattern="off" type="button">All off</button><button class="lab-button" data-pattern="rainbow" type="button">Colour sweep</button></div></div>`
      },
      pid: {
        description: "Explore how proportional, integral and derivative terms change a simplified virtual attitude response.",
        safety: "This conceptual graph is not a flight-ready tune and does not write values to the controller.",
        controls: `<div class="control-card">${[["P",80,0,200],["I",35,0,120],["D",25,0,100]].map(([name,value,min,max]) => `<label>${name} gain <output id="pid${name}Value">${value}</output></label><input data-pid="${name}" type="range" min="${min}" max="${max}" value="${value}" />`).join('<div style="height:9px"></div>')}<svg class="pid-chart" id="pidChart" viewBox="0 0 300 120" role="img" aria-label="Simplified PID step-response plot"><path class="axis" d="M18 10V104H292"/><path class="target" d="M18 45H292"/><path class="response" id="pidPath" d=""/></svg></div>`
      }
    };
    return definitions[id] || definitions.wiring;
  }

  function renderTest() {
    const test = selectedTest();
    const definition = testDefinition(test.id);
    ui.testTitle.textContent = test.title;
    ui.testDescription.textContent = definition.description;
    ui.testSafety.textContent = definition.safety;
    ui.testControls.innerHTML = definition.controls;
    setResult("idle", "Ready", "Use the virtual controls; no real hardware is connected.");
    ui.sceneLabel.textContent = "VIRTUAL TEST BENCH";
    ui.sceneOperation.textContent = test.title;
    ui.sceneCounter.textContent = test.optional ? "Optional module simulation" : "Core learning simulation";
    ui.partCount.textContent = `${tests.indexOf(test) + 1} / ${tests.length - 1} active labs`;
    bindTestControls(test.id);
    if (test.id === "pid") updatePid();
    if (test.id === "wiring") showAllWires();
  }

  function setResult(kind, title, message) {
    ui.testResult.innerHTML = `<span class="result-light ${kind}"></span><span><strong>${escapeText(title)}</strong><small>${escapeText(message)}</small></span>`;
  }

  function showAllWires() {
    setSceneMode("wiring");
    workshop?.setWiringMode(true, true);
    workshop?.showAllWiring?.(true);
  }

  function updatePid() {
    const sliders = [...ui.testControls.querySelectorAll("[data-pid]")];
    if (!sliders.length) return;
    const values = Object.fromEntries(sliders.map(slider => [slider.dataset.pid, Number(slider.value)]));
    sliders.forEach(slider => { const output = $(`#pid${slider.dataset.pid}Value`); if (output) output.textContent = slider.value; });
    const p = values.P / 100, i = values.I / 100, d = values.D / 100;
    const damping = Math.max(.08, Math.min(1.35, .22 + d * .72 - p * .09 + i * .08));
    const speed = 1.3 + p * 1.8 + i * .25;
    const points = [];
    for (let n = 0; n <= 80; n += 1) {
      const t = n / 80 * 5.3;
      const response = 1 - Math.exp(-damping * t) * (Math.cos(speed * t) + damping / Math.max(speed, .1) * Math.sin(speed * t));
      points.push(`${18 + n / 80 * 274},${104 - Math.max(-.15, Math.min(1.65, response)) * 59}`);
    }
    const path = $("#pidPath");
    if (path) path.setAttribute("d", `M${points.join(" L")}`);
  }

  function bindTestControls(id) {
    ui.testControls.onclick = event => {
      const motorButton = event.target.closest("[data-motor]");
      if (motorButton) {
        lab.motor = Number(motorButton.dataset.motor);
        ui.testControls.querySelectorAll("[data-motor]").forEach(button => button.classList.toggle("active", button === motorButton));
        const directions = ["CW", "CCW", "CW", "CCW"];
        $("#motorName").textContent = `M${lab.motor + 1} · ${directions[lab.motor]}`;
        workshop?.setMotorTest?.(lab.motor, lab.throttle);
        setResult("run", `M${lab.motor + 1} selected`, `${directions[lab.motor]} target direction · propeller shown only as a virtual indicator.`);
        return;
      }
      const patternButton = event.target.closest("[data-pattern]");
      if (patternButton) {
        const color = $("#matrixColor")?.value || "#6af4c5";
        workshop?.setMatrixPattern?.(patternButton.dataset.pattern, color);
        ui.testControls.querySelectorAll("[data-pattern]").forEach(button => button.classList.toggle("active", button === patternButton));
        const protocol = $("#matrixProtocol")?.value;
        setResult(protocol === "unknown" ? "warn" : "run", patternButton.textContent.trim(), protocol === "unknown" ? "Pattern previewed, but physical connection remains locked until protocol is confirmed." : `Virtual matrix using the selected ${protocol === "i2c" ? "I²C" : "DIN"} profile.`);
        return;
      }
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "trace-all") { showAllWires(); setResult("run", "All core wires visible", "White=S, red=VCC/+, black=GND/−, blue=three motor phases."); }
      if (action === "top-view") { workshop?.setCamera("top"); showAllWires(); setResult("run", "Top view locked", "Follow ESC1→IO0, ESC2→IO1, ESC3→IO3 and ESC4→IO6."); }
      if (action === "short-test") {
        const ready = (buildState.counts[6] || 0) >= steps[6].count;
        setResult(ready ? "pass" : "warn", ready ? "PASS · no simulated short" : "Build not ready", ready ? "Reference assembly keeps BAT + and BAT − isolated." : "Complete all four ESC power pairs and XT60 soldering in Assemble mode, then repeat.");
      }
      if (action === "polarity-test") { workshop?.focusComponent?.("pdb"); showAllWires(); setResult("pass", "Reference polarity traced", "BAT +→four ESC + pads; BAT −→four ESC − pads. Verify the real board with a meter."); }
      if (action === "motor-stop") { lab.throttle = 0; const slider = $("#throttleSlider"); if (slider) slider.value = "0"; const output = $("#throttleValue"); if (output) output.textContent = "0%"; workshop?.setMotorTest?.(-1, 0); setResult("pass", "Motor output stopped", "Virtual command returned to zero."); }
    };

    ui.testControls.oninput = event => {
      const target = event.target;
      if (target.id === "throttleSlider") {
        lab.throttle = Number(target.value);
        $("#throttleValue").textContent = `${lab.throttle}%`;
        workshop?.setMotorTest?.(lab.motor, lab.throttle);
        setResult(lab.throttle ? "run" : "idle", lab.throttle ? `M${lab.motor + 1} pulsing` : "Stopped", lab.throttle ? "Virtual low-power direction check only · props off in the real lab." : "Command is zero.");
      }
      if (target.matches("[data-channel]")) {
        target.nextElementSibling.textContent = `${target.value} µs`;
        setResult("run", `${target.closest("label").querySelector("span").textContent} = ${target.value} µs`, "Watch for correct travel, centre and failsafe before arming.");
      }
      if (target.matches("[data-servo]")) {
        const index = Number(target.dataset.servo), angle = Number(target.value);
        $(`#servo${index + 1}Value`).textContent = `${angle}°`;
        workshop?.setServoAngle?.(index, angle);
        setResult("run", `Servo ${index + 1}: ${angle}°`, "Virtual horn moved; check real linkage limits before applying this angle.");
      }
      if (target.matches("[data-pid]")) { updatePid(); setResult("run", "Response recalculated", "Simplified teaching model only; values are not sent to the flight controller."); }
      if (target.id === "matrixProtocol") {
        setResult(target.value === "unknown" ? "warn" : "pass", target.value === "unknown" ? "Protocol still locked" : "Profile selected", target.value === "i2c" ? "Use FC SDA IO4 + SCL IO5 + GND; power must still match the actual controller." : target.value === "data" ? "Use a confirmed AUX DATA output plus suitable external power and common ground." : "Inspect the matrix rear label/controller first.");
      }
      if (target.id === "matrixColor") workshop?.setMatrixPattern?.("status", target.value);
    };
  }

  function selectComponent(id) {
    lab.component = id;
    lab.inspectorTab = "function";
    renderShelf();
    renderInspector();
    workshop?.setWorkspaceMode?.("learn", buildState.counts);
    workshop?.focusComponent?.(id);
    setSceneMode("object");
  }

  function selectTest(id) {
    lab.test = id;
    renderTestMenu();
    workshop?.stopTests?.();
    workshop?.setWorkspaceMode?.("test", buildState.counts);
    workshop?.focusComponent?.(selectedTest().focus);
    setSceneMode("object");
    renderTest();
  }

  function setWorkspaceMode(mode) {
    lab.mode = mode;
    $$('[data-workspace-mode]').forEach(button => button.classList.toggle("active", button.dataset.workspaceMode === mode));
    ui.steps.hidden = mode !== "assemble";
    ui.shelf.hidden = mode !== "learn";
    ui.testMenu.hidden = mode !== "test";
    ui.drawingToolbox.hidden = mode !== "draw";
    ui.assemble.hidden = mode !== "assemble";
    ui.learn.hidden = mode !== "learn";
    ui.test.hidden = mode !== "test";
    ui.draw.hidden = mode !== "draw";
    ui.targetHelp.hidden = mode !== "assemble";
    ui.benchStatus.hidden = mode !== "test";
    ui.progressTrack.hidden = mode !== "assemble";
    $("#resetBtn").hidden = mode !== "assemble";
    workshop?.stopTests?.();

    if (mode === "assemble") {
      ui.panelEyebrow.textContent = "Component bench";
      ui.panelTitle.textContent = "Pick & place";
      ui.stageHelp.innerHTML = "<strong>Assembly bench:</strong> drag a part onto the model · it snaps to the correct physical position";
      workshop?.setWorkspaceMode?.("assemble", buildState.counts);
      setSceneMode("object");
      renderAssembly();
    } else if (mode === "learn") {
      ui.panelEyebrow.textContent = "Component shelf";
      ui.panelTitle.textContent = "Pick & inspect";
      ui.progressNumber.textContent = `${components.length} parts`;
      ui.stageHelp.innerHTML = "<strong>Learn:</strong> pick a shelf component · orbit · isolate · inspect ports";
      renderShelf();
      workshop?.setWorkspaceMode?.("learn", buildState.counts);
      workshop?.focusComponent?.(lab.component);
      setSceneMode("object");
      renderInspector();
    } else if (mode === "draw") {
      ui.panelEyebrow.textContent = "Connection tools";
      ui.panelTitle.textContent = "2D wiring desk";
      ui.progressNumber.textContent = "DRAW";
      ui.stageHelp.innerHTML = "<strong>Wire drawing:</strong> drag terminal to terminal · inspect every point · save to mirror in 3D";
      workshop?.setWorkspaceMode?.("draw", buildState.counts);
      setSceneMode("draw");
    } else {
      ui.panelEyebrow.textContent = "School lab workflow";
      ui.panelTitle.textContent = "Virtual tests";
      ui.progressNumber.textContent = `${tests.length - 1} labs`;
      ui.stageHelp.innerHTML = "<strong>Test safely:</strong> simulated controls only · real hardware is not connected";
      renderTestMenu();
      workshop?.setWorkspaceMode?.("test", buildState.counts);
      selectTest(lab.test);
    }
  }

  $$('[data-workspace-mode]').forEach(button => button.addEventListener("click", () => setWorkspaceMode(button.dataset.workspaceMode)));
  $$('[data-inspector-tab]').forEach(button => button.addEventListener("click", () => { lab.inspectorTab = button.dataset.inspectorTab; renderInspector(); }));
  $("#focusComponentBtn").addEventListener("click", () => { workshop?.focusComponent?.(lab.component); toast(`${selectedComponent().title} isolated in 3D`); });
  ui.trace.addEventListener("click", () => {
    const component=selectedComponent();
    const connected=component.optional ? workshop?.connectOptional?.(lab.component) : false;
    showAllWires();
    workshop?.focusComponent?.(lab.component, true);
    toast(component.optional ? (connected ? "Virtual harness connected — confirm the profile before real wiring" : "This module still needs its exact connector profile") : "Related wiring highlighted");
  });
  $("#componentPhotoBtn").addEventListener("click", () => {
    const component = selectedComponent();
    ui.photoTitle.textContent = component.title;
    ui.largePhoto.src = component.image;
    ui.largePhoto.alt = component.title;
    ui.photoCaption.textContent = component.id === "fc" ? "This reference was rendered from the supplied Gerber. It represents the bare PCB; the outer case is not included." : "Compare connector direction, wire colours and physical shape with the 3D learning model.";
    ui.photoDialog.showModal();
  });
  ui.inspector.addEventListener("change", event => {
    const select = event.target.closest("[data-aux-pin]");
    if (!select) return;
    lab.aux[select.dataset.auxPin] = select.value;
    try { localStorage.setItem("zebjus-fc-aux-profile", JSON.stringify(lab.aux)); } catch (_) {}
    const assigned = Object.values(lab.aux).filter(value => value !== "unassigned");
    const duplicate = assigned.find((value,index) => assigned.indexOf(value) !== index);
    if (duplicate) toast("One device is assigned twice — review the AUX profile");
    else toast(`${select.dataset.auxPin} lesson profile saved`);
  });

  renderShelf();
  renderTestMenu();
  return { setMode: setWorkspaceMode, selectComponent, selectTest, getState: () => ({ ...lab }) };
}
