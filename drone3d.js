import * as THREE from "./three.module.min.js";

const C = {
  red: 0xcf3431,
  black: 0x252d33,
  plate: 0x202b32,
  edge: 0x8999a3,
  gold: 0xe5b74c,
  copper: 0xc87935,
  steel: 0xb8c2c8,
  blue: 0x236fd5,
  wireRed: 0xf0443e,
  wireBlack: 0x11161a,
  wireWhite: 0xf4f7f5,
  pcb: 0x12624f,
  orange: 0xe96520,
  yellow: 0xf2b62d,
  mint: 0x62f1c0
};

function material(color, options = {}) {
  const value = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .08, ...options });
  value.userData.baseOpacity = value.opacity;
  return value;
}

function lineMaterial(color, emissive = false) {
  const value = new THREE.MeshStandardMaterial({
    color,
    roughness: .4,
    metalness: .05,
    emissive: emissive ? color : 0x000000,
    emissiveIntensity: emissive ? .18 : 0
  });
  value.userData.baseOpacity = 1;
  return value;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(radius, height, mat, x = 0, y = 0, z = 0, segments = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function rodBetween(a, b, radius, mat, radialSegments = 8) {
  const midpoint = a.clone().add(b).multiplyScalar(.5);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments), mat);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function tube(points, radius, mat, segments = 30) {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", .4);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), mat);
}

function makeTextSprite(text, foreground = "#eaf4f5", background = "rgba(6,13,18,.86)", scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = background;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(8, 10, 496, 108, 22);
  else ctx.rect(8, 10, 496, 108);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = foreground;
  ctx.font = "800 46px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  spriteMaterial.userData.baseOpacity = 1;
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(2.5 * scale, .625 * scale, 1);
  sprite.userData.annotation = true;
  return sprite;
}

function screw(mat, x, y, z, size = 1) {
  const group = new THREE.Group();
  const body = cylinder(.085 * size, .24 * size, mat, 0, 0, 0, 16);
  const head = cylinder(.14 * size, .07 * size, mat, 0, .15 * size, 0, 18);
  const slot = box(.18 * size, .015 * size, .026 * size, material(0x3b454b, { metalness: .55, roughness: .32 }), 0, .192 * size, 0);
  group.add(body, head, slot);
  group.position.set(x, y, z);
  group.userData.isScrew = true;
  return group;
}

function extrudedPlate(points, depth, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: .07,
    bevelThickness: .045,
    curveSegments: 2
  });
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  return new THREE.Mesh(geometry, mat);
}

function flatTriangle(width, length, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -length / 2);
  shape.lineTo(width / 2, -length / 2);
  shape.lineTo(0, length / 2);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, mat);
  return mesh;
}

function worldPoint(angle, distance, y = 0) {
  return new THREE.Vector3(Math.sin(angle) * distance, y, Math.cos(angle) * distance);
}

export class DroneWorkshop {
  constructor(canvas, stage, onTarget, onInspect) {
    this.canvas = canvas;
    this.stage = stage;
    this.onTarget = onTarget;
    this.onInspect = onInspect;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root = new THREE.Group();
    this.root.rotation.y = .02;
    this.scene.add(this.root);
    this.parts = Array.from({ length: 12 }, () => []);
    this.animations = [];
    this.azimuth = -.72;
    this.elevation = .62;
    this.radius = 15.4;
    this.cameraGoal = { azimuth: this.azimuth, elevation: this.elevation, radius: this.radius };
    this.autoRotate = false;
    this.exploded = false;
    this.wiring = false;
    this.forceAllWiring = false;
    this.workspaceMode = "assemble";
    this.focusedComponent = null;
    this.optionalParts = new Map();
    this.componentMap = new Map();
    this.portPositions = new Map();
    this.portMarkers = new THREE.Group();
    this.customWireGroup = new THREE.Group();
    this.customWireMode = false;
    this.interactiveMeshes = [];
    this.propRotors = [];
    this.servoHorns = [];
    this.motorTest = { index: -1, speed: 0 };
    this.matrixPixels = null;
    this.cameraTarget = new THREE.Vector3(0, .55, 0);
    this.cameraTargetGoal = this.cameraTarget.clone();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.drag = { active: false, x: 0, y: 0, moved: 0, id: null };
    this.clock = new THREE.Clock();
    this.targetStep = 0;
    this.targetIndex = 0;
    this.targetSelected = false;
    this.previewPart = null;
    this.setupScene();
    this.buildDrone();
    this.buildExpansionBay();
    this.buildComponentMap();
    this.buildPortMarkers();
    this.root.add(this.customWireGroup);
    const expected = [1,4,4,4,4,4,5,1,1,4,1,4];
    if (this.parts.some((items, index) => items.length !== expected[index])) throw new Error("3D assembly manifest is incomplete");
    this.setupTarget();
    this.bindControls();
    this.resize();
    this.animate();
    requestAnimationFrame(() => stage.querySelector("#loadingCard")?.classList.add("hidden"));
  }

