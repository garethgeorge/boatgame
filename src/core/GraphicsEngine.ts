import * as THREE from 'three';
import { TerrainChunk } from '../world/TerrainChunk';

export class GraphicsEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private skybox: THREE.Mesh;
  private skyUniforms: { [uniform: string]: THREE.IUniform };
  private screenTint: HTMLDivElement;
  private currentBiomeWeights: { desert: number, forest: number, ice: number } = { desert: 1, forest: 0, ice: 0 };

  // Celestial Bodies
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;

  // Lighting references
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;

  // Day/Night Cycle Config
  // Day/Night Cycle Config
  private readonly cycleDuration: number = 15 * 60; // 15 minutes in seconds
  // Start at High Morning (Angle 30 degrees)
  // 30/360 * 15*60 = 1/12 * 900 = 75 seconds.
  private cycleTime: number = 75;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    // Create gradient skybox
    this.skybox = this.createSkybox();

    // Fog removed per user request
    // Fog setup
    this.scene.fog = new THREE.Fog(0xffffff, 100, 1000);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, -10);
    this.camera.lookAt(0, 0, 0);

    // Enhanced renderer settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.shadowMap.enabled = false; // Shadows disabled per user request
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    container.appendChild(this.renderer.domElement);

    // Create screen tint overlay
    this.screenTint = document.createElement('div');
    this.screenTint.style.position = 'absolute';
    this.screenTint.style.top = '0';
    this.screenTint.style.left = '0';
    this.screenTint.style.width = '100%';
    this.screenTint.style.height = '100%';
    this.screenTint.style.pointerEvents = 'none';
    this.screenTint.style.zIndex = '10';
    this.screenTint.style.transition = 'background-color 1s ease';
    this.screenTint.style.mixBlendMode = 'overlay'; // Better blending
    container.appendChild(this.screenTint);

    // Create Sun Mesh
    // Create Sun Mesh
    const sunGeo = new THREE.SphereGeometry(30, 32, 32); // Increased size
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa }); // Bright yellow/white
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Create Moon Mesh
    const moonGeo = new THREE.SphereGeometry(20, 32, 32); // Increased size
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff }); // Pale white/blue
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    // Enhanced lighting setup
    this.setupLighting();

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  private createSkybox(): THREE.Mesh {
    // Create gradient sky using shader
    const skyGeo = new THREE.SphereGeometry(360, 32, 15);

    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x0099ff) },
      bottomColor: { value: new THREE.Color(0xffffff) },
      offset: { value: 33 },
      exponent: { value: 0.5 }
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vLocalPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        void main() {
          // Use local position for gradient to keep it relative to camera/skybox center
          float h = normalize(vLocalPosition + vec3(0, offset, 0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
    return sky;
  }

  private setupLighting() {
    // Hemisphere light for natural ambient lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Main directional light (sun) - brighter for cartoon style
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;

    // Enhanced shadow settings
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.sunLight.shadow.bias = -0.0001;

    this.scene.add(this.sunLight);

    // Moon Light (initially off or low intensity)
    this.moonLight = new THREE.DirectionalLight(0x6666ff, 0.0); // Blueish tint for night
    this.moonLight.position.set(-50, 100, -50);
    this.moonLight.castShadow = true;
    // Copy shadow settings from sun for simplicity, or tune separately
    this.moonLight.shadow.mapSize.width = 2048;
    this.moonLight.shadow.mapSize.height = 2048;
    this.moonLight.shadow.camera = this.sunLight.shadow.camera.clone();
    this.scene.add(this.moonLight);

    // Ambient light for base visibility
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.2); // Soft white light
    this.scene.add(this.ambientLight);
  }

  update(dt: number) {
    // Update Day/Night Cycle
    this.cycleTime += dt;
    if (this.cycleTime > this.cycleDuration) {
      this.cycleTime -= this.cycleDuration;
    }

    const time = this.cycleTime / this.cycleDuration; // 0 to 1
    const angle = time * Math.PI * 2; // 0 to 2PI

    // Sun Position (Rotates around Z axis for simplicity, rising in East, setting in West)
    // "Small arc near the horizon line"
    // "Too high and a bit too wide"

    const radius = 200;
    const orbitCenterZ = -150; // Keep it well in front (Down River is -Z)

    // Orbit in X-Y plane, but shifted to -Z.
    // "Small arc": Reduce X range significantly.
    // "Near horizon": Reduce Y range significantly.

    const sunX = Math.cos(angle) * radius * 0.4; // Very narrow arc
    // Shift sine wave up by 0.5 to get 2:1 Day/Night ratio
    // sin(angle) + 0.5 > 0 for 240 degrees (Day), < 0 for 120 degrees (Night)
    const sunY = (Math.sin(angle) + 0.5) * radius * 0.3; // Low arc
    const sunZ = orbitCenterZ; // Fixed Z plane

    this.sunLight.position.set(sunX, sunY, sunZ);
    this.sunLight.target.position.set(0, 0, -50); // Target slightly forward
    this.sunLight.target.updateMatrixWorld();

    // Update Sun Mesh Position
    const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
    this.sunMesh.position.copy(this.camera.position).add(sunDir.multiplyScalar(300)); // Inside skybox (360)

    // Moon Position (Opposite to Sun)
    const moonX = -sunX;
    const moonY = -sunY;
    const moonZ = orbitCenterZ;

    this.moonLight.position.set(moonX, moonY, moonZ);
    this.moonLight.target.position.set(0, 0, -50);
    this.moonLight.target.updateMatrixWorld();

    const moonDir = new THREE.Vector3(moonX, moonY, moonZ).normalize();
    this.moonMesh.position.copy(this.camera.position).add(moonDir.multiplyScalar(300));

    // Determine Day/Night Phase
    // sin(angle) > 0 is Day (Sun is up), < 0 is Night
    const isDay = sunY > 0;
    // Normalize height based on the new max Y (radius * 0.3)
    // Normalize height based on the new max Y
    // Max Y is (1 + 0.5) * radius * 0.3 = 1.5 * radius * 0.3
    // But we just want a 0-1 factor for intensity.
    // Let's use max(0, sunY / maxPossibleY)
    const maxSunY = 1.5 * radius * 0.3;
    const sunHeight = Math.max(0, sunY / maxSunY);

    // Moon is opposite.
    // moonY = -sunY = -(sin + 0.5) = -sin - 0.5.
    // Moon is up when -sin - 0.5 > 0 => sin < -0.5.
    // This matches the 120 degree night window.
    // Max moon height is when sin = -1 => -(-1) - 0.5 = 0.5.
    // So max moonY is 0.5 * radius * 0.3.
    const maxMoonY = 0.5 * radius * 0.3;
    const moonHeight = Math.max(0, moonY / maxMoonY);

    // Update Light Intensities
    // Minimum light level: 0.5

    // Sun Intensity: 0 to 1.5 (Reduced from 2.0 to prevent washout)
    this.sunLight.intensity = THREE.MathUtils.lerp(0, 1.5, sunHeight);

    // Moon Intensity: 0 to 3.0 (Very bright moon)
    this.moonLight.intensity = THREE.MathUtils.lerp(0, 3.0, moonHeight);

    // Hemisphere Light (Ambient)
    // Should never drop below 0.8
    // Day: 1.2, Night: 0.8

    let targetHemiIntensity = 0.8;
    if (isDay) {
      targetHemiIntensity = 0.8 + 0.4 * sunHeight;
    } else {
      targetHemiIntensity = 0.8 + 0.4 * moonHeight;
    }
    this.hemiLight.intensity = targetHemiIntensity;

    // Hemisphere Light Colors
    const daySkyColor = new THREE.Color(0xffffff);
    const dayGroundColor = new THREE.Color(0xaaaaaa);
    const nightSkyColor = new THREE.Color(0x6666aa); // Very bright night blue
    const nightGroundColor = new THREE.Color(0x444466); // Very bright night ground

    this.hemiLight.color.lerpColors(nightSkyColor, daySkyColor, isDay ? sunHeight : 0);
    this.hemiLight.groundColor.lerpColors(nightGroundColor, dayGroundColor, isDay ? sunHeight : 0);

    // Sky Color Interpolation
    // Pastel Sunset Vibe
    // Day (Sunset): Lavender to Peach
    // Night: Deep Slate Blue to Dark Purple

    const dayTop = new THREE.Color(0xA69AC2); // Pastel Lavender
    const dayBot = new THREE.Color(0xFFCBA4); // Pastel Peach
    const nightTop = new THREE.Color(0x1A1A3A); // Dark Slate Blue
    const nightBot = new THREE.Color(0x2D2D44); // Muted Dark Purple
    const sunsetTop = new THREE.Color(0x967BB6); // Muted Purple
    const sunsetBot = new THREE.Color(0xFF9966); // Soft Orange

    let currentTop: THREE.Color;
    let currentBot: THREE.Color;

    if (sunY > 0) {
      // Day
      if (sunY < 20) {
        // Sunrise / Sunset transition
        const t = sunY / 20;
        currentTop = sunsetTop.clone().lerp(dayTop, t);
        currentBot = sunsetBot.clone().lerp(dayBot, t);
      } else {
        currentTop = dayTop;
        currentBot = dayBot;
      }
    } else {
      // Night
      if (sunY > -20) {
        // Twilight
        const t = -sunY / 20;
        currentTop = sunsetTop.clone().lerp(nightTop, t);
        currentBot = sunsetBot.clone().lerp(nightBot, t);
      } else {
        currentTop = nightTop;
        currentBot = nightBot;
      }
    }

    // Apply Biome Modifier to Sky Colors
    // Forest: Cooler, Crisper Blue
    // Desert: Warmer, Duster (Default)

    const forestTopMod = new THREE.Color(0x4488ff); // Crisp Blue
    const forestBotMod = new THREE.Color(0xcceeff); // White/Blue Horizon

    // Blend current sky colors towards forest colors based on biome factor
    // We only affect Day colors significantly
    // Blend current sky colors towards forest/ice colors based on biome weights
    // We only affect Day colors significantly
    if (isDay) {
      // Forest Influence
      currentTop.lerp(forestTopMod, this.currentBiomeWeights.forest * 0.6);
      currentBot.lerp(forestBotMod, this.currentBiomeWeights.forest * 0.6);

      // Ice Influence (Cooler, whiter)
      const iceTopMod = new THREE.Color(0xddeeff); // Pale Ice Blue
      const iceBotMod = new THREE.Color(0xffffff); // White
      currentTop.lerp(iceTopMod, this.currentBiomeWeights.ice * 0.8);
      currentBot.lerp(iceBotMod, this.currentBiomeWeights.ice * 0.8);
    }

    this.skyUniforms.topColor.value.copy(currentTop);
    this.skyUniforms.bottomColor.value.copy(currentBot);

    // Update Fog Color to match horizon (bottom color)
    if (this.scene.fog) {
      this.scene.fog.color.copy(currentBot);
    }
  }

  public updateBiome(weights: { desert: number, forest: number, ice: number }) {
    this.currentBiomeWeights = weights;

    // Update Screen Tint
    // Desert: Sepia/Warm
    // Forest: Cool Blue
    // Ice: Cold Cyan/White

    const desertColor = { r: 180, g: 140, b: 100, a: 0.15 }; // Sepia
    const forestColor = { r: 100, g: 150, b: 200, a: 0.15 }; // Cool Blue
    const iceColor = { r: 200, g: 240, b: 255, a: 0.20 }; // Cold Cyan (Higher opacity)

    // Blend
    const r = desertColor.r * weights.desert + forestColor.r * weights.forest + iceColor.r * weights.ice;
    const g = desertColor.g * weights.desert + forestColor.g * weights.forest + iceColor.g * weights.ice;
    const b = desertColor.b * weights.desert + forestColor.b * weights.forest + iceColor.b * weights.ice;
    const a = desertColor.a * weights.desert + forestColor.a * weights.forest + iceColor.a * weights.ice;

    this.screenTint.style.backgroundColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

    // Update Fog
    if (this.scene.fog instanceof THREE.Fog) {
      // Base Fog (Desert/Forest): Far away, subtle
      const baseNear = 100;
      const baseFar = 800;
      const baseColor = new THREE.Color(0xffffff);

      // Ice Fog: Close in, "not 100% opaque" (meaning maybe not fully white? or just not too dense?)
      // User said "dramatically reduce... snow storm".
      const iceNear = 0; // Start fog immediately
      const iceFar = 20; // Extreme dense fog (Snow storm) - Reduced from 50
      const iceColor = new THREE.Color(0xE0F6FF); // Ice Blue

      // Lerp values
      const targetNear = THREE.MathUtils.lerp(baseNear, iceNear, weights.ice);
      const targetFar = THREE.MathUtils.lerp(baseFar, iceFar, weights.ice);

      this.scene.fog.near = targetNear;
      this.scene.fog.far = targetFar;

      // Blend fog color with sky bottom color (which is already updated in update())
      // But we want specific ice fog color?
      // Actually, update() sets fog color to match sky bottom.
      // Let's override that behavior if we want specific control, or just let update() handle color
      // and we handle distance here.
      // In update(): "this.scene.fog.color.copy(currentBot);"
      // This is good for blending.
      // But for Ice, we might want it to be more distinct?
      // Let's let update() handle color for consistency, but we control distance here.
    }

    // Update Desaturation (CSS Filter)
    // Desert/Forest: 0% grayscale
    // Ice: 90% grayscale (Strong desaturation)
    const grayscale = weights.ice * 0.9;
    this.renderer.domElement.style.filter = `grayscale(${grayscale})`;
  }

  render(dt: number) {
    this.update(dt);

    // Update skybox position to follow camera
    this.skybox.position.copy(this.camera.position);

    // Update Water Shader Uniforms
    if (TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial.uniforms.uTime.value += dt;
      TerrainChunk.waterMaterial.uniforms.uSunPosition.value.copy(this.sunLight.position);
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  add(object: THREE.Object3D) {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D) {
    this.scene.remove(object);
  }
}
