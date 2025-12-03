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

    // State
    private currentBiomeWeights: { desert: number, forest: number, ice: number } = { desert: 1, forest: 0, ice: 0 };
    private targetBiomeWeights: { desert: number, forest: number, ice: number } = { desert: 1, forest: 0, ice: 0 };

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

    public updateBiome(biomeType: string) {
        // Set target weights based on biome type
        this.targetBiomeWeights = { desert: 0, forest: 0, ice: 0 };
        if (biomeType === 'desert') {
            this.targetBiomeWeights.desert = 1;
        } else if (biomeType === 'forest') {
            this.targetBiomeWeights.forest = 1;
        } else if (biomeType === 'ice') {
            this.targetBiomeWeights.ice = 1;
        }
    }

    public getSunPosition(): THREE.Vector3 {
        return this.sun.light.position;
    }

    public update(dt: number, cameraPosition: THREE.Vector3, boat: Boat) {
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
        // sin(angle) > 0 is Day (Sun is up), < 0 is Night
        const dayness = Math.sin(angle);

        this.updateHemiLight(dayness);

        // Update Biome based on boat position
        if (boat && boat.meshes.length > 0) {
            const z = boat.meshes[0].position.z;
            const biomeType = RiverSystem.getInstance().getBiomeType(z);
            this.updateBiome(biomeType);
        }

        // Smoothly interpolate biome weights
        const lerpSpeed = 1.0 * dt; // Adjust speed as needed
        this.currentBiomeWeights.desert = THREE.MathUtils.lerp(this.currentBiomeWeights.desert, this.targetBiomeWeights.desert, lerpSpeed);
        this.currentBiomeWeights.forest = THREE.MathUtils.lerp(this.currentBiomeWeights.forest, this.targetBiomeWeights.forest, lerpSpeed);
        this.currentBiomeWeights.ice = THREE.MathUtils.lerp(this.currentBiomeWeights.ice, this.targetBiomeWeights.ice, lerpSpeed);

        this.updateSkyAndFog(dayness, cameraPosition);
        this.screenOverlay.update(this.currentBiomeWeights);
    }

    private updateSkyAndFog(dayness: number, cameraPosition: THREE.Vector3) {
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

        // Transition threshold (approx 20 degrees / 200 radius = 0.1)
        const transitionThreshold = 0.1;

        if (dayness > 0) {
            // Day
            if (dayness < transitionThreshold) {
                // Sunrise / Sunset transition
                const t = dayness / transitionThreshold;
                currentTop = sunsetTop.clone().lerp(dayTop, t);
                currentBot = sunsetBot.clone().lerp(dayBot, t);
            } else {
                currentTop = dayTop;
                currentBot = dayBot;
            }
        } else {
            // Night
            if (dayness > -transitionThreshold) {
                // Twilight
                const t = -dayness / transitionThreshold;
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
        if (dayness > 0) {
            // Forest Influence
            currentTop.lerp(forestTopMod, this.currentBiomeWeights.forest * 0.6);
            currentBot.lerp(forestBotMod, this.currentBiomeWeights.forest * 0.6);

            // Ice Influence (Cooler, whiter)
            const iceTopMod = new THREE.Color(0xddeeff); // Pale Ice Blue
            const iceBotMod = new THREE.Color(0xffffff); // White
            currentTop.lerp(iceTopMod, this.currentBiomeWeights.ice * 0.8);
            currentBot.lerp(iceBotMod, this.currentBiomeWeights.ice * 0.8);
        }

        this.skybox.update(cameraPosition, currentTop, currentBot);

        // Update Fog Color to match horizon (bottom color)
        if (this.scene.fog) {
            this.scene.fog.color.copy(currentBot);
        }

        // Update Fog Density based on biome
        if (this.scene.fog instanceof THREE.Fog) {
            // Base Fog (Desert/Forest): Far away, subtle
            const baseNear = 100;
            const baseFar = 800;

            // Ice Fog: Close in, "not 100% opaque" (meaning maybe not fully white? or just not too dense?)
            // User said "dramatically reduce... snow storm".
            const iceNear = 0; // Start fog immediately
            const iceFar = 20; // Extreme dense fog (Snow storm) - Reduced from 50

            // Lerp values
            const targetNear = THREE.MathUtils.lerp(baseNear, iceNear, this.currentBiomeWeights.ice);
            const targetFar = THREE.MathUtils.lerp(baseFar, iceFar, this.currentBiomeWeights.ice);

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
