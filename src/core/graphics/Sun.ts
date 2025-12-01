import * as THREE from 'three';

export class Sun {
    public mesh: THREE.Mesh;
    public light: THREE.DirectionalLight;

    constructor(scene: THREE.Scene) {
        // Create Sun Mesh
        const sunGeo = new THREE.SphereGeometry(30, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        this.mesh = new THREE.Mesh(sunGeo, sunMat);
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
        // Sun Position (Rotates around Z axis for simplicity, rising in East, setting in West)
        // "Small arc near the horizon line"
        // "Too high and a bit too wide"

        const radius = 200;
        const orbitCenterZ = -150; // Keep it well in front (Down River is -Z)

        // Orbit in X-Y plane, but shifted to -Z.
        // "Small arc": Reduce X range significantly.
        // "Near horizon": Reduce Y range significantly.

        const sunX = Math.cos(angle) * radius * 0.4; // Very narrow arc
        // Shift sine wave up by 0.5 to get 2:1 Day/Night ratio
        // sin(angle) + 0.5 > 0 for 240 degrees (Day), < 0 for 120 degrees (Night)
        const sunY = (Math.sin(angle) + 0.5) * radius * 0.3; // Low arc
        const sunZ = orbitCenterZ; // Fixed Z plane

        this.light.position.set(sunX, sunY, sunZ);
        this.light.target.position.set(0, 0, -50); // Target slightly forward
        this.light.target.updateMatrixWorld();

        // Update Sun Mesh Position
        const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
        this.mesh.position.copy(cameraPosition).add(sunDir.multiplyScalar(300)); // Inside skybox (360)

        // Calculate Intensity
        // Max Y is (1 + 0.5) * radius * 0.3 = 1.5 * radius * 0.3
        const maxSunY = 1.5 * radius * 0.3;
        const sunHeight = Math.max(0, sunY / maxSunY);
        const intensity = THREE.MathUtils.lerp(0, 1.5, sunHeight);
        this.light.intensity = intensity;
    }
}
