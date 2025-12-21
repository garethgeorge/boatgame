import { Scene, Vector3, Color3, HemisphericLight, DirectionalLight, MeshBuilder, ShaderMaterial, Effect, Color4 } from '@babylonjs/core';
import { Boat } from '../entities/Boat';
import { RiverSystem } from '../world/RiverSystem';

Effect.ShadersStore["gradientVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUV;
    void main() {
        vUV = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
    }
`;

Effect.ShadersStore["gradientFragmentShader"] = `
    precision highp float;
    varying vec2 vUV;
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    void main() {
        gl_FragColor = vec4(mix(bottomColor, topColor, vUV.y), 1.0);
    }
`;

export class SkyManager {
    private scene: Scene;
    private sunLight: DirectionalLight;
    private ambientLight: HemisphericLight;
    private skySphere: any; // Mesh
    private skyMaterial: ShaderMaterial;

    private sunPosition: Vector3 = new Vector3(0, 50, 0);

    private readonly cycleDuration: number = 15 * 60; // 15 minutes
    private cycleTime: number = 75; // Start at morning

    constructor(scene: Scene, container: HTMLElement, canvas: HTMLCanvasElement) {
        this.scene = scene;

        // Lights
        this.ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
        this.ambientLight.intensity = 0.8;

        this.sunLight = new DirectionalLight("sun", new Vector3(-1, -1, -1), scene);
        this.sunLight.intensity = 1.0;

        // Shadows are set up in GraphicsEngine if ShadowGenerator is there, 
        // but we need to ensure the light is capable.
        this.sunLight.shadowMinZ = 1;
        this.sunLight.shadowMaxZ = 100;

        // Sky Sphere with Gradient Shader
        this.skySphere = MeshBuilder.CreateSphere("sky", { diameter: 900, segments: 16 }, scene);
        this.skySphere.infiniteDistance = true; // Stay with camera

        this.skyMaterial = new ShaderMaterial("skyGradient", scene, {
            vertex: "gradient",
            fragment: "gradient",
        }, {
            attributes: ["position", "uv"],
            uniforms: ["worldViewProjection", "topColor", "bottomColor"]
        });

        this.skyMaterial.backFaceCulling = false;
        this.skySphere.material = this.skyMaterial;

        // Initial fog
        this.scene.fogMode = Scene.FOGMODE_LINEAR;
    }

    public getSunPosition(): Vector3 {
        return this.sunPosition;
    }

    public update(dt: number, cameraPosition: Vector3, boat: Boat) {
        if (!boat.meshes.length) return;
        const boatZ = boat.meshes[0].position.z;

        // Update Day/Night Cycle
        this.cycleTime += dt;
        if (this.cycleTime > this.cycleDuration) {
            this.cycleTime -= this.cycleDuration;
        }

        const timeRatio = this.cycleTime / this.cycleDuration;
        const angle = timeRatio * Math.PI * 2;

        // Sun Position (Simple circular orbit)
        const radius = 100;
        this.sunPosition.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0 // Relative Z? Should probably rotate around X axis for day/night
        );

        // Actually sun rises East set West usually, or rotates around World Center.
        // Let's match previous logic:
        // x = cos(time) * radius
        // y = max(20, sin(time)*radius) -> This was clamped high before?
        // Let's use standard orbit:
        this.sunPosition.x = Math.cos(angle) * radius;
        this.sunPosition.y = Math.sin(angle) * radius;
        this.sunPosition.z = boatZ; // Move with boat

        this.sunLight.position.copyFrom(this.sunPosition.add(new Vector3(0, 0, 20))); // Slight offset
        this.sunLight.setDirectionToTarget(new Vector3(0, 0, boatZ));

        // Dayness: -1 to 1 (sin of angle)
        const dayness = Math.sin(angle);

        // Get Biome Colors
        const biomeManager = RiverSystem.getInstance().biomeManager;
        const skyColors = biomeManager.getBiomeSkyGradient(boatZ, dayness);
        const fogInfo = biomeManager.getBiomeFogRange(boatZ); // near, far
        // Fog Color usually matches sky bottom

        // Update Sky Material
        this.skyMaterial.setColor3("topColor", skyColors.top);
        this.skyMaterial.setColor3("bottomColor", skyColors.bottom);

        // Update Fog
        this.scene.fogStart = fogInfo.near;
        this.scene.fogEnd = fogInfo.far;
        this.scene.fogColor = new Color3(skyColors.bottom.r, skyColors.bottom.g, skyColors.bottom.b);

        // Update Lights
        // Intensity based on dayness (0 at night, 1 at day)
        // Clamp dayness for intensity 0..1
        const sunIntensity = Math.max(0, dayness);
        this.sunLight.intensity = sunIntensity;

        // Ambient Light
        // Night should be blueish/dark, Day white/bright
        // Biome manager might provide this, or we lerp manually

        const dayColor = new Color3(1, 1, 1);
        const nightColor = new Color3(0.1, 0.1, 0.3);
        const ambientColor = Color3.Lerp(nightColor, dayColor, (dayness + 1) / 2);

        this.ambientLight.diffuse = ambientColor;
        this.ambientLight.groundColor = new Color3(0.1, 0.1, 0.1); // Ground always dark
    }
}
