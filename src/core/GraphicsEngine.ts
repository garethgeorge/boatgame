import * as THREE from 'three';

export class GraphicsEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private skybox: THREE.Mesh;

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
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0099ff) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 33 },
        exponent: { value: 0.5 }
      },
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
    // Brighter hemisphere light for vibrant cartoon look
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.8);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Main directional light (sun) - brighter for cartoon style
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;

    // Enhanced shadow settings
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.bias = -0.0001;

    this.scene.add(dirLight);

    // Fill light - brighter for cartoon flatness
    const fillLight = new THREE.DirectionalLight(0xccddff, 0.5);
    fillLight.position.set(-50, 30, -50);
    this.scene.add(fillLight);
  }

  render() {
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
