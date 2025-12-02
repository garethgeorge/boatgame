import * as THREE from 'three';

export class Sun {
    public mesh: THREE.Sprite;
    public light: THREE.DirectionalLight;

    constructor(scene: THREE.Scene) {
        // Create Sun Sprite
        const textureLoader = new THREE.TextureLoader();
        const sunTexture = textureLoader.load('assets/sun.png');
        const sunMat = new THREE.SpriteMaterial({ map: sunTexture, color: 0xfdf983 });
        this.mesh = new THREE.Sprite(sunMat);
        this.mesh.scale.set(50, 50, 1); // Adjust scale as needed
        scene.add(this.mesh);

        // Create Sun Light
        this.light = new THREE.DirectionalLight(0xffffff, 1.5);
        this.light.position.set(50, 100, 50);
        this.light.castShadow = true;

        // Shadow settings
        this.light.shadow.mapSize.width = 2048;
        this.light.shadow.mapSize.height = 2048;
        this.light.shadow.camera.near = 0.5;
        this.light.shadow.camera.far = 500;
        this.light.shadow.camera.left = -100;
        this.light.shadow.camera.right = 100;
        this.light.shadow.camera.top = 100;
        this.light.shadow.camera.bottom = -100;
        this.light.shadow.bias = -0.0001;

        scene.add(this.light);
    }

    update(angle: number, cameraPosition: THREE.Vector3) {
        const orbitRadius = 1000;
        const inclination = Math.PI / 6; // 30 degrees inclination

        // Calculate position on a circle in the XZ plane
        const sunAngle = angle;

        const x = Math.cos(sunAngle) * orbitRadius;
        const y = 0;
        const z = -Math.sin(sunAngle) * orbitRadius;

        // Apply inclination (rotate around X-axis)
        // y' = y*cos(theta) - z*sin(theta)
        // z' = y*sin(theta) + z*cos(theta)
        const yInclined = y * Math.cos(inclination) - z * Math.sin(inclination);
        const zInclined = y * Math.sin(inclination) + z * Math.cos(inclination);

        this.light.position.set(x, yInclined, zInclined);
        this.light.target.position.set(0, 0, 0);
        this.light.target.updateMatrixWorld();

        // Update Sun Mesh Position
        const sunDir = new THREE.Vector3(x, yInclined, zInclined).normalize();
        this.mesh.position.copy(cameraPosition).add(sunDir.multiplyScalar(300)); // Inside skybox (360)

        // Calculate Intensity
        const sunHeight = Math.max(0, Math.sin(sunAngle));
        const intensity = THREE.MathUtils.lerp(0, 1.5, sunHeight);
        this.light.intensity = intensity;

        // Rotate the sun sprite
        this.mesh.material.rotation = angle * 4;
    }
}
