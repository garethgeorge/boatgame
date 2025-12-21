import * as THREE from 'three';
import { GraphicsUtils } from './GraphicsUtils';
import { TerrainChunk } from '../world/TerrainChunk';
import { Profiler } from './Profiler';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { SobelShader } from '../shaders/SobelShader';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass'

export class GraphicsEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  sobelPass: ShaderPass;
  fxaaPass: ShaderPass;
  outputPass: OutputPass;
  private gcTimer: number = 0;
  private GC_INTERVAL: number = 2.0; // Run GC every 2 seconds


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

    // Post-processing setup
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.sobelPass = new ShaderPass(SobelShader);
    this.sobelPass.uniforms['resolution'].value.x = window.innerWidth * window.devicePixelRatio;
    this.sobelPass.uniforms['resolution'].value.y = window.innerHeight * window.devicePixelRatio;
    this.composer.addPass(this.sobelPass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms['resolution'].value.x = 1 / (window.innerWidth * window.devicePixelRatio);
    this.fxaaPass.uniforms['resolution'].value.y = 1 / (window.innerHeight * window.devicePixelRatio);
    this.composer.addPass(this.fxaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }



  render(dt: number) {
    this.composer.render();

    // Periodically run garbage collection
    this.gcTimer += dt;
    if (this.gcTimer > this.GC_INTERVAL) {
      this.gcTimer %= this.GC_INTERVAL;
      GraphicsUtils.tracker.update(this.scene);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.sobelPass.uniforms['resolution'].value.x = window.innerWidth * window.devicePixelRatio;
    this.sobelPass.uniforms['resolution'].value.y = window.innerHeight * window.devicePixelRatio;
    this.fxaaPass.uniforms['resolution'].value.x = 1 / (window.innerWidth * window.devicePixelRatio);
    this.fxaaPass.uniforms['resolution'].value.y = 1 / (window.innerHeight * window.devicePixelRatio);
  }

  add(object: THREE.Object3D) {
    //console.trace('Add scene object');
    GraphicsUtils.tracker.register(object);
    this.scene.add(object);
  }

  remove(object: THREE.Object3D) {
    this.scene.remove(object);
  }

  updateDebugInfo() {
    const stats = this.renderer.info;
    Profiler.addInfo('Geometries', stats.memory.geometries);
    Profiler.addInfo('Textures', stats.memory.textures);
    Profiler.addInfo('DrawCalls', stats.render.calls);
    Profiler.addInfo('Triangles', stats.render.triangles);
  }
}
