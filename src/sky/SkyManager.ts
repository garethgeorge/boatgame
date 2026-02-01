import * as THREE from 'three';
import { Skybox } from './Skybox';
import { Sun } from './Sun';
import { Moon } from './Moon';
import { ScreenOverlay } from './ScreenOverlay';
import { Boat } from '../entities/Boat';
import { RiverSystem } from '../world/RiverSystem';
import { DesignerSettings } from '../core/DesignerSettings';
import { DebugSettings } from '../core/DebugSettings';

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

    // Scratch colors for zero-allocation blending
    private scratchColor1 = new THREE.Color();
    private scratchColor2 = new THREE.Color();
    private static readonly MOON_COLOR = 0xb0c0d0;

    // Persistent color objects for zero-allocation blending
    private interpolatedLightTop = new THREE.Color();
    private interpolatedLightMid = new THREE.Color();
    private interpolatedLightBot = new THREE.Color();
    private interpolatedDarkTop = new THREE.Color();
    private interpolatedDarkBot = new THREE.Color();
    private moonColor = new THREE.Color(SkyManager.MOON_COLOR);

    // Day/Night Cycle Config
    public isCyclePaused: boolean = false;
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
        if (DesignerSettings.isDesignerMode)
            this.scene.fog = new THREE.Fog(0xffffff, 100, 5000);
        else
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

    public setCycleTime(normalizedTime: number) {
        this.cycleTime = normalizedTime * this.cycleDuration;
    }

    public getCycleTime(): number {
        return this.cycleTime / this.cycleDuration;
    }

    public update(dt: number, cameraPosition: THREE.Vector3, boat: Boat) {

        const boatZ = boat.meshes[0].position.z;

        // Update Day/Night Cycle
        if (!this.isCyclePaused) {
            this.cycleTime += dt * DebugSettings.cycleSpeedMultiplier;
            if (this.cycleTime > this.cycleDuration) {
                this.cycleTime -= this.cycleDuration;
            }
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
        const skyBiome = RiverSystem.getInstance().biomeManager.getBiomeSkyBiome(boatZ);
        const biomeFogDensity = RiverSystem.getInstance().biomeManager.getBiomeFogDensity(boatZ);
        const biomeScreenTint = RiverSystem.getInstance().biomeManager.getBiomeScreenTint(boatZ);

        // Height-based scaling logic
        const MIN_HEIGHT = 50;
        const MAX_HEIGHT = 250;
        const heightFactor = Math.min(1.0, Math.max(0.0, (cameraPosition.y - MIN_HEIGHT) / (MAX_HEIGHT - MIN_HEIGHT)));

        // Screen overlay: Reduce desaturation and tint as we go higher
        const overlayIntensity = 1.0 - heightFactor * 0.8;
        this.screenOverlay.update(biomeScreenTint, biomeFogDensity * 0.75 * overlayIntensity);

        // Sun intensity: 1 at Noon, 0 at Sunset/Rise, 0 at Night
        const sunIntensity = Math.max(0, dayness);

        // There are 3 daytime sky colors, bottom, mid, top
        // They are interpolated between noon and sunset values
        const t = 1 - sunIntensity;
        this.interpolatedLightTop.set(skyBiome.noon.top).lerp(this.scratchColor1.set(skyBiome.sunset.top), t);
        this.interpolatedLightBot.set(skyBiome.noon.bottom).lerp(this.scratchColor1.set(skyBiome.sunset.bottom), t);

        const getMid = (c: any, color: THREE.Color) => {
            if (c.mid !== undefined) return color.set(c.mid);
            return color.set(c.top).lerp(this.scratchColor2.set(c.bottom), 0.5);
        };

        const midNoon = getMid(skyBiome.noon, this.scratchColor1);
        const midSunset = getMid(skyBiome.sunset, this.scratchColor2);
        this.interpolatedLightMid.lerpColors(midNoon, midSunset, t);

        // There are two night colors
        this.interpolatedDarkTop.set(skyBiome.night.top);
        this.interpolatedDarkBot.set(skyBiome.night.bottom);

        // Update Skybox
        this.skybox.update(
            cameraPosition,
            this.sun.direction,
            this.moon.direction,
            {
                lightTop: this.interpolatedLightTop,
                lightMid: this.interpolatedLightMid,
                lightBot: this.interpolatedLightBot,
                darkTop: this.interpolatedDarkTop,
                darkBot: this.interpolatedDarkBot,
                moonColor: this.moonColor
            },
            skyBiome.haze,
            dayness
        );

        // Update Fog Color to match horizon (Light side bottom color if sun is up,
        // else Night side bottom)
        if (this.scene.fog) {
            if (dayness < -0.5) {
                this.scene.fog.color.copy(this.interpolatedDarkBot);
            } else if (dayness > 0.5) {
                this.scene.fog.color.copy(this.interpolatedLightBot);
            } else {
                this.scene.fog.color.set(this.interpolatedDarkBot).lerp(this.interpolatedLightBot, dayness + 0.5);
            }
        }

        // Update Fog Density based on biome and height
        if (this.scene.fog instanceof THREE.Fog) {
            const fogRange = RiverSystem.getInstance().biomeManager.getBiomeFogRange(boatZ);

            // Push fog further away as we go higher
            // At MAX_HEIGHT, push 'far' to something very large and 'near' as well
            const fogPushFactor = heightFactor * 10.0;
            this.scene.fog.near = fogRange.near + (fogRange.far - fogRange.near) * fogPushFactor;
            this.scene.fog.far = fogRange.far * (1.0 + fogPushFactor);
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
