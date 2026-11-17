import * as THREE from "three";
import {
  createWeaveData,
  fillWeavePositions,
  weavePoint,
  WEAVE_STEPS,
  WEAVE_PALETTE,
} from "./weaveGeometry";

export function createWeaveScene(
  canvas: HTMLCanvasElement,
  onFailure: () => void,
) {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!context) throw new Error("WebGL2 unavailable");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
  camera.position.set(0, 0.1, 8.6);
  const sculpture = new THREE.Group();
  sculpture.rotation.set(-0.12, -0.4, -0.24);
  scene.add(sculpture);
  scene.add(new THREE.HemisphereLight(0xf3f7ed, 0x1b2411, 2.4));
  const key = new THREE.DirectionalLight(0xf3f7ed, 4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x27fb6b, 3);
  rim.position.set(3, -1, -2);
  scene.add(rim);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const ribbons = WEAVE_PALETTE.map((color, strand) => {
    const data = createWeaveData(strand);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(data.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.25,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    sculpture.add(new THREE.Mesh(geometry, material));
    geometries.push(geometry);
    materials.push(material);
    const edgePositions = new Float32Array((WEAVE_STEPS + 1) * 2 * 3);
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(edgePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xb4f8c5,
      transparent: true,
      opacity: 0.34,
    });
    // A single line follows both open edges, joining them at the top.
    const line = new THREE.Line(edgeGeometry, edgeMaterial);
    line.frustumCulled = false;
    sculpture.add(line);
    geometries.push(edgeGeometry);
    materials.push(edgeMaterial);
    return {
      geometry,
      positions: data.positions,
      edgeGeometry,
      edgePositions,
      strand,
    };
  });
  const pulses = new Float32Array(5 * 12 * 3);
  const pulseGeometry = new THREE.BufferGeometry();
  pulseGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(pulses, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const pulseMaterial = new THREE.PointsMaterial({
    color: 0x27fb6b,
    size: 0.028,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(pulseGeometry, pulseMaterial);
  points.frustumCulled = false;
  sculpture.add(points);
  geometries.push(pulseGeometry);
  materials.push(pulseMaterial);

  let disposed = false,
    failed = false,
    paused = false,
    reduced = false,
    visible = true;
  let elapsed = 0,
    previous = 0,
    lastDraw = 0;
  let pointerX = 0,
    pointerY = 0;
  const draw = () => {
    if (disposed || failed) return;
    try {
      for (const ribbon of ribbons) {
        fillWeavePositions(ribbon.positions, ribbon.strand, elapsed);
        ribbon.geometry.getAttribute("position").needsUpdate = true;
        ribbon.geometry.computeVertexNormals();
        for (let step = 0; step <= WEAVE_STEPS; step++) {
          ribbon.edgePositions.set(
            weavePoint(step / WEAVE_STEPS, -1, ribbon.strand, elapsed),
            step * 3,
          );
          ribbon.edgePositions.set(
            weavePoint(1 - step / WEAVE_STEPS, 1, ribbon.strand, elapsed),
            (WEAVE_STEPS + 1 + step) * 3,
          );
        }
        ribbon.edgeGeometry.getAttribute("position").needsUpdate = true;
      }
      for (let strand = 0; strand < 5; strand++) {
        for (let pulse = 0; pulse < 12; pulse++) {
          const t = (elapsed * 0.055 + pulse / 12 + strand * 0.13) % 1;
          pulses.set(
            weavePoint(t, -1.03, strand, elapsed),
            (strand * 12 + pulse) * 3,
          );
        }
      }
      pulseGeometry.getAttribute("position").needsUpdate = true;
      renderer.render(scene, camera);
    } catch {
      fail();
    }
  };
  const fail = () => {
    if (disposed || failed) return;
    failed = true;
    renderer.setAnimationLoop(null);
    onFailure();
  };
  const frame = (time: number) => {
    if (disposed || failed || paused || reduced || !visible || document.hidden)
      return;
    if (!previous) previous = time;
    if (time - lastDraw < 1000 / 30) return;
    const delta = Math.min((time - previous) / 1000, 0.05);
    previous = time;
    lastDraw = time;
    elapsed += delta;
    sculpture.rotation.y +=
      (-0.4 +
        Math.sin(elapsed * 0.18) * 0.22 +
        pointerX * 0.16 -
        sculpture.rotation.y) *
      0.06;
    sculpture.rotation.x +=
      (-0.12 + pointerY * 0.1 - sculpture.rotation.x) * 0.06;
    draw();
  };
  const sync = () => {
    const playing =
      !disposed &&
      !failed &&
      !paused &&
      !reduced &&
      visible &&
      !document.hidden;
    previous = 0;
    lastDraw = 0;
    renderer.setAnimationLoop(playing ? frame : null);
  };
  const resize = () => {
    if (disposed || failed) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 1.1 ? 9.4 : 8.6;
    camera.updateProjectionMatrix();
    draw();
  };
  const move = (event: PointerEvent) => {
    if (paused || reduced || event.pointerType === "touch") return;
    const bounds = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
  };
  const leave = () => {
    pointerX = 0;
    pointerY = 0;
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  intersectionObserver.observe(canvas);
  document.addEventListener("visibilitychange", sync);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("webglcontextlost", contextLost);
  resize();
  return {
    setMotion(nextPaused: boolean, nextReduced: boolean) {
      paused = nextPaused;
      reduced = nextReduced;
      if (reduced) {
        elapsed = 0;
        sculpture.rotation.set(-0.12, -0.4, -0.24);
        draw();
      }
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
