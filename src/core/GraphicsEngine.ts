import * as THREE from 'three';
import { TerrainChunk } from '../world/TerrainChunk';
import { Skybox } from './graphics/Skybox';
import { Sun } from './graphics/Sun';
import { Moon } from './graphics/Moon';
import { ScreenOverlay } from './graphics/ScreenOverlay';

export class GraphicsEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  private skybox: Skybox;
  private screenOverlay: ScreenOverlay;
  private currentBiomeWeights: { desert: number, forest: number, ice: number } = { desert: 1, forest: 0, ice: 0 };

  // Celestial Bodies
  private sun: Sun;
  private moon: Moon;

  // Lighting references
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;

  // Day/Night Cycle Config
  private readonly cycleDuration: number = 1 * 60; // 15 minutes in seconds
  // Start at High Morning (Angle 30 degrees)
  // 30/360 * 15*60 = 1/12 * 900 = 75 seconds.
  private cycleTime: number = 75;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    // Create gradient skybox
    this.skybox = new Skybox(this.scene);

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
    this.screenOverlay = new ScreenOverlay(container, this.renderer.domElement);

    // Create Sun
    this.sun = new Sun(this.scene);

    // Create Moon
    this.moon = new Moon(this.scene, this.sun.light);

    // Enhanced lighting setup
    this.setupLighting();

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  private setupLighting() {
    // Hemisphere light for natural ambient lighting
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

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

    // Update Sun and Moon
    this.sun.update(angle, this.camera.position);
    this.moon.update(angle, this.camera.position);

    const sunY = this.sun.light.position.y;
    const moonY = this.moon.light.position.y;

    // Determine Day/Night Phase
    // sin(angle) > 0 is Day (Sun is up), < 0 is Night
    // Normalize height based on the new max Y (radius * 0.3)
    // Max Y is (1 + 0.5) * radius * 0.3 = 1.5 * 200 * 0.3 = 90
    const maxSunY = 90;
    const sunHeight = Math.max(0, sunY / maxSunY);

    // Moon is opposite.
    // Max moon height is when sin = -1 => -(-1) - 0.5 = 0.5.
    // So max moonY is 0.5 * radius * 0.3 = 0.5 * 200 * 0.3 = 30
    const maxMoonY = 30;
    const moonHeight = Math.max(0, moonY / maxMoonY);

    this.updateHemiLight(sunHeight, moonHeight);
    this.updateSkyAndFog(sunY);
  }

  private updateSkyAndFog(sunY: number) {
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
    if (sunY > 0) {
      // Forest Influence
      currentTop.lerp(forestTopMod, this.currentBiomeWeights.forest * 0.6);
      currentBot.lerp(forestBotMod, this.currentBiomeWeights.forest * 0.6);

      // Ice Influence (Cooler, whiter)
      const iceTopMod = new THREE.Color(0xddeeff); // Pale Ice Blue
      const iceBotMod = new THREE.Color(0xffffff); // White
      currentTop.lerp(iceTopMod, this.currentBiomeWeights.ice * 0.8);
      currentBot.lerp(iceBotMod, this.currentBiomeWeights.ice * 0.8);
    }

    this.skybox.update(this.camera.position, currentTop, currentBot);

    // Update Fog Color to match horizon (bottom color)
    if (this.scene.fog) {
      this.scene.fog.color.copy(currentBot);
    }
  }

  private updateHemiLight(sunHeight: number, moonHeight: number) {
    const isDay = sunHeight > 0;

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
  }

  public updateBiome(weights: { desert: number, forest: number, ice: number }) {
    this.currentBiomeWeights = weights;

    this.screenOverlay.update(weights);

    // Update Fog
    if (this.scene.fog instanceof THREE.Fog) {
      // Base Fog (Desert/Forest): Far away, subtle
      const baseNear = 100;
      const baseFar = 800;

      // Ice Fog: Close in, "not 100% opaque" (meaning maybe not fully white? or just not too dense?)
      // User said "dramatically reduce... snow storm".
      const iceNear = 0; // Start fog immediately
      const iceFar = 20; // Extreme dense fog (Snow storm) - Reduced from 50

      // Lerp values
      const targetNear = THREE.MathUtils.lerp(baseNear, iceNear, weights.ice);
      const targetFar = THREE.MathUtils.lerp(baseFar, iceFar, weights.ice);

      this.scene.fog.near = targetNear;
      this.scene.fog.far = targetFar;
    }
  }

  render(dt: number) {
    this.update(dt);

    // Update Water Shader Uniforms
    if (TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial.uniforms.uTime.value += dt;
      TerrainChunk.waterMaterial.uniforms.uSunPosition.value.copy(this.sun.light.position);
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
