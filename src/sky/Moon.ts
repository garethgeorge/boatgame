import * as THREE from 'three';
import { GraphicsUtils } from '../core/GraphicsUtils';

export class Moon {
    public mesh: THREE.Sprite;
    public light: THREE.DirectionalLight;
    public direction: THREE.Vector3 = new THREE.Vector3();

    constructor(scene: THREE.Scene, sunLight: THREE.DirectionalLight) {
        // Create Moon Sprite
        const textureLoader = new THREE.TextureLoader();
        const moonTexture = textureLoader.load('assets/moon.png');
        moonTexture.name = 'Moon Texture';
        const moonMat = new THREE.SpriteMaterial({ map: moonTexture, color: 0xaadaff, name: 'Moon Material' });
        this.mesh = GraphicsUtils.createSprite(moonMat, 'MoonSprite');
        this.mesh.scale.set(35, 35, 1); // Adjust scale to match previous size
        scene.add(this.mesh);

        // Create Moon Light
        this.light = new THREE.DirectionalLight(0x6666ff, 0.0);
        this.light.position.set(-50, 100, -50);
        this.light.castShadow = true;

        // Copy shadow settings from sun
        this.light.shadow.mapSize.width = 2048;
        this.light.shadow.mapSize.height = 2048;
        this.light.shadow.camera = sunLight.shadow.camera.clone();

        scene.add(this.light);
    }

    update(angle: number, cameraPosition: THREE.Vector3) {
        const orbitRadius = 1000;
        const inclination = Math.PI / 8; // 22.5 degrees inclination

        // Calculate position on a circle in the XZ plane
        // We use -angle to make it opposite to the sun if the sun uses angle
        const moonAngle = angle + Math.PI;

        const x = Math.cos(moonAngle) * orbitRadius;
        const y = 0;
        const z = -Math.sin(moonAngle) * orbitRadius;

        // Apply inclination (rotate around X-axis)
        // y' = y*cos(theta) - z*sin(theta)
        // z' = y*sin(theta) + z*cos(theta)
        const yInclined = y * Math.cos(inclination) - z * Math.sin(inclination);
        const zInclined = y * Math.sin(inclination) + z * Math.cos(inclination);

        this.light.position.set(x, yInclined, zInclined);
        this.light.target.position.set(0, 0, 0);
        this.light.target.updateMatrixWorld();

        const moonDir = new THREE.Vector3(x, yInclined, zInclined).normalize();
        this.direction.copy(moonDir);
        this.mesh.position.copy(cameraPosition).add(moonDir.multiplyScalar(300));

        // Update Moon Light Intensity
        // Moon is at its highest point when moonAngle is 0.5 PI (Midnight)
        // moonAngle = angle + PI. 
        // angle = time * 2PI.
        // angle is 0 at Sunrise, PI/2 at Noon, PI at Sunset, 1.5 PI at Midnight.
        // moonAngle is PI at Sunrise, 1.5 PI at Noon, 2PI at Sunset, 2.5 PI at Midnight.
        // sin(moonAngle) at Noon = sin(1.5 PI) = -1.
        // sin(moonAngle) at Midnight = sin(2.5 PI) = 1.
        // So sin(moonAngle) works for moon height!
        const moonHeight = Math.max(0, Math.sin(moonAngle));
        this.light.intensity = THREE.MathUtils.lerp(0, 0.5, moonHeight);
    }
}
