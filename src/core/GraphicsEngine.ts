import * as THREE from 'three';

export class GraphicsEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private skybox: THREE.Mesh;
  private skyUniforms: { [uniform: string]: THREE.IUniform };

  // Lighting references
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;

  // Day/Night Cycle Config
  private cycleTime: number = 30 * 60 * 0.25; // Start at Noon (1/4th of cycle)
  private readonly cycleDuration: number = 30 * 60; // 30 minutes in seconds

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    // Create gradient skybox
    this.skybox = this.createSkybox();

    // Enhanced atmospheric fog
    this.scene.fog = new THREE.FogExp2(0x9db4c0, 0.0015);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, -10);
    this.camera.lookAt(0, 0, 0);

    // Enhanced renderer settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    container.appendChild(this.renderer.domElement);

    // Enhanced lighting setup
    this.setupLighting();

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  private createSkybox(): THREE.Mesh {
    // Create gradient sky using shader
    const skyGeo = new THREE.SphereGeometry(500, 32, 15);

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
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
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
    // Assuming X is East-West, Y is Up-Down, Z is North-South
    // Let's make it rise in X, set in -X
    const radius = 100;
    const sunX = Math.cos(angle) * radius;
    const sunY = Math.sin(angle) * radius;
    const sunZ = 50; // Slight offset

    this.sunLight.position.set(sunX, sunY, sunZ);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.target.updateMatrixWorld();

    // Moon Position (Opposite to Sun)
    this.moonLight.position.set(-sunX, -sunY, sunZ);
    this.moonLight.target.position.set(0, 0, 0);
    this.moonLight.target.updateMatrixWorld();

    // Determine Day/Night Phase
    // sin(angle) > 0 is Day (Sun is up), < 0 is Night
    const isDay = sunY > 0;
    const sunHeight = Math.max(0, sunY / radius); // 0 to 1
    const moonHeight = Math.max(0, -sunY / radius); // 0 to 1

    // Update Light Intensities
    // Sun: Peak intensity at noon (sunHeight = 1), 0 at horizon
    this.sunLight.intensity = THREE.MathUtils.lerp(0, 2.0, sunHeight); // Increased max to 2.0

    // Moon: Peak intensity at midnight
    this.moonLight.intensity = THREE.MathUtils.lerp(0, 1.0, moonHeight); // Increased to 1.0

    // Hemisphere Light: Transitions from Blue/White (Day) to Dark Blue/Black (Night)
    const daySkyColor = new THREE.Color(0xffffff);
    const dayGroundColor = new THREE.Color(0x888888);
    const nightSkyColor = new THREE.Color(0x111144); // Brighter night blue
    const nightGroundColor = new THREE.Color(0x111122); // Brighter night ground

    // Interpolate based on sun height (using a smooth step for transition)
    // We need a value that goes 1 -> 0 -> 1 for Day -> Night -> Day
    // Actually, let's just use sunY. If sunY > 0, we blend towards day. If sunY < 0, towards night.
    // Smooth transition around horizon
    const dayFactor = (Math.sin(angle) + 1) / 2; // 0 to 1, but sinusoidal
    // Let's refine: Sharp transition at horizon isn't great.
    // Use sunY directly but clamped/smoothed.

    // Sky Color Interpolation
    // Day Sky: 0x0099ff (Top), 0xffffff (Bottom)
    // Night Sky: 0x000033 (Top), 0x000011 (Bottom)
    // Sunset/Sunrise: 0xff9900 (Top), 0xff3300 (Bottom) - Optional, for extra flair

    const dayTop = new THREE.Color(0x0099ff);
    const dayBot = new THREE.Color(0xffffff);
    const nightTop = new THREE.Color(0x000066); // Brighter night sky
    const nightBot = new THREE.Color(0x000033); // Brighter night horizon
    const sunsetTop = new THREE.Color(0x442266); // Purple-ish
    const sunsetBot = new THREE.Color(0xff9900); // Orange

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

    this.skyUniforms.topColor.value.copy(currentTop);
    this.skyUniforms.bottomColor.value.copy(currentBot);

    // Update Hemi Light Color
    this.hemiLight.color.lerpColors(nightSkyColor, daySkyColor, isDay ? sunHeight : 0);
    this.hemiLight.groundColor.lerpColors(nightGroundColor, dayGroundColor, isDay ? sunHeight : 0);
    // Ensure minimum brightness
    this.hemiLight.intensity = isDay ? 0.6 + 0.4 * sunHeight : 0.4;

    // Update Fog Color to match horizon (bottom color)
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(currentBot);
    }
  }

  render(dt: number) {
    this.update(dt);

    // Update skybox position to follow camera
    this.skybox.position.copy(this.camera.position);
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