  setupScene() {
    const hemi = new THREE.HemisphereLight(0xdaf7ff, 0x10161b, 2.2);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 4.1);
    key.position.set(-7, 12, -6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -11;
    key.shadow.camera.right = 11;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    this.scene.add(key);
    const rim = new THREE.PointLight(0x39cda9, 22, 24, 2);
    rim.position.set(7, 4, 5);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xff9c45, 12, 20, 2);
    warm.position.set(-6, 2, 6);
    this.scene.add(warm);
    const fill = new THREE.DirectionalLight(0x9fd7ff, 2.4);
    fill.position.set(6, 7, 8);
    this.scene.add(fill);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x071016, roughness: .86, metalness: .08, transparent: true, opacity: .76 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.58;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(24, 32, 0x294c56, 0x172a31);
    grid.position.y = -1.55;
    grid.material.transparent = true;
    grid.material.opacity = .34;
    this.scene.add(grid);
  }

  register(step, object, focus, category = "mechanical", motion = "drop") {
    object.visible = false;
    object.userData.step = step;
    object.userData.index = this.parts[step].length;
    object.userData.basePosition = object.position.clone();
    object.userData.focus = focus.clone();
    object.userData.category = category;
    object.userData.motion = motion;
    object.userData.installed = false;
    object.traverse(child => {
      if (!child.isMesh && !child.isSprite) return;
      child.userData.ownerPart = object;
      if (child.material) child.material = Array.isArray(child.material) ? child.material.map(mat => mat.clone()) : child.material.clone();
      if (child.isMesh) {
        child.castShadow = category !== "wire";
        child.receiveShadow = true;
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach(mat => {
        if (mat.userData.baseOpacity == null) mat.userData.baseOpacity = mat.opacity ?? 1;
      });
    });
    this.parts[step].push(object);
    this.root.add(object);
    return object;
  }

  addOptional(id, object, focus, category = "mechanical") {
    object.visible = false;
    object.userData.optional = true;
    object.userData.category = category;
    object.userData.focus = focus.clone();
    object.userData.basePosition = object.position.clone();
    object.traverse(child => {
      if (!child.isMesh && !child.isSprite) return;
      child.userData.ownerPart = object;
      if (child.material) child.material = Array.isArray(child.material) ? child.material.map(mat => mat.clone()) : child.material.clone();
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach(mat => { if (mat.userData.baseOpacity == null) mat.userData.baseOpacity = mat.opacity ?? 1; });
    });
    const list = this.optionalParts.get(id) || [];
    list.push(object);
    this.optionalParts.set(id, list);
    this.root.add(object);
    return object;
  }

  buildDrone() {
    const plateMat = material(C.plate, { metalness: .34, roughness: .34 });
    const steel = material(C.steel, { metalness: .82, roughness: .22 });
    const dark = material(0x050708, { roughness: .72 });
    const gold = material(C.gold, { metalness: .72, roughness: .25 });
    const copper = material(C.copper, { metalness: .75, roughness: .24 });
    const redPlastic = material(C.red, { roughness: .44 });
    const blackPlastic = material(C.black, { roughness: .48 });
    const guardMat = material(0xf1f2ee, { roughness: .38 });
    const blueWire = lineMaterial(C.blue, true);
    const redWire = lineMaterial(C.wireRed, true);
    const blackWire = lineMaterial(C.wireBlack);
    const whiteWire = lineMaterial(C.wireWhite);

    const bottom = new THREE.Group();
    const bottomShape = [[-1.35,-2.02],[1.35,-2.02],[2.02,-1.35],[2.02,1.35],[1.35,2.02],[-1.35,2.02],[-2.02,1.35],[-2.02,-1.35]];
    const rimPlate = extrudedPlate(bottomShape, .12, gold);
    rimPlate.position.y = -.015;
    rimPlate.scale.set(1.018,1,1.018);
    const lowerPlate = extrudedPlate(bottomShape, .18, plateMat);
    lowerPlate.position.y = .085;
    bottom.add(rimPlate, lowerPlate);
    [[0,0,1.5,.42],[0,0,-1.5,.42],[-1.48,0,0,.31],[1.48,0,0,.31]].forEach(([x,,z,r]) => {
      const cutout = cylinder(r, .225, dark, x, .08, z, 30);
      bottom.add(cutout);
    });
    [[-.7,-1.52],[0,-1.52],[.7,-1.52],[-.7,1.52],[0,1.52],[.7,1.52],[-1.55,0],[1.55,0]].forEach(([x,z], index) => {
      const slot = box(index > 5 ? .56 : .44, .235, index > 5 ? .22 : .28, dark, x, .105, z);
      if (index > 5) slot.rotation.y = Math.PI / 2;
      bottom.add(slot);
    });
    [-1,1].forEach(xSign => [-1,1].forEach(zSign => {
      bottom.add(cylinder(.12,.24,dark,xSign*1.5,.1,zSign*1.73,20));
      bottom.add(cylinder(.11,.25,steel,xSign*1.84,.1,zSign*1.48,18));
    }));

    const armAngles = [-3*Math.PI/4, 3*Math.PI/4, Math.PI/4, -Math.PI/4];
    const armNames = ["M1 · CW", "M2 · CCW", "M3 · CW", "M4 · CCW"];
    const armColors = [redPlastic, redPlastic, blackPlastic, blackPlastic];
    const padPairs = [];
    armAngles.forEach((angle, index) => {
      const pair = new THREE.Group();
      const p = worldPoint(angle, 1.92, .2);
      const side = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(.16);
      const plus = box(.3,.045,.16,copper,p.x-side.x,.23,p.z-side.z); plus.rotation.y=angle;
      const minus = box(.3,.045,.16,gold,p.x+side.x,.23,p.z+side.z); minus.rotation.y=angle;
      plus.userData.padType = "positive";
      minus.userData.padType = "negative";
      pair.add(plus, minus);
      bottom.add(pair);
      padPairs.push({ plus: p.clone().sub(side), minus: p.clone().add(side) });
    });
    const batteryPads = new THREE.Group();
    batteryPads.add(box(.34,.05,.18,copper,-.28,.23,1.72), box(.34,.05,.18,gold,.28,.23,1.72));
    bottom.add(batteryPads);
    this.register(0, bottom, new THREE.Vector3(0,.1,0), "support");

    armAngles.forEach((angle, index) => {
      const arm = new THREE.Group();
      arm.rotation.y = angle;
      const armMat = armColors[index];
      const mouldedDeck = extrudedPlate([[-.61,-1.82],[.61,-1.82],[.43,1.72],[-.43,1.72]], .18, armMat);
      mouldedDeck.position.set(0,.35,2.36);
      arm.add(mouldedDeck);
      arm.add(rodBetween(new THREE.Vector3(-.55,.47,.65),new THREE.Vector3(-.38,.47,4.08),.09,armMat,8));
      arm.add(rodBetween(new THREE.Vector3(.55,.47,.65),new THREE.Vector3(.38,.47,4.08),.09,armMat,8));
      arm.add(box(1.24,.3,.88,armMat,0,.39,.82));
      arm.add(cylinder(.72,.28,armMat,0,.38,4.42,30));
      arm.add(cylinder(.42,.31,dark,0,.39,4.42,30));
      for (let n = 0; n < 6; n += 1) {
        const z = 1.28 + n * .48;
        const opening = flatTriangle(.62 - n * .035, .36, dark);
        opening.position.set(0,.455,z);
        opening.rotation.y = n % 2 ? Math.PI : 0;
        arm.add(opening);
      }
      arm.add(rodBetween(new THREE.Vector3(-.48,.28,4.05),new THREE.Vector3(-.42,-1.42,4.25),.105,armMat,8));
      arm.add(rodBetween(new THREE.Vector3(.48,.28,4.05),new THREE.Vector3(.42,-1.42,4.25),.105,armMat,8));
      arm.add(box(1.14,.18,.68,armMat,0,-1.48,4.28));
      [-.43,.43].forEach(x => {
        arm.add(cylinder(.13,.62,armMat,x,.72,.72,14));
        arm.add(cylinder(.065,.64,steel,x,.73,.72,12));
      });
      [[-.38,.55,.62],[.38,.55,.62],[-.38,.55,1.03],[.38,.55,1.03]].forEach(v => arm.add(screw(steel,...v,.76)));
      const focus = worldPoint(angle, 2.65, .45);
      this.register(1, arm, focus, "mechanical");
    });

    armAngles.forEach((angle) => {
      const guard = new THREE.Group();
      guard.rotation.y = angle;
      const centre = new THREE.Vector3(0,.88,4.42);
      const arcPoints = [];
      for (let i = 0; i <= 34; i += 1) {
        const a = THREE.MathUtils.lerp(-2.32, 2.32, i / 34);
        arcPoints.push(new THREE.Vector3(Math.sin(a)*1.82,.9,4.42+Math.cos(a)*1.82));
      }
      guard.add(tube(arcPoints,.07,guardMat,70));
      [-1.13,0,1.13].forEach(a => {
        const end = new THREE.Vector3(Math.sin(a)*1.8,.89,4.42+Math.cos(a)*1.8);
        guard.add(rodBetween(centre,end,.055,guardMat,8));
      });
      guard.add(new THREE.Mesh(new THREE.TorusGeometry(.57,.075,10,32),guardMat));
      guard.children[guard.children.length-1].rotation.x = Math.PI/2;
      guard.children[guard.children.length-1].position.copy(centre);
      [[-.34,4.2],[.34,4.2],[0,4.75]].forEach(([x,z])=>guard.add(screw(steel,x,1.02,z,.65)));
      const focus = worldPoint(angle, 4.42, .9);
      this.register(2, guard, focus, "mechanical");
    });

    armAngles.forEach((angle, index) => {
      const motor = new THREE.Group();
      motor.rotation.y = angle;
      const silver = material(0xc9d0d3,{metalness:.68,roughness:.24});
      const anodized = material(0xd88a18,{metalness:.7,roughness:.22});
      motor.add(cylinder(.58,.42,silver,0,.92,4.42,36));
      const rotor = new THREE.Group();
      rotor.position.z=4.42;
      rotor.add(cylinder(.61,.28,anodized,0,1.25,0,36));
      rotor.add(cylinder(.48,.09,anodized,0,1.43,0,36));
      rotor.add(cylinder(.1,.8,steel,0,1.67,0,20));
      rotor.add(box(.1,.04,.45,material(0x301900,{metalness:.25}),0,1.49,0));
      for(let n=0;n<8;n+=1){
        const a=n/8*Math.PI*2;
        rotor.add(cylinder(.065,.12,dark,Math.sin(a)*.37,1.44,Math.cos(a)*.37,12));
      }
      motor.add(rotor);
      motor.userData.rotor = rotor;
      [[-.38,4.04],[.38,4.04],[-.38,4.8],[.38,4.8]].forEach(([x,z])=>motor.add(screw(steel,x,.72,z,.6)));
      const colors=[lineMaterial(0xc82927),lineMaterial(0xe6b323),lineMaterial(0x16191b)];
      [-.19,0,.19].forEach((x,n)=>{
        motor.add(tube([new THREE.Vector3(x,.92,4.02),new THREE.Vector3(x,.83,3.83),new THREE.Vector3(x,.8,3.58)],.035,colors[n],15));
        const bullet=cylinder(.065,.31,gold,x,.8,3.48,12); bullet.rotation.x=Math.PI/2; motor.add(bullet);
      });
      const label=makeTextSprite(armNames[index], index<2?"#ff918b":"#e8f1f4", "rgba(5,11,15,.88)", .45);
      label.position.set(0,2.18,4.42);
      motor.add(label);
      const focus = worldPoint(angle,4.42,1.25);
      this.register(3,motor,focus,"mechanical");
    });

    armAngles.forEach((angle,index)=>{
      const esc=new THREE.Group();
      esc.rotation.y=angle;
      const wrap=material(0xcc2f2e,{roughness:.55});
      const cap=material(0x272f35,{roughness:.58});
      esc.add(box(.84,.3,1.35,wrap,0,.74,2.63));
      esc.add(box(.82,.31,.14,cap,0,.74,1.96),box(.82,.31,.14,cap,0,.74,3.3));
      const band=box(.87,.315,.18,material(0xe14a45,{roughness:.5}),0,.75,2.63);
      esc.add(band);
      const label=makeTextSprite(`ESC ${index+1} · 30A`,"#ffffff","rgba(143,23,24,.9)",.34);
      label.position.set(0,1.17,2.63);
      esc.add(label);
      const focus=worldPoint(angle,2.63,.78);
      this.register(4,esc,focus,"mechanical");
    });

    armAngles.forEach((angle)=>{
      const connection=new THREE.Group();
      connection.rotation.y=angle;
      [-.19,0,.19].forEach((x)=>{
        connection.add(tube([new THREE.Vector3(x,.76,3.26),new THREE.Vector3(x,.79,3.44),new THREE.Vector3(x,.8,3.58)],.045,blueWire,16));
        const sleeve=cylinder(.09,.3,material(0x10161b,{roughness:.65}),x,.8,3.38,12); sleeve.rotation.x=Math.PI/2; connection.add(sleeve);
        const collar=cylinder(.07,.14,gold,x,.8,3.54,12); collar.rotation.x=Math.PI/2; connection.add(collar);
      });
      const focus=worldPoint(angle,3.48,.82);
      this.register(5,connection,focus,"wire","fade");
    });

    armAngles.forEach((angle,index)=>{
      const power=new THREE.Group();
      power.rotation.y=angle;
      power.add(tube([new THREE.Vector3(-.13,.68,1.92),new THREE.Vector3(-.16,.73,2.08),new THREE.Vector3(-.16,.72,2.17)],.052,redWire,18));
      power.add(tube([new THREE.Vector3(.13,.68,1.92),new THREE.Vector3(.16,.73,2.08),new THREE.Vector3(.16,.72,2.17)],.052,blackWire,18));
      power.add(cylinder(.13,.07,steel,-.13,.65,1.92,14),cylinder(.13,.07,steel,.13,.65,1.92,14));
      const focus=worldPoint(angle,1.92,.68);
      this.register(6,power,focus,"wire","solder");
    });
    const batteryLead=new THREE.Group();
    batteryLead.add(tube([new THREE.Vector3(-.28,.38,1.72),new THREE.Vector3(-.33,.27,2.12),new THREE.Vector3(-.28,.2,2.62)],.068,redWire,24));
    batteryLead.add(tube([new THREE.Vector3(.28,.38,1.72),new THREE.Vector3(.33,.27,2.12),new THREE.Vector3(.28,.2,2.62)],.068,blackWire,24));
    const xtMat=material(C.yellow,{roughness:.42});
    batteryLead.add(box(.7,.45,.62,xtMat,0,.18,2.88));
    batteryLead.add(box(.2,.23,.18,dark,-.18,.18,2.58),box(.2,.23,.18,dark,.18,.18,2.58));
    const xtLabel=makeTextSprite("XT60", "#171000", "rgba(244,185,45,.92)", .3);
    xtLabel.position.set(0,.74,2.88);
    batteryLead.add(xtLabel);
    this.register(6,batteryLead,new THREE.Vector3(0,.2,2.68),"wire","solder");

    const top=new THREE.Group();
    const topShape=[[-1.24,-1.86],[1.24,-1.86],[1.86,-1.24],[1.86,1.24],[1.24,1.86],[-1.24,1.86],[-1.86,1.24],[-1.86,-1.24]];
    const topRim=extrudedPlate(topShape,.09,gold); topRim.position.y=1.07; topRim.scale.set(1.014,1,1.014); top.add(topRim);
    const topPlate=extrudedPlate(topShape,.17,plateMat); topPlate.position.y=1.16; top.add(topPlate);
    [[0,.75],[0,-.75],[-1.12,0],[1.12,0],[-.56,1.48],[.56,1.48],[-.56,-1.48],[.56,-1.48]].forEach(([x,z],index)=>{
      const slot=box(index < 4 ? .62 : .32,.2,index < 4 ? .25 : .54,dark,x,1.18,z); if(index>=4)slot.rotation.y=Math.PI/2; top.add(slot);
    });
    armAngles.forEach(angle=>{
      const centre=worldPoint(angle,.72,.62),side=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
      [-.43,.43].forEach(offset=>{
        const point=centre.clone().addScaledVector(side,offset);
        top.add(cylinder(.11,1.05,material(0x424d54,{metalness:.5}),point.x,.62,point.z,14));
        top.add(screw(steel,point.x,1.28,point.z,.75));
      });
    });
    this.register(7,top,new THREE.Vector3(0,1.15,0),"support");

    const fc=new THREE.Group();
    const boardMat=material(C.pcb,{metalness:.18,roughness:.38});
    fc.add(box(2.16,.12,1.94,boardMat,0,1.58,0));
    [-.93,.93].forEach(x=>[-.82,.82].forEach(z=>{
      fc.add(cylinder(.095,.15,dark,x,1.59,z,18));
      fc.add(cylinder(.047,.18,steel,x,1.61,z,14));
    }));

    const controller=box(1.08,.17,1.22,material(0x162a31,{metalness:.2}),.28,1.72,.14); fc.add(controller);
    const usb=box(.23,.18,.48,material(0xc1c9ca,{metalness:.75,roughness:.2}),1.07,1.72,.24); fc.add(usb);
    const imuBoard=box(.66,.15,1.08,material(0x174e48,{metalness:.12}),-.62,1.7,.12); fc.add(imuBoard);
    fc.add(box(.34,.12,.34,material(0x222a2f,{metalness:.18}),-.62,1.82,.12));
    fc.add(box(.42,.16,.26,material(0x263238),-.55,1.72,.77));
    fc.add(box(.42,.16,.26,material(0x263238),-.05,1.72,.77));

    const escSignals=["IO0","IO1","IO3","IO6"];
    const escXs=[-.68,-.23,.23,.68];
    escXs.forEach((x,index)=>{
      const header=box(.3,.18,.38,dark,x,1.72,-.72); fc.add(header);
      [[-.84,whiteWire],[-.72,redWire],[-.60,blackWire]].forEach(([z,mat])=>{
        fc.add(cylinder(.027,.22,mat,x,1.88,z,8));
        fc.add(cylinder(.045,.035,gold,x,1.995,z,10));
      });
      const label=makeTextSprite(`ESC${index+1} · ${escSignals[index]}`,"#aaffdf","rgba(4,42,32,.92)",.19);
      label.position.set(x,2.08,-.72); fc.add(label);
    });
    const escRowLabel=makeTextSprite("OUTER S · MIDDLE VCC · INNER GND","#ffffff","rgba(38,11,11,.92)",.22);
    escRowLabel.position.set(0,2.27,-.83); fc.add(escRowLabel);

    const auxSignals=["IO7","IO20","IO21","IO10"];
    [-.68,-.23,.23,.68].forEach((x,index)=>{
      fc.add(box(.29,.15,.34,dark,x,1.69,.72));
      [-.09,0,.09].forEach(zOffset=>fc.add(cylinder(.024,.2,gold,x,1.84,.72+zOffset,8)));
      const label=makeTextSprite(`AUX${index+1} · ${auxSignals[index]}`,"#f5d9a0","rgba(44,30,5,.9)",.17);
      label.position.set(x,2.02,.73); fc.add(label);
    });

    const i2cLabel=makeTextSprite("I²C · SDA IO4 · SCL IO5","#9deaff","rgba(4,30,42,.92)",.19);
    i2cLabel.position.set(-.84,2.05,.1); fc.add(i2cLabel);
    [-.18,-.06,.06,.18].forEach((zOffset,index)=>{
      const mats=[whiteWire,lineMaterial(0x63d8ff,true),blackWire,lineMaterial(0x8fdc85,true)];
      fc.add(cylinder(.024,.2,mats[index],-.99,1.84,zOffset,8));
    });
    const powerLabel=makeTextSprite("+5V · GND","#ffcf7b","rgba(45,27,2,.9)",.18); powerLabel.position.set(.92,2.02,.66); fc.add(powerLabel);
    const arrowMat=material(C.mint,{emissive:C.mint,emissiveIntensity:.25});
    const arrow=new THREE.Mesh(new THREE.ConeGeometry(.18,.55,3),arrowMat); arrow.rotation.x=Math.PI/2; arrow.position.set(0,1.7,-.65); fc.add(arrow);
    const fcLabel=makeTextSprite("ZEBJUS FC · GERBER VERIFIED", "#9fffdc", "rgba(4,45,34,.9)", .38); fcLabel.position.set(0,2.34,0); fc.add(fcLabel);
    const sizeLabel=makeTextSprite("37.72 × 33.91 × 1.60 mm PCB", "#d6e8e8", "rgba(5,15,20,.9)", .24); sizeLabel.position.set(0,2.13,.05); fc.add(sizeLabel);
    this.register(8,fc,new THREE.Vector3(0,1.72,0),"support");

    armAngles.forEach((angle,index)=>{
      const signal=new THREE.Group();
      const endX=[-.68,-.23,.23,.68][index];
      const side=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
      const start=worldPoint(angle,1.98,.78);
      const middle=worldPoint(angle,1.38,1.04);
      const end=new THREE.Vector3(endX,1.76,-.72);
      const mats=[whiteWire,redWire,blackWire];
      [-.075,0,.075].forEach((offset,n)=>{
        signal.add(tube([
          start.clone().addScaledVector(side,offset),
          middle.clone().addScaledVector(side,offset).add(new THREE.Vector3(0,.5,0)),
          end.clone().add(new THREE.Vector3(0,0,(n-1)*.12))
        ],.052,mats[n],40));
      });
      const plug=box(.28,.18,.4,material(0x161c20,{transparent:true,opacity:.72}),end.x,1.75,end.z); signal.add(plug);
      const wireLabel=makeTextSprite(`ESC${index+1} → ${escSignals[index]}`,"#ffffff","rgba(5,14,20,.92)",.22); wireLabel.position.set(end.x,2.18,end.z-.12); signal.add(wireLabel);
      const focus=worldPoint(angle,1.2,1.28);
      this.register(9,signal,focus,"wire","fade");
    });

    const battery=new THREE.Group();
    const orange=material(C.orange,{roughness:.5});
    battery.add(box(2.35,.82,4.0,orange,0,-.94,.15));
    battery.add(box(2.4,.12,.32,material(0x2a2b2d),0,-.49,.15));
    battery.add(box(.13,.88,4.08,material(0x1e2225),-.72,-.93,.15),box(.13,.88,4.08,material(0x1e2225),.72,-.93,.15));
    const batLabel=makeTextSprite("LiPo 3S · 2200 mAh", "#ffffff", "rgba(142,42,10,.9)", .52); batLabel.position.set(0,-.35,.35); battery.add(batLabel);
    battery.add(tube([new THREE.Vector3(-.45,-.78,1.8),new THREE.Vector3(-.35,-.18,2.42),new THREE.Vector3(-.26,.05,2.55)],.065,redWire,24));
    battery.add(tube([new THREE.Vector3(-.22,-.78,1.8),new THREE.Vector3(-.1,-.18,2.42),new THREE.Vector3(.05,.05,2.55)],.065,blackWire,24));
    this.register(10,battery,new THREE.Vector3(0,-.85,.2),"mechanical","slide");

    armAngles.forEach((angle,index)=>{
      const prop=new THREE.Group();
      prop.rotation.y=angle;
      const propMat=material(0xf4f4ef,{roughness:.3});
      const shape=new THREE.Shape();
      shape.moveTo(0,.1); shape.lineTo(.35,.16); shape.lineTo(1.5,.34); shape.lineTo(1.83,.18); shape.lineTo(1.5,-.03); shape.lineTo(.3,-.09);
      shape.lineTo(0,-.1); shape.lineTo(-.35,-.16); shape.lineTo(-1.5,-.34); shape.lineTo(-1.83,-.18); shape.lineTo(-1.5,.03); shape.lineTo(-.3,.09); shape.closePath();
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSegments:2,bevelSize:.035,bevelThickness:.02});
      geometry.rotateX(Math.PI/2); geometry.center();
      const blades=new THREE.Mesh(geometry,propMat); blades.position.set(0,2.05,4.42); blades.rotation.y=index%2?-.18:.18; prop.add(blades);
      prop.userData.rotor = blades;
      prop.userData.baseRotorAngle = blades.rotation.y;
      prop.add(cylinder(.2,.18,material(0x31383c,{metalness:.5}),0,2.05,4.42,24));
      const label=makeTextSprite(armNames[index], index<2?"#ff918b":"#e8f1f4", "rgba(5,11,15,.88)", .42); label.position.set(0,2.72,4.42); prop.add(label);
      const focus=worldPoint(angle,4.42,2.08);
      this.register(11,prop,focus,"mechanical");
    });
    this.defineElectricalPorts(armAngles,padPairs,escXs);
  }

  defineElectricalPorts(armAngles,padPairs,escXs) {
    const lateral = angle => new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
    const add = (id, point) => this.portPositions.set(id, point.clone());
    armAngles.forEach((angle,index)=>{
      const n=index+1, side=lateral(angle);
      [-.19,0,.19].forEach((offset,phase)=>{
        const name=["u","v","w"][phase];
        add(`motor${n}.${name}`,worldPoint(angle,3.58,.86).addScaledVector(side,offset));
        add(`esc${n}.${name}`,worldPoint(angle,3.26,.82).addScaledVector(side,offset));
      });
      add(`esc${n}.power+`,worldPoint(angle,2.17,.78).addScaledVector(side,-.13));
      add(`esc${n}.power-`,worldPoint(angle,2.17,.78).addScaledVector(side,.13));
      const plus=padPairs[index].plus.clone(); plus.y=.3;
      const minus=padPairs[index].minus.clone(); minus.y=.3;
      add(`pdb.esc${n}+`,plus); add(`pdb.esc${n}-`,minus);
      const start=worldPoint(angle,1.98,.84);
      add(`esc${n}.s`,start.clone().addScaledVector(side,-.075));
      add(`esc${n}.vcc`,start.clone());
      add(`esc${n}.gnd`,start.clone().addScaledVector(side,.075));
      add(`fc.esc${n}.s`,new THREE.Vector3(escXs[index],1.92,-.84));
      add(`fc.esc${n}.vcc`,new THREE.Vector3(escXs[index],1.92,-.72));
      add(`fc.esc${n}.gnd`,new THREE.Vector3(escXs[index],1.92,-.60));
    });
    add("pdb.bat+",new THREE.Vector3(-.28,.31,1.72));
    add("pdb.bat-",new THREE.Vector3(.28,.31,1.72));
    add("battery.xt60+",new THREE.Vector3(-.28,.3,2.62));
    add("battery.xt60-",new THREE.Vector3(.28,.3,2.62));
  }

  buildPortMarkers() {
    const markerColor=id=>id.endsWith("+")||id.includes("vcc")?C.wireRed:id.endsWith("-")||id.includes("gnd")?0x778790:id.endsWith(".s")?C.wireWhite:C.blue;
    this.portMarkers.clear(); this.interactiveMeshes=[];
    this.portPositions.forEach((position,id)=>{
      const color=markerColor(id);
      const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.8,roughness:.25,metalness:.15,transparent:true,opacity:.96,depthTest:false});
      mat.userData.baseOpacity=.96;
      const marker=new THREE.Mesh(new THREE.SphereGeometry(.085,18,12),mat);
      marker.position.copy(position); marker.renderOrder=90; marker.userData.portId=id;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.135,.018,8,22),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.64,depthTest:false}));
      ring.rotation.x=Math.PI/2; ring.renderOrder=89; marker.add(ring);
      this.portMarkers.add(marker); this.interactiveMeshes.push(marker);
    });
    this.portMarkers.visible=false;
    this.root.add(this.portMarkers);
  }

  buildExpansionBay() {
    const trayX = 4.75;
    const dark = material(0x11181e, { roughness: .58 });
    const deepBlue = material(0x195ca8, { roughness: .42 });
    const pcb = material(0x12624f, { roughness: .42, metalness: .12 });
    const gold = material(C.gold, { metalness: .74, roughness: .23 });
    const white = material(0xf2f4ef, { roughness: .34 });
    const redWire = lineMaterial(C.wireRed, true);
    const blackWire = lineMaterial(C.wireBlack);
    const whiteWire = lineMaterial(C.wireWhite, true);

    const receiver = new THREE.Group();
    receiver.position.set(trayX, -.25, 0);
    receiver.add(box(2.18,.42,1.1,dark,0,.34,0));
    receiver.add(box(1.78,.04,.82,pcb,0,.57,0));
    for (let channel = 0; channel < 6; channel += 1) {
      const x = -.84 + channel * .335;
      [-.22,0,.22].forEach((z,index)=>receiver.add(cylinder(.027,.25,index===0?whiteWire:index===1?redWire:blackWire,x,.72,z,8)));
      const label = makeTextSprite(`CH${channel+1}`,"#d9f4ff","rgba(5,18,25,.9)",.15);
      label.position.set(x,.96,.03); receiver.add(label);
    }
    receiver.add(tube([new THREE.Vector3(-.9,.42,.38),new THREE.Vector3(-1.45,.48,.72),new THREE.Vector3(-2.05,.56,.92)],.025,blackWire,26));
    receiver.add(tube([new THREE.Vector3(.9,.42,.38),new THREE.Vector3(1.45,.48,.72),new THREE.Vector3(2.05,.56,.92)],.025,blackWire,26));
    receiver.add(box(1.65,.5,1.12,material(0x202930,{roughness:.6}),0,.38,-1.45));
    receiver.add(box(.52,.08,.25,material(0x0c1115),0,.68,-1.55));
    [-.42,.42].forEach(x=>{
      receiver.add(cylinder(.16,.08,material(0x0b1014),x,.69,-1.28,22));
      receiver.add(cylinder(.045,.34,material(0xb9c1c3,{metalness:.6}),x,.86,-1.28,12));
    });
    receiver.add(rodBetween(new THREE.Vector3(.65,.61,-1.82),new THREE.Vector3(.98,1.35,-2.08),.035,material(0x252d32,{metalness:.5}),10));
    const txLabel=makeTextSprite("6CH TX","#ffffff","rgba(12,19,24,.92)",.22); txLabel.position.set(0,1.05,-1.44); receiver.add(txLabel);
    const rxHarness=new THREE.Group();
    [[-.08,whiteWire],[0,redWire],[.08,blackWire]].forEach(([offset,mat])=>rxHarness.add(tube([
      new THREE.Vector3(-.9+offset,.42,.05),new THREE.Vector3(-2.55+offset,.72,.5),new THREE.Vector3(-5.43+offset,2.0,.72)
    ],.033,mat,36)));
    const rxHarnessLabel=makeTextSprite("RX → AUX? · CONFIRM PROFILE","#ffe3a8","rgba(48,30,4,.94)",.25); rxHarnessLabel.position.set(-2.8,1.25,.5); rxHarness.add(rxHarnessLabel);
    rxHarness.visible=false; receiver.userData.harness=rxHarness; receiver.add(rxHarness);
    const rxLabel = makeTextSprite("6CH RECEIVER · PROFILE REQUIRED","#a993ff","rgba(24,12,50,.92)",.35);
    rxLabel.position.set(0,1.28,0); receiver.add(rxLabel);
    this.addOptional("receiver", receiver, new THREE.Vector3(trayX,.45,0));

    const servos = new THREE.Group();
    servos.position.set(trayX, -.25, 0);
    [-.62,.62].forEach((x,index)=>{
      servos.add(box(.78,.84,.54,deepBlue,x,.38,0));
      servos.add(box(.96,.18,.66,material(0x164b89,{roughness:.42}),x,.84,0));
      servos.add(cylinder(.17,.18,white,x,1.0,0,24));
      const horn = new THREE.Group();
      horn.position.set(x,1.12,0);
      horn.add(box(.92,.075,.13,white,0,0,0));
      horn.add(cylinder(.12,.09,white,0,.02,0,20));
      [-.34,.34].forEach(hx=>horn.add(cylinder(.026,.09,dark,hx,.05,0,10)));
      servos.add(horn);
      this.servoHorns[index] = horn;
      const wireStart = new THREE.Vector3(x,.3,.27);
      [[-.07,whiteWire],[0,redWire],[.07,blackWire]].forEach(([offset,mat])=>servos.add(tube([wireStart.clone().add(new THREE.Vector3(offset,0,0)),new THREE.Vector3(x+offset,.2,.8),new THREE.Vector3(x+offset,.15,1.3)],.025,mat,22)));
      const label=makeTextSprite(`SG90 · SERVO ${index+1}`,"#ffffff","rgba(11,54,100,.92)",.26); label.position.set(x,1.52,0); servos.add(label);
    });
    const servoHarness=new THREE.Group();
    [-.62,.62].forEach((x,index)=>{
      const endX=[-5.43,-4.98][index];
      [[-.07,whiteWire],[0,redWire],[.07,blackWire]].forEach(([offset,mat])=>servoHarness.add(tube([
        new THREE.Vector3(x+offset,.3,.28),new THREE.Vector3(x+offset,.52,.94),new THREE.Vector3(endX+offset,2.0,.72)
      ],.032,mat,38)));
    });
    const servoHarnessLabel=makeTextSprite("SERVO 1 / 2 → AUX? · EXTERNAL POWER","#ffe3a8","rgba(48,30,4,.94)",.28); servoHarnessLabel.position.set(-2.45,1.28,.75); servoHarness.add(servoHarnessLabel);
    servoHarness.visible=false; servos.userData.harness=servoHarness; servos.add(servoHarness);
    this.addOptional("servo",servos,new THREE.Vector3(trayX,.6,0));

    const matrix = new THREE.Group();
    matrix.position.set(trayX,-.25,0);
    matrix.add(box(3.42,.16,3.42,material(0x1a2529,{roughness:.54}),0,.23,0));
    matrix.add(box(3.28,.04,3.28,pcb,0,.33,0));
    const pixelMaterial = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.25,metalness:.02,emissive:0xffffff,emissiveIntensity:.22});
    const pixels = new THREE.InstancedMesh(new THREE.BoxGeometry(.15,.075,.15),pixelMaterial,256);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color(0x102722);
    for(let row=0;row<16;row+=1){
      for(let col=0;col<16;col+=1){
        const index=row*16+col;
        dummy.position.set(-1.43+col*.19,.39,-1.43+row*.19); dummy.updateMatrix();
        pixels.setMatrixAt(index,dummy.matrix); pixels.setColorAt(index,color);
      }
    }
    pixels.instanceMatrix.needsUpdate=true;
    if(pixels.instanceColor)pixels.instanceColor.needsUpdate=true;
    matrix.add(pixels);
    matrix.add(box(.62,.22,.35,dark,0,.2,1.65));
    matrix.add(tube([new THREE.Vector3(-.12,.22,1.65),new THREE.Vector3(-.18,.05,2.05)],.035,redWire,16));
    matrix.add(tube([new THREE.Vector3(0,.22,1.65),new THREE.Vector3(0,.05,2.05)],.035,blackWire,16));
    matrix.add(tube([new THREE.Vector3(.12,.22,1.65),new THREE.Vector3(.18,.05,2.05)],.035,whiteWire,16));
    const matrixHarness=new THREE.Group();
    const i2cMats=[lineMaterial(0x5bdcff,true),lineMaterial(0xf4df79,true),blackWire,lineMaterial(0x8ddd8c,true)];
    [-.12,-.04,.04,.12].forEach((offset,index)=>matrixHarness.add(tube([
      new THREE.Vector3(offset,.22,1.65),new THREE.Vector3(-1.7+offset,.7,1.25),new THREE.Vector3(-5.74,2.0,-.18+index*.12)
    ],.03,i2cMats[index],42)));
    const matrixHarnessLabel=makeTextSprite("I²C ONLY IF MATRIX CONTROLLER MATCHES","#ffe3a8","rgba(48,30,4,.94)",.28); matrixHarnessLabel.position.set(-2.5,1.3,1.1); matrixHarness.add(matrixHarnessLabel);
    matrixHarness.visible=false; matrix.userData.harness=matrixHarness; matrix.add(matrixHarness);
    const matrixLabel=makeTextSprite("16 × 16 LED MATRIX · PROTOCOL CHECK","#a8fff0","rgba(4,31,27,.94)",.4); matrixLabel.position.set(0,1.0,0); matrix.add(matrixLabel);
    this.matrixPixels=pixels;
    this.addOptional("matrix",matrix,new THREE.Vector3(trayX,.25,0));

    const gps = new THREE.Group();
    gps.position.set(trayX,-.25,0);
    gps.add(box(1.65,.14,1.65,pcb,0,.28,0));
    gps.add(box(1.25,.16,1.25,material(0xd4c4a2,{roughness:.32}),0,.44,0));
    gps.add(box(.46,.2,.3,dark,0,.3,.78));
    const gpsLabel=makeTextSprite("GPS · PORT PROFILE REQUIRED","#a993ff","rgba(24,12,50,.92)",.34); gpsLabel.position.set(0,1.12,0); gps.add(gpsLabel);
    this.addOptional("gps",gps,new THREE.Vector3(trayX,.42,0));

    const led = new THREE.Group();
    led.position.set(trayX,-.25,0);
    led.add(box(2.35,.14,.62,pcb,0,.27,0));
    [0xff3f38,0x55f7b4,0x47a9ff,0xffba45,0xa993ff,0xf3f5ee].forEach((value,index)=>{
      led.add(cylinder(.12,.14,material(value,{emissive:value,emissiveIntensity:.65}),-.82+index*.33,.43,0,18));
    });
    const ledLabel=makeTextSprite("STATUS LED · AUX DRIVER","#d8fbff","rgba(5,26,34,.92)",.32); ledLabel.position.set(0,.95,0); led.add(ledLabel);
    this.addOptional("led",led,new THREE.Vector3(trayX,.35,0));
  }

  buildComponentMap() {
    const join = (...steps) => steps.flatMap(step => this.parts[step] || []);
    this.componentMap.set("frame", join(0,1,7));
    this.componentMap.set("pdb", join(0,6));
    this.componentMap.set("guard", join(2));
    this.componentMap.set("motor", join(3,5,11));
    this.componentMap.set("esc", join(4,5,6,9));
    this.componentMap.set("fc", join(8,9));
    this.componentMap.set("battery", join(6,10));
    this.componentMap.set("prop", join(11));
    ["receiver","servo","matrix","gps","led"].forEach(id=>this.componentMap.set(id,this.optionalParts.get(id)||[]));
    this.componentMap.forEach((objects,id)=>objects.forEach(object=>{if(!object.userData.componentId)object.userData.componentId=id;}));
  }

  setupTarget() {
    const group = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb54d, transparent: true, opacity: .86, depthTest: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.34,.045,12,48),ringMat);
    ring.rotation.x = Math.PI/2;
    const core = new THREE.Mesh(new THREE.CircleGeometry(.11,28),new THREE.MeshBasicMaterial({color:0xffb54d,transparent:true,opacity:.5,depthTest:false,side:THREE.DoubleSide}));
    core.rotation.x = -Math.PI/2;
    group.add(ring,core);
    group.visible = false;
    group.renderOrder = 99;
    group.userData.isTarget = true;
    group.traverse(child=>child.userData.isTarget=true);
    this.target = group;
    this.scene.add(group);
  }

  setProgress(counts) {
    this.animations.forEach(animation => {
      if (!animation.spark) return;
      this.scene.remove(animation.object);
      animation.object.geometry.dispose();
      animation.object.material.dispose();
    });
    this.animations = [];
    this.parts.forEach((items,step)=>items.forEach((object,index)=>{
      const installed=(counts[step]||0)>index;
      object.userData.installed=installed;
      object.visible=this.workspaceMode === "assemble" ? installed : true;
      object.position.copy(object.userData.basePosition);
      object.scale.setScalar(1);
      this.setObjectOpacity(object,1);
    }));
    this.optionalParts.forEach(items=>items.forEach(object=>{ object.visible=false; this.setObjectOpacity(object,1); }));
    this.applyMode();
  }

  setTarget(step,index,selected) {
    this.targetStep=step;
    this.targetIndex=index;
    this.targetSelected=selected;
    const part=this.parts[step]?.[index];
    this.clearPreview();
    if(!part){ this.target.visible=false; return; }
    this.target.visible=true;
    this.target.position.copy(part.userData.focus);
    this.target.position.y+=.18;
    const color=selected?C.mint:0xffb54d;
    this.target.children.forEach(child=>child.material.color.setHex(color));
    const preview=part.clone(true);
    preview.visible=true;
    preview.position.copy(part.userData.basePosition);
    if(part.userData.motion==="drop")preview.position.y+=.55;
    preview.traverse(child=>{
      if(child.isSprite){child.visible=false;return;}
      if(!child.material)return;
      child.material=Array.isArray(child.material)?child.material.map(mat=>mat.clone()):child.material.clone();
      const materials=Array.isArray(child.material)?child.material:[child.material];
      materials.forEach(mat=>{
        mat.transparent=true;
        mat.opacity=selected ? .34 : .15;
        mat.depthWrite=false;
        if("emissive" in mat){mat.emissive.setHex(selected ? C.mint : 0xffb54d);mat.emissiveIntensity=selected ? .42 : .16;}
      });
      child.castShadow=false;
    });
    this.previewPart=preview;
    this.root.add(preview);
  }

  clearPreview(){
    if(!this.previewPart)return;
    this.previewPart.traverse(child=>{
      if(!child.material)return;
      const materials=Array.isArray(child.material)?child.material:[child.material];
      materials.forEach(mat=>mat.dispose());
    });
    this.root.remove(this.previewPart);
    this.previewPart=null;
  }

  hideTarget(){ this.target.visible=false; this.clearPreview(); }

  install(step,index) {
    const object=this.parts[step]?.[index];
    if(!object||object.userData.installed)return false;
    this.clearPreview();
    object.userData.installed=true;
    object.visible=true;
    const base=object.userData.basePosition.clone();
    const offset=this.exploded?step*.22:0;
    const target=base.clone(); target.y+=offset;
    const motion=object.userData.motion;
    if(motion==="fade"||motion==="solder"){
      object.position.copy(target);
      this.setObjectOpacity(object,0);
    }else if(motion==="slide"){
      object.position.copy(target).add(new THREE.Vector3(0,-.2,4.2));
      object.scale.set(.9,.9,.9);
    }else{
      object.position.copy(target).add(new THREE.Vector3(0,2.7,0));
      object.scale.set(.86,.86,.86);
    }
    this.animations.push({object,target,start:performance.now(),duration:motion==="solder"?1050:850,motion});
    if(motion==="solder")this.spark(object.userData.focus);
    return true;
  }

  spark(position){
    const count=34;
    const positions=new Float32Array(count*3);
    const velocities=[];
    for(let i=0;i<count;i+=1){
      positions[i*3]=position.x;positions[i*3+1]=position.y+.2;positions[i*3+2]=position.z;
      velocities.push(new THREE.Vector3((Math.random()-.5)*2.2,Math.random()*2.3,(Math.random()-.5)*2.2));
    }
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
    const mat=new THREE.PointsMaterial({color:0xffc85a,size:.09,transparent:true,opacity:1,depthWrite:false});
    const points=new THREE.Points(geometry,mat); this.scene.add(points);
    this.animations.push({spark:true,object:points,velocities,start:performance.now(),duration:650});
  }

  setObjectOpacity(object,value){
    object.traverse(child=>{
      if(!child.material)return;
      const materials=Array.isArray(child.material)?child.material:[child.material];
      materials.forEach(mat=>{mat.transparent=value<1||mat.userData.baseOpacity<1;mat.opacity=(mat.userData.baseOpacity??1)*value;});
    });
  }

  setWorkspaceMode(mode, counts = []) {
    this.workspaceMode = mode;
    this.hideTarget();
    if (mode === "assemble") {
      this.focusedComponent = null;
      this.forceAllWiring = false;
      this.cameraTargetGoal.set(0,.55,0);
      this.setProgress(counts);
      return;
    }
    this.parts.flat().forEach(object=>{ object.visible=true; object.position.copy(object.userData.basePosition); });
    this.optionalParts.forEach(items=>items.forEach(object=>object.visible=false));
    this.applyMode();
  }

  focusComponent(id, traceWires = false) {
    this.focusedComponent = id;
    if (traceWires) this.forceAllWiring = true;
    const objects = this.componentMap.get(id) || [];
    if (objects.length) {
      const focus = objects.reduce((sum,object)=>sum.add(object.userData.focus || new THREE.Vector3()),new THREE.Vector3()).multiplyScalar(1/objects.length);
      this.cameraTargetGoal.copy(focus);
      const wide = ["frame","motor","guard","prop","pdb","esc","battery"].includes(id);
      this.cameraGoal.radius = wide ? 12.6 : id === "matrix" ? 8.4 : 8.8;
      this.cameraGoal.elevation = id === "matrix" ? .95 : .58;
    }
    this.applyMode();
  }

  showAllWiring(value = true) {
    this.forceAllWiring = value;
    if (value) {
      this.cameraTargetGoal.set(0,.62,0);
      this.cameraGoal.radius = 14.2;
    }
    this.applyMode();
  }

  connectOptional(id) {
    const objects=this.optionalParts.get(id)||[];
    let shown=false;
    objects.forEach(object=>{
      const harness=object.userData.harness;
      if(harness){harness.visible=true;shown=true;}
    });
    this.focusedComponent=id;
    this.applyMode();
    return shown;
  }

  setWiringMode(value, showUninstalled = false){
    this.wiring=value;
    if(showUninstalled)this.forceAllWiring=value;
    if(!value)this.forceAllWiring=false;
    this.applyMode();
  }

  applyMode(){
    const focusedObjects = new Set(this.componentMap.get(this.focusedComponent) || []);
    this.parts.flat().forEach(object=>{
      const installed = object.userData.installed;
      const displayInLab = this.workspaceMode !== "assemble";
      const forceWire = this.forceAllWiring && object.userData.category === "wire";
      object.visible = forceWire || this.forceAllWiring || (displayInLab ? true : installed);
      if(this.customWireMode&&object.userData.category==="wire")object.visible=false;
      if(!object.visible)return;
      let opacity=1;
      if(this.wiring){
        if(object.userData.category==="wire")opacity=1;
        else if(object.userData.category==="support")opacity=.36;
        else opacity=.1;
      }
      if(this.focusedComponent && displayInLab && !focusedObjects.has(object) && !forceWire) opacity=Math.min(opacity,.075);
      if(focusedObjects.has(object)) opacity=1;
      this.setObjectOpacity(object,opacity);
      object.traverse(child=>{if(child.userData.annotation)child.visible=false;});
    });
    this.optionalParts.forEach((items,id)=>items.forEach(object=>{
      const relevant=this.workspaceMode !== "assemble" && id===this.focusedComponent;
      object.visible=relevant;
      if(relevant)this.setObjectOpacity(object,1);
      object.traverse(child=>{if(child.userData.annotation)child.visible=false;});
    }));
    this.portMarkers.visible=this.wiring||this.workspaceMode==="learn"||this.workspaceMode==="test";
    this.customWireGroup.visible=this.customWireMode&&this.wiring;
  }

  setCustomWires(connections = []) {
    this.interactiveMeshes=this.interactiveMeshes.filter(mesh=>mesh.userData.portId);
    this.customWireGroup.traverse(child=>{
      if(child.geometry)child.geometry.dispose();
      if(child.material){const mats=Array.isArray(child.material)?child.material:[child.material];mats.forEach(mat=>mat.dispose());}
    });
    this.customWireGroup.clear();
    const colors={power:C.wireRed,ground:0x73828b,signal:C.wireWhite,phase:C.blue};
    connections.forEach((wire,index)=>{
      const a=this.portPositions.get(wire.a),b=this.portPositions.get(wire.b);
      if(!a||!b)return;
      const midpoint=a.clone().lerp(b,.5);
      midpoint.y=Math.max(a.y,b.y)+.28+index%4*.035;
      const direction=b.clone().sub(a),side=new THREE.Vector3(-direction.z,0,direction.x).normalize().multiplyScalar(((index%5)-2)*.035);
      midpoint.add(side);
      const color=wire.valid===false?0xff4fd8:(colors[wire.kind]||C.mint);
      const mat=lineMaterial(color,true); mat.emissiveIntensity=wire.valid===false ? .55 : .28;
      const mesh=tube([a.clone(),a.clone().lerp(midpoint,.42),midpoint,b.clone().lerp(midpoint,.42),b.clone()],wire.kind==="phase" ? .038 : .046,mat,42);
      mesh.userData.wireInfo={...wire,title:wire.label||"Custom 3D wire",color:`#${color.toString(16).padStart(6,"0")}`};
      mesh.castShadow=false; mesh.renderOrder=35;
      this.customWireGroup.add(mesh); this.interactiveMeshes.push(mesh);
    });
    this.customWireMode=true;
    this.applyMode();
  }

  setMotorTest(index, speed) {
    this.motorTest.index = index;
    this.motorTest.speed = Math.max(0, Number(speed) || 0);
  }

  setServoAngle(index, angle) {
    const horn=this.servoHorns[index];
    if(horn)horn.rotation.y=THREE.MathUtils.degToRad(Number(angle)||0);
  }

  setMatrixPattern(pattern, colorValue = "#6af4c5") {
    if(!this.matrixPixels)return;
    const chosen=new THREE.Color(colorValue);
    const dark=new THREE.Color(0x07110f);
    for(let row=0;row<16;row+=1){
      for(let col=0;col<16;col+=1){
        const index=row*16+col;
        let color=dark;
        if(pattern==="rainbow")color=new THREE.Color().setHSL((col/16+row/42)%1,.84,.56);
        if(pattern==="status")color=col<8?new THREE.Color(0xe8433e):chosen;
        if(pattern==="arrow"){
          const lit=(col>=7&&col<=8&&row>=4)||(row===4&&col>=4&&col<=11)||(row===3&&col>=5&&col<=10)||(row===2&&col>=6&&col<=9);
          color=lit?chosen:dark;
        }
        this.matrixPixels.setColorAt(index,color);
      }
    }
    if(this.matrixPixels.instanceColor)this.matrixPixels.instanceColor.needsUpdate=true;
  }

  stopTests() {
    this.motorTest.index=-1;
    this.motorTest.speed=0;
  }

  setExploded(value){ this.exploded=value; }
  setAutoRotate(value){ this.autoRotate=value; }

  setCamera(view){
    const views={
      iso:{azimuth:-.72,elevation:.62,radius:15.4},
      top:{azimuth:0,elevation:1.485,radius:16.2},
      front:{azimuth:Math.PI,elevation:.16,radius:15.8}
    };
    Object.assign(this.cameraGoal,views[view]||views.iso);
  }

  bindControls(){
    const pointers=new Map();
    let pinchDistance=0;
    this.canvas.addEventListener("pointerdown",event=>{
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      this.canvas.setPointerCapture(event.pointerId);
      if(pointers.size===1){this.drag={active:true,x:event.clientX,y:event.clientY,moved:0,id:event.pointerId};this.stage.classList.add("dragging");}
      if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
    });
    this.canvas.addEventListener("pointermove",event=>{
      if(!pointers.has(event.pointerId))return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2){
        const p=[...pointers.values()]; const distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
        if(pinchDistance)this.cameraGoal.radius=THREE.MathUtils.clamp(this.cameraGoal.radius-(distance-pinchDistance)*.025,8.5,23);
        pinchDistance=distance; return;
      }
      if(!this.drag.active||this.drag.id!==event.pointerId)return;
      const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;
      this.drag.moved+=Math.abs(dx)+Math.abs(dy);
      this.drag.x=event.clientX;this.drag.y=event.clientY;
      this.cameraGoal.azimuth-=dx*.008;
      this.cameraGoal.elevation=THREE.MathUtils.clamp(this.cameraGoal.elevation+dy*.006,.08,1.49);
    });
    const finish=event=>{
      const wasClick=this.drag.id===event.pointerId&&this.drag.moved<7;
      pointers.delete(event.pointerId);
      if(this.drag.id===event.pointerId){this.drag.active=false;this.stage.classList.remove("dragging");}
      if(wasClick)this.handleClick(event);
    };
    this.canvas.addEventListener("pointerup",finish);
    this.canvas.addEventListener("pointercancel",finish);
    this.canvas.addEventListener("wheel",event=>{event.preventDefault();this.cameraGoal.radius=THREE.MathUtils.clamp(this.cameraGoal.radius+event.deltaY*.012,8.5,23);},{passive:false});
    window.addEventListener("resize",()=>this.resize());
  }

  handleClick(event){
    const rect=this.canvas.getBoundingClientRect();
    this.pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
    this.pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const inspectable=this.interactiveMeshes.filter(mesh=>mesh.visible&&mesh.parent?.visible!==false);
    const inspected=this.raycaster.intersectObjects(inspectable,false)[0]?.object;
    if(inspected?.userData.portId){this.onInspect?.({type:"port",id:inspected.userData.portId},{x:event.clientX,y:event.clientY});return;}
    if(inspected?.userData.wireInfo){this.onInspect?.({type:"wire",...inspected.userData.wireInfo},{x:event.clientX,y:event.clientY});return;}
    if(this.target.visible){
      const targetHit=this.raycaster.intersectObjects(this.target.children,true);
      if(targetHit.length){this.onTarget?.();return;}
    }
    if(this.workspaceMode!=="assemble"){
      const hit=this.raycaster.intersectObjects(this.root.children,true).find(item=>item.object.visible&&item.object.userData.ownerPart?.userData.componentId);
      const componentId=hit?.object.userData.ownerPart?.userData.componentId;
      if(componentId)this.onInspect?.({type:"component",componentId},{x:event.clientX,y:event.clientY});
    }
  }

  resize(){
    const width=Math.max(1,this.stage.clientWidth),height=Math.max(1,this.stage.clientHeight);
    this.renderer.setSize(width,height,false);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
  }

  updateAnimations(now,dt){
    this.animations=this.animations.filter(animation=>{
      const t=Math.min(1,(now-animation.start)/animation.duration);
      const eased=1-Math.pow(1-t,3);
      if(animation.spark){
        const attr=animation.object.geometry.attributes.position;
        for(let i=0;i<animation.velocities.length;i+=1){
          const v=animation.velocities[i];v.y-=5*dt;
          attr.array[i*3]+=v.x*dt;attr.array[i*3+1]+=v.y*dt;attr.array[i*3+2]+=v.z*dt;
        }
        attr.needsUpdate=true;animation.object.material.opacity=1-t;
        if(t>=1){this.scene.remove(animation.object);animation.object.geometry.dispose();animation.object.material.dispose();return false;}return true;
      }
      const {object,target,motion}=animation;
      if(motion==="fade"||motion==="solder")this.setObjectOpacity(object,eased);
      else{
        object.position.lerp(target,Math.min(1,dt*8));
        object.scale.setScalar(.86+.14*eased);
        object.traverse(child=>{if(child.userData.isScrew)child.rotation.y+=dt*20*(1-t);});
      }
      if(t>=1){object.position.copy(target);object.scale.setScalar(1);this.applyMode();return false;}return true;
    });
  }

  animate(){
    requestAnimationFrame(()=>this.animate());
    const dt=Math.min(this.clock.getDelta(),.04),now=performance.now();
    if(this.autoRotate&&!this.drag.active)this.cameraGoal.azimuth+=dt*.22;
    this.azimuth=THREE.MathUtils.lerp(this.azimuth,this.cameraGoal.azimuth,.08);
    this.elevation=THREE.MathUtils.lerp(this.elevation,this.cameraGoal.elevation,.08);
    this.radius=THREE.MathUtils.lerp(this.radius,this.cameraGoal.radius,.08);
    this.cameraTarget.lerp(this.cameraTargetGoal,.08);
    const horizontal=Math.cos(this.elevation)*this.radius;
    this.camera.position.set(
      this.cameraTarget.x+Math.sin(this.azimuth)*horizontal,
      this.cameraTarget.y+Math.sin(this.elevation)*this.radius+.45,
      this.cameraTarget.z+Math.cos(this.azimuth)*horizontal
    );
    this.camera.lookAt(this.cameraTarget);
    this.parts.flat().forEach(object=>{
      if(!object.visible||this.animations.some(a=>a.object===object))return;
      const desired=object.userData.basePosition.y+(this.exploded?object.userData.step*.24:0);
      object.position.y=THREE.MathUtils.lerp(object.position.y,desired,.075);
    });
    if(this.motorTest.index>=0&&this.motorTest.speed>0){
      const index=this.motorTest.index;
      const direction=index%2?-1:1;
      const motor=this.parts[3][index];
      if(motor?.userData.rotor)motor.userData.rotor.rotation.y+=direction*dt*(2+this.motorTest.speed*.34);
      const prop=this.parts[11][index];
      if(prop?.userData.rotor)prop.userData.rotor.rotation.y+=direction*dt*(2+this.motorTest.speed*.34);
    }
    if(this.target.visible){const pulse=1+Math.sin(now*.006)*.14;this.target.scale.setScalar(pulse);this.target.rotation.y+=dt*.9;}
    this.updateAnimations(now,dt);
    this.renderer.render(this.scene,this.camera);
  }
}
