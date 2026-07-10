import * as THREE from "three";

function addSkyDome(scene: THREE.Scene): THREE.MeshBasicMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#26314c");
  sky.addColorStop(0.38, "#614761");
  sky.addColorStop(0.7, "#c66655");
  sky.addColorStop(0.9, "#f0a064");
  sky.addColorStop(1, "#d8a078");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // A painted-but-smooth cloud bank. Repeated deterministic puffs make the skyline feel
  // authored without the jagged staircase that the previous 256px texture produced.
  const clouds: Array<[number, number, number, number]> = [
    [32, 178, 270, 42], [332, 118, 320, 54], [695, 202, 250, 44],
    [120, 300, 350, 56], [590, 318, 360, 60], [820, 105, 190, 34],
  ];
  for (const [x, y, w, h] of clouds) {
    const cloud = ctx.createLinearGradient(0, y - h, 0, y + h);
    cloud.addColorStop(0, "rgba(255,210,188,0.42)");
    cloud.addColorStop(1, "rgba(104,61,83,0.13)");
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.18, y, w * 0.2, h * 0.58, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.42, y - h * 0.18, w * 0.27, h * 0.72, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.7, y + h * 0.04, w * 0.31, h * 0.54, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Low sun with a broad atmospheric halo.
  const sun = ctx.createRadialGradient(780, 325, 6, 780, 325, 72);
  sun.addColorStop(0, "rgba(255,244,190,1)");
  sun.addColorStop(0.24, "rgba(255,190,105,0.92)");
  sun.addColorStop(1, "rgba(255,107,78,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(700, 245, 160, 160);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(190, 64, 28),
    material,
  );
  dome.name = "painted-sunset-sky";
  dome.renderOrder = -100;
  scene.add(dome);
  return material;
}

/** Warm late-afternoon lighting rig: soft readable sun, filled shadows, light haze.
 * Returns live refs so `DayNightCycle` can drive them each frame instead of this being
 * one-time setup only. */
export function setupLighting(scene: THREE.Scene): {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  fog: THREE.Fog;
  skyMaterial: THREE.MeshBasicMaterial;
} {
  const sun = new THREE.DirectionalLight(0xffc18a, 2.55);
  sun.position.set(-14, 18, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const coolRim = new THREE.DirectionalLight(0x8292c8, 0.42);
  coolRim.position.set(18, 10, -24);
  scene.add(coolRim);

  const hemi = new THREE.HemisphereLight(0xb9c7e4, 0x65483a, 1.32);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffe4cd, 0.28);
  scene.add(ambient);

  const fog = new THREE.Fog(0xb98777, 64, 158);
  scene.fog = fog;
  scene.background = new THREE.Color(0xc08c75);
  const skyMaterial = addSkyDome(scene);

  return { sun, hemi, ambient, fog, skyMaterial };
}
