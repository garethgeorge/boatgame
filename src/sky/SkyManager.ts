import * as THREE from 'three';
import { Skybox } from './Skybox';
import { Sun } from './Sun';
import { Moon } from './Moon';
import { ScreenOverlay } from './ScreenOverlay';
import { Boat } from '../entities/Boat';
import { RiverSystem } from '../world/RiverSystem';

export class SkyManager {
    private scene: THREE.Scene;


    // Components
    private skybox: Skybox;
    private screenOverlay: ScreenOverlay;
    private sun: Sun;
    private moon: Moon;

    // Lighting
    private hemiLight: THREE.HemisphereLight;
    private ambientLight: THREE.AmbientLight;

    // Day/Night Cycle Config
    private readonly cycleDuration: number = 15 * 60; // 15 minutes in seconds
    // Start at High Morning (Angle 30 degrees)
    // 30/360 * 15*60 = 1/12 * 900 = 75 seconds.
    private cycleTime: number = 75;

    constructor(scene: THREE.Scene, container: HTMLElement, rendererDomElement: HTMLCanvasElement) {
        this.scene = scene;

        // Create gradient skybox
        this.skybox = new Skybox(this.scene);

        // Create screen tint overlay
        this.screenOverlay = new ScreenOverlay(container, rendererDomElement);

        // Create Sun
        this.sun = new Sun(this.scene);

        // Create Moon
        this.moon = new Moon(this.scene, this.sun.light);

        // Enhanced lighting setup
        this.setupLighting();

        // Fog setup
        this.scene.fog = new THREE.Fog(0xffffff, 100, 1000);
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

    public getSunPosition(): THREE.Vector3 {
        return this.sun.light.position;
    }

    public update(dt: number, cameraPosition: THREE.Vector3, boat: Boat) {

        const boatZ = boat.meshes[0].position.z;

        // Update Day/Night Cycle
        this.cycleTime += dt;
        if (this.cycleTime > this.cycleDuration) {
            this.cycleTime -= this.cycleDuration;
        }

        const time = this.cycleTime / this.cycleDuration; // 0 to 1
        const angle = time * Math.PI * 2; // 0 to 2PI

        // Update Sun and Moon
        this.sun.update(angle, cameraPosition);
        this.moon.update(angle, cameraPosition);

        // Determine Day/Night Phase
        const dayness = Math.sin(angle);
        this.updateHemiLight(dayness);
        this.updateSkyAndFog(boatZ, dayness, cameraPosition);
    }

    private updateSkyAndFog(boatZ: number, dayness: number, cameraPosition: THREE.Vector3) {

        const biomeSkyGradient = RiverSystem.getInstance().biomeManager.getBiomeSkyGradient(boatZ, dayness);
        const biomeGroundColor = RiverSystem.getInstance().biomeManager.getBiomeGroundColor(boatZ);
        const biomeFogDensity = RiverSystem.getInstance().biomeManager.getBiomeFogDensity(boatZ);

        // Screen overlay
        this.screenOverlay.update(biomeGroundColor, biomeFogDensity * 0.75);

        // Sky gradient
        this.skybox.update(cameraPosition, biomeSkyGradient.top, biomeSkyGradient.bottom);

        // Update Fog Color to match horizon (bottom color)
        if (this.scene.fog) {
            this.scene.fog.color.copy(biomeSkyGradient.bottom);
        }

        // Update Fog Density based on biome
        if (this.scene.fog instanceof THREE.Fog) {
            // Base Fog (Desert/Forest): Far away, subtle
            const baseNear = 100;
            const baseFar = 800;

            // Ice Fog: Close in, "not 100% opaque" (meaning maybe not fully white? or just not too dense?)
            // User said "dramatically reduce... snow storm".
            const iceNear = 0; // Start fog immediately
            const iceFar = 200; // Extreme dense fog (Snow storm) - Reduced from 50

            // Lerp values
            const targetNear = THREE.MathUtils.lerp(baseNear, iceNear, biomeFogDensity);
            const targetFar = THREE.MathUtils.lerp(baseFar, iceFar, biomeFogDensity);

            this.scene.fog.near = targetNear;
            this.scene.fog.far = targetFar;
        }
    }

    private updateHemiLight(dayness: number) {
        // Hemisphere Light (Ambient)
        // Should never drop below 0.8
        // Day: 1.2, Night: 1.2 (at peak)
        // dayness ranges from -1 (Night) to 1 (Day)

        const intensity = 0.8 + 0.4 * Math.abs(dayness);
        this.hemiLight.intensity = intensity;

        // Hemisphere Light Colors
        const daySkyColor = new THREE.Color(0xffffff);
        const dayGroundColor = new THREE.Color(0xaaaaaa);
        const nightSkyColor = new THREE.Color(0x6666aa); // Very bright night blue
        const nightGroundColor = new THREE.Color(0x444466); // Very bright night ground

        // Interpolate based on dayness (-1 to 1) mapped to 0 to 1
        const t = (dayness + 1) / 2;

        this.hemiLight.color.lerpColors(nightSkyColor, daySkyColor, t);
        this.hemiLight.groundColor.lerpColors(nightGroundColor, dayGroundColor, t);
    }
}
