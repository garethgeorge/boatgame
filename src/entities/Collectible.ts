import * as THREE from 'three';
import { Entity, EntityOptions } from './Entity';

export interface CollectibleOptions extends EntityOptions {
    type?: string;
}

interface CollectibleConfig {
    color: number;
    points: number;
}

export class Collectible extends Entity {
    type: string;
    radius: number;
    offset: number;
    config: CollectibleConfig;
    points: number;
    isCollected: boolean;
    active: boolean;
    markForRemoval: boolean;

    constructor(options: CollectibleOptions) {
        super(options);
        this.type = options.type || 'green';
        this.radius = 1.5; // Increased radius for easier collection
        this.offset = Math.random() * 100; // For unique animation timing
        this.isCollected = false;
        this.active = true;
        this.markForRemoval = false;

        const types: { [key: string]: CollectibleConfig } = {
            'green': { color: 0x00ff00, points: 100 },
            'blue': { color: 0x0000ff, points: 250 },
            'red': { color: 0xff0000, points: 500 },
            'gold': { color: 0xffd700, points: 1000 }
        };

        this.config = types[this.type] || types['green'];
        this.points = this.config.points;

        // Re-create mesh if needed (Entity constructor calls createMesh before we set config)
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = this.createMesh();
            this.mesh.position.copy(this.position);
            this.scene.add(this.mesh);
        }
    }

    createMesh(): THREE.Group {
        const group = new THREE.Group();
        const color = this.config ? this.config.color : 0x00ff00;

        // Bottle body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.1, 0.3, 0.4, 8);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.y = 0.7;
        group.add(neck);

        // Message inside (white paper)
        const paperGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
        const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const paper = new THREE.Mesh(paperGeo, paperMat);
        group.add(paper);

        group.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
            }
        });
        return group;
    }

    update(dt: number) {
        if (this.isCollected) {
            // Animation: Float up and fade
            this.mesh.position.y += dt * 5.0; // Float up fast
            this.mesh.rotation.y += dt * 10.0; // Spin fast

            // Fade out
            this.mesh.traverse(child => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh && mesh.material) {
                    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    materials.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity -= dt * 2.0;
                        if (mat.opacity < 0) mat.opacity = 0;
                    });
                }
            });

            // Check if fully faded (using the first child as proxy)
            const firstChild = this.mesh.children[0] as THREE.Mesh;
            if (firstChild && firstChild.material) {
                const mat = Array.isArray(firstChild.material) ? firstChild.material[0] : firstChild.material;
                if (mat.opacity <= 0) {
                    this.markForRemoval = true;
                }
            }
            return;
        }

        this.mesh.rotation.y += dt * 2.0;
        // Float lower in the water (y=0 is water surface roughly)
        // Previous was 0.5 base, let's lower it to 0.0 or -0.2
        this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.2 - 0.1;
    }

    collect() {
        if (this.isCollected) return;
        this.isCollected = true;
        this.active = false; // Disable further collision
    }
}
