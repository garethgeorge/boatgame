import * as THREE from 'three';
import { TerrainChunk } from '../world/TerrainChunk';
import { SkyManager } from './graphics/SkyManager';

export class GraphicsEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  private skyManager: SkyManager;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

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

    // Initialize SkyManager
    this.skyManager = new SkyManager(this.scene, container, this.renderer.domElement);

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  update(dt: number) {
    this.skyManager.update(dt, this.camera.position);
  }

  public updateBiome(weights: { desert: number, forest: number, ice: number }) {
    this.skyManager.updateBiome(weights);
  }

  render(dt: number) {
    this.update(dt);

    // Update Water Shader Uniforms
    if (TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial.uniforms.uTime.value += dt;
      TerrainChunk.waterMaterial.uniforms.uSunPosition.value.copy(this.skyManager.getSunPosition());
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
