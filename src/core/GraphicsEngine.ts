import {
  Engine,
  Scene,
  Vector3,
  Color4,
  UniversalCamera,
  WebGPUEngine,
  TransformNode,
  AbstractMesh,
  SceneLoader,
  Effect,
  PostProcess,
  DefaultRenderingPipeline,
  ImageProcessingConfiguration,
  ShadowGenerator
} from '@babylonjs/core';
import '@babylonjs/loaders'; // Enable GLTF loader
import { Profiler } from './Profiler';
import { SobelShader } from '../shaders/SobelShader';

export class GraphicsEngine {
  engine: Engine | WebGPUEngine;
  scene!: Scene;
  camera!: UniversalCamera;

  shadowGenerator: ShadowGenerator | null = null;
  private pipeline: DefaultRenderingPipeline | null = null;

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.id = 'gameCanvas';
    container.appendChild(canvas);

    this.engine = new WebGPUEngine(canvas, {
      powerPreference: 'high-performance',
      antialias: true,
      stencil: true
    });

    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  async init() {
    await (this.engine as WebGPUEngine).initAsync();

    this.engine.setHardwareScalingLevel(1.0 / window.devicePixelRatio);

    this.scene = new Scene(this.engine);
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new Color4(0.5, 0.8, 1, 1);

    // Camera
    this.camera = new UniversalCamera("camera", new Vector3(0, 10, -10), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.fov = 60 * (Math.PI / 180);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;

    // Rendering Pipeline (Tone Mapping, FXAA, Bloom, etc.)
    this.pipeline = new DefaultRenderingPipeline(
      "defaultPipeline", // The name of the pipeline
      true, // Sharpen Enabled? (False usually) - Setting true for HDR support implies passing true? No, second arg is 'hdr'.
      this.scene,
      [this.camera]
    );

    // FXAA
    this.pipeline.fxaaEnabled = true;

    // Tone Mapping (ACES Filmic equivalent)
    this.pipeline.imageProcessingEnabled = true;
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.pipeline.imageProcessing.exposure = 1.0;

    // MSAA (Multisample Anti-Aliasing) - 4x
    this.pipeline.samples = 4;

    // Sobel Post Process (Custom)
    Effect.ShadersStore["sobelPixelShader"] = SobelShader.fragmentSource;
    const sobel = new PostProcess("sobel", "sobel", ["resolution"], null, 1.0, this.camera);
    sobel.onApply = (effect) => {
      effect.setFloat2("resolution", this.engine.getRenderWidth(), this.engine.getRenderHeight());
    };
  }

  render(dt: number) {
    this.scene.render();
  }

  onWindowResize() {
    if (this.engine) {
      this.engine.resize();
    }
  }

  add(object: TransformNode | AbstractMesh) {
    object.setEnabled(true);
  }

  remove(object: TransformNode | AbstractMesh) {
    object.setEnabled(false);
  }

  updateDebugInfo() {
    if (!this.scene) return;

    // Core Engine Stats
    // Bubbling up interesting capabilities or active usage
    // Accessing instrumentation if available, or just standard counters
    // NOTE: Instrumentation requires enabling in Scene options or specifically adding it.

    // For now, let's just grab what we can easily.
    // Profiler.addInfo('FPS', this.engine.getFps().toFixed(0));
    // Profiler.addInfo('Draw Calls', this.scene.getEngine().getDrawCallsPerfCounter?.()?.current || 0);

    // If we want detailed stats we likely need "SceneInstrumentation"
    // But sticking to the requested 'updateDebugInfo' stub completion:
    // We'll leave it prepared for the Profiler when that is migrated/linked.
  }
}
