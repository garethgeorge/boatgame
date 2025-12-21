import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class Iceberg extends Entity {
    private animationMixer?: THREE.AnimationMixer;

    constructor(x: number, y: number, radius: number, hasBear: boolean, physicsEngine: PhysicsEngine) {
        super();

        // Physics: Dynamic but heavy (drifting ice)
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0, // Water resistance
            angularDamping: 1.0,
            angle: Math.random() * Math.PI * 2
        });
        this.physicsBodies.push(physicsBody);

        // Polygon shape for physics (approximate with circle for now for stability, or box?)
        // Circle is best for drifting objects to avoid getting stuck.
        physicsBody.createFixture({
            shape: planck.Circle(radius * 0.8),
            density: 10.0, // Heavy ice (5x increase)
            friction: 0.1, // Slippery
            restitution: 0.2
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'iceberg', entity: this });

        // Graphics: Floating Jagged Ice Sheet
        // Use ExtrudeGeometry for a flat top and jagged perimeter
        const shape = new THREE.Shape();
        const numPoints = 12;
        const angleStep = (Math.PI * 2) / numPoints;

        // Generate random jagged points
        for (let i = 0; i < numPoints; i++) {
            const angle = i * angleStep;
            // Vary radius: 0.7 to 1.3 of base radius
            const r = radius * (0.7 + Math.random() * 0.6);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r; // Shape is in XY plane initially

            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        const extrudeSettings = {
            steps: 1,
            depth: 1.5, // Thickness of the ice sheet
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.1,
            bevelSegments: 1
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        GraphicsUtils.tracker.register(geometry);

        // Center the geometry
        geometry.center();

        const material = new THREE.MeshToonMaterial({
            color: 0xE0F6FF, // Ice Blue
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        GraphicsUtils.tracker.register(material);
        // @ts-ignore
        material.flatShading = true; // Works in runtime
        material.needsUpdate = true;

        const mesh = new THREE.Group(); // Parent group handles Y-rotation (yaw) from physics
        this.meshes.push(mesh);

        const innerMesh = new THREE.Mesh(geometry, material);

        // Rotate inner mesh to lie flat on water
        innerMesh.rotation.x = -Math.PI / 2;

        // Position inner mesh
        innerMesh.position.y = 0.2;

        mesh.add(innerMesh);

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Add polar bear decoration
        if (hasBear) {
            const polarBearData = Decorations.getPolarBear();
            if (polarBearData) {
                const { model, animations } = polarBearData;

                // Position the polar bear on top of the iceberg
                model.position.y = 1.0; // Place on top of the ice sheet
                model.scale.set(3.0, 3.0, 3.0);
                model.rotation.y = Math.random() * Math.PI * 2; // Random rotation

                mesh.add(model);

                // Play animation if available
                if (animations.length > 0) {
                    this.animationMixer = new THREE.AnimationMixer(model);
                    const action = this.animationMixer.clipAction(animations[0]);
                    action.time = Math.random() * action.getClip().duration;
                    action.play();
                }
            }
        }
    }

    wasHitByPlayer() {
        // Solid
    }

    update(dt: number) {
        // Update animation mixer if present
        if (this.animationMixer) {
            this.animationMixer.update(dt);
        }
        // Drifts naturally
    }
}
