import * as THREE from 'three';

export class Moon {
    public mesh: THREE.Mesh;
    public light: THREE.DirectionalLight;

    constructor(scene: THREE.Scene, sunLight: THREE.DirectionalLight) {
        // Create Moon Mesh
        const moonGeo = new THREE.SphereGeometry(20, 32, 32);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
        this.mesh = new THREE.Mesh(moonGeo, moonMat);
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
        const radius = 200;
        const orbitCenterZ = -150; // Keep it well in front (Down River is -Z)

        // Orbit in X-Y plane, but shifted to -Z.
        // "Small arc": Reduce X range significantly.
        // "Near horizon": Reduce Y range significantly.

        const sunX = Math.cos(angle) * radius * 0.4; // Very narrow arc
        // Shift sine wave up by 0.5 to get 2:1 Day/Night ratio
        // sin(angle) + 0.5 > 0 for 240 degrees (Day), < 0 for 120 degrees (Night)
        const sunY = (Math.sin(angle) + 0.5) * radius * 0.3; // Low arc

        const moonX = -sunX;
        const moonY = -sunY;
        const moonZ = orbitCenterZ;

        this.light.position.set(moonX, moonY, moonZ);
        this.light.target.position.set(0, 0, -50);
        this.light.target.updateMatrixWorld();

        const moonDir = new THREE.Vector3(moonX, moonY, moonZ).normalize();
        this.mesh.position.copy(cameraPosition).add(moonDir.multiplyScalar(300));
    }
}
