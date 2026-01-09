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
    private cycleTime: number = 225; // 30 degrees of 15 min cycle = 1/12 * 900 = 75? Wait.
    // 360 degrees = 900 seconds. 
    // Noon is Angle PI/2 (90 degrees). 90/360 * 900 = 225 seconds.
    // Sunset is Angle PI (180 degrees). 180/360 * 900 = 450 seconds.
    // Midnight is Angle 1.5 PI (270 degrees). 675 seconds.
    // Sunrise is Angle 0/2PI. 
    // "High Morning" (30 deg above horizon) = 30 degrees. 30/360 * 900 = 75 seconds.
    // Wait, let's check the angle calculation: angle = time * Math.PI * 2.
    // Time 0 -> Angle 0 (Sunrise). 
    // Time 0.25 -> Angle PI/2 (Noon).
    // Time 0.5 -> Angle PI (Sunset).
    // Time 0.75 -> Angle 1.5 PI (Midnight).
    // So 30 degrees is 30/360 = 1/12 of the cycle.
    // 1/12 * 900 = 75 seconds.

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
        const biomeFogDensity = RiverSystem.getInstance().biomeManager.getBiomeFogDensity(boatZ);
        const biomeScreenTint = RiverSystem.getInstance().biomeManager.getBiomeScreenTint(boatZ);

        // Screen overlay
        this.screenOverlay.update(biomeScreenTint, biomeFogDensity * 0.75);

        // Sky gradient
        this.skybox.update(cameraPosition, biomeSkyGradient.top, biomeSkyGradient.bottom);

        // Update Fog Color to match horizon (bottom color)
        if (this.scene.fog) {
            this.scene.fog.color.copy(biomeSkyGradient.bottom);
        }

        // Update Fog Density based on biome
        if (this.scene.fog instanceof THREE.Fog) {
            const fogRange = RiverSystem.getInstance().biomeManager.getBiomeFogRange(boatZ);
            this.scene.fog.near = fogRange.near;
            this.scene.fog.far = fogRange.far;
        }
    }

    private updateHemiLight(dayness: number) {
        // Hemisphere Light (Ambient)
        // Should never drop below 0.8
        // Day: 1.2, Night: 1.2 (at peak)
        // dayness ranges from -1 (Night) to 1 (Day)
        // Intensity: Day: 1.2, Night: 0.8
        const intensity = 1.0 + 0.2 * dayness;
        this.hemiLight.intensity = intensity;
        this.ambientLight.intensity = 0.2;

        // Hemisphere Light Colors
        const daySkyColor = new THREE.Color(0xffffff);
        const dayGroundColor = new THREE.Color(0xaaaaaa);
        const sunsetSkyColor = new THREE.Color(0x967BB6); // Sunset Purple
        const sunsetGroundColor = new THREE.Color(0xFF9966); // Sunset Orange
        const nightSkyColor = new THREE.Color(0x1A1A3A); // Dark Night Blue
        const nightGroundColor = new THREE.Color(0x2D2D44); // Dark Night Ground

        // Interpolate based on dayness (-1 to 1) using same logic as biomes
        if (dayness > 0) {
            // Lerp between Sunset (0) and Noon (1)
            this.hemiLight.color.lerpColors(sunsetSkyColor, daySkyColor, dayness);
            this.hemiLight.groundColor.lerpColors(sunsetGroundColor, dayGroundColor, dayness);
        } else {
            // Lerp between Sunset (0) and Night (-1)
            // dayness is -1 to 0, so -dayness is 0 to 1
            this.hemiLight.color.lerpColors(sunsetSkyColor, nightSkyColor, -dayness);
            this.hemiLight.groundColor.lerpColors(sunsetGroundColor, nightGroundColor, -dayness);
        }
    }
}
