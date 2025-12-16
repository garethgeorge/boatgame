import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { CollectedBottles } from '../CollectedBottles';

export class Pier extends Entity {

    public static readonly MIN_LENGTH_WITH_DEPOT = 10;

    // Cached materials and geometry
    private static deckMaterial: THREE.MeshToonMaterial | null = null;
    private static pileMesh: THREE.Mesh | null = null;

    public collectedBottles: CollectedBottles | null = null;

    private static getDeckMaterial(): THREE.MeshToonMaterial {
        if (Pier.deckMaterial) return Pier.deckMaterial;

        // Load and create deck material with texture
        const textureLoader = new THREE.TextureLoader();
        const deckTexture = textureLoader.load('assets/deck-plank-texture.png');
        deckTexture.wrapS = THREE.RepeatWrapping;
        deckTexture.wrapT = THREE.RepeatWrapping;
        deckTexture.repeat.set(4, 1);

        const deckMaterial = new THREE.MeshToonMaterial({ map: deckTexture });
        deckMaterial.color.set(0xd48e43);

        Pier.deckMaterial = deckMaterial;

        return Pier.deckMaterial
    }

    private static getPileMesh(): THREE.Mesh {
        if (Pier.pileMesh) return Pier.pileMesh;

        // Load and create pile material with texture
        const textureLoader = new THREE.TextureLoader();
        const pileTexture = textureLoader.load('assets/wood-piling-texture.png');
        pileTexture.wrapS = THREE.RepeatWrapping;
        pileTexture.wrapT = THREE.RepeatWrapping;
        pileTexture.repeat.set(0.25, 0.25);

        const pileMaterial = new THREE.MeshToonMaterial({ map: pileTexture });
        pileMaterial.color.set(0x8B4513);

        // Create pile geometry and mesh
        const pileGeometry = new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8);
        Pier.pileMesh = new THREE.Mesh(pileGeometry, pileMaterial);

        return Pier.pileMesh;
    }

    private static readonly DOCK_LENGTH: number = 4.0;
    private static readonly DOCK_DEPTH: number = 3.0;
    private static readonly DOCK_END_CAP_LENGTH: number = 2.0;
    public static readonly MIN_LENGTH_FOR_DOCK: number = this.DOCK_LENGTH + this.DOCK_END_CAP_LENGTH + 2.0;

    constructor(x: number, y: number, length: number, angle: number, physicsEngine: PhysicsEngine, hasDepot: boolean = false, dockSide: 'left' | 'right' | null = null) {
        super();

        const width = hasDepot ? 6 : 4;

        // Visuals
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Physics Body
        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: angle // Set rotation
        });
        this.physicsBodies.push(physicsBody);
        physicsBody.setUserData({ type: 'obstacle', subtype: 'pier', entity: this });

        if (dockSide && length > Pier.MIN_LENGTH_FOR_DOCK) {
            this.buildDockedPier(length, width, dockSide, physicsBody, mesh);
        } else {
            this.buildStandardPier(length, width, physicsBody, mesh);
        }

        // Add depot if requested
        if (hasDepot) {
            const depot = Decorations.getDepot();
            depot.rotation.y = -Math.PI / 2;
            // Position at the start of the pier (shore end) at -length/2
            depot.position.set(-length / 2 + 3, 1.5, 0);
            mesh.add(depot);

            // Add CollectedBottles
            const collectedBottles = new CollectedBottles();
            // Center the collection roughly
            collectedBottles.mesh.position.set(-length / 2 + 8, 2.1, 2.0);
            collectedBottles.mesh.rotation.y = Math.PI / 2;
            mesh.add(collectedBottles.mesh);
            this.collectedBottles = collectedBottles;
        }

        // Apply initial rotation
        mesh.rotation.y = -angle;
        mesh.position.set(x, 0, y);
    }

    private buildStandardPier(length: number, width: number, physicsBody: planck.Body, mesh: THREE.Group) {
        // Length is along X (extending from bank). Width is along Y (thickness).
        physicsBody.createFixture({
            shape: planck.Box(length / 2, width / 2),
            friction: 0.5
        });

        // Deck
        const deckGeo = new THREE.BoxGeometry(length, 0.5, width);
        this.disposer.add(deckGeo);
        const deck = new THREE.Mesh(deckGeo, Pier.getDeckMaterial());
        deck.position.y = 1.5; // Raised up
        mesh.add(deck);

        // Piles
        const numPiles = Math.floor(length / 3);
        for (let i = 0; i <= numPiles; i++) {
            const xPos = -length / 2 + (length / numPiles) * i;
            const pile1 = Pier.getPileMesh().clone();
            pile1.position.set(xPos, 0, -width / 2);
            mesh.add(pile1);
            const pile2 = Pier.getPileMesh().clone();
            pile2.position.set(xPos, 0, width / 2);
            mesh.add(pile2);
        }
    }

    private buildDockedPier(length: number, width: number, dockSide: 'left' | 'right', physicsBody: planck.Body, mesh: THREE.Group) {
        // Construct pier in 3 parts: Base, Middle (dock), End
        const tipX = length / 2;
        const startX = -length / 2;

        const dockEndX = tipX - Pier.DOCK_END_CAP_LENGTH;
        const dockStartX = dockEndX - Pier.DOCK_LENGTH;

        // 1. Base Segment
        const baseLen = dockStartX - startX;
        const baseCenterX = startX + baseLen / 2;
        this.addSegment(baseCenterX, baseLen, 0, width, physicsBody, mesh);

        // 2. Middle Segment (With dock)
        const sideSign = (dockSide === 'left') ? 1 : -1;
        const middleWidth = Math.max(1.0, width - Pier.DOCK_DEPTH);
        const middleCenterY = -sideSign * (Pier.DOCK_DEPTH / 2);
        const middleCenterX = dockStartX + Pier.DOCK_LENGTH / 2;

        this.addSegment(middleCenterX, Pier.DOCK_LENGTH, middleCenterY, middleWidth, physicsBody, mesh);

        // Add Sensor for Dock Notch
        // Positioned opposite to the solid middle segment
        const sensorCenterY = sideSign * ((width - Pier.DOCK_DEPTH) / 2);
        const sensorShape = planck.Box(Pier.DOCK_LENGTH / 2, Pier.DOCK_DEPTH / 2, planck.Vec2(middleCenterX, sensorCenterY));
        const sensorFixture = physicsBody.createFixture({
            shape: sensorShape,
            isSensor: true
        });
        sensorFixture.setUserData({ type: 'sensor' });

        // 3. End Cap
        const endLen = tipX - dockEndX;
        const endCenterX = dockEndX + endLen / 2;
        this.addSegment(endCenterX, endLen, 0, width, physicsBody, mesh);

        // Add Piles
        this.addPilesForSegment(baseCenterX, baseLen, 0, width, length, mesh);
        this.addPilesForSegment(middleCenterX, Pier.DOCK_LENGTH, middleCenterY, middleWidth, length, mesh);
        this.addPilesForSegment(endCenterX, endLen, 0, width, length, mesh);
    }

    private addSegment(centerX: number, segmentLength: number, centerY: number, segmentWidth: number, physicsBody: planck.Body, mesh: THREE.Group) {
        // Physics Fixture
        physicsBody.createFixture({
            shape: planck.Box(segmentLength / 2, segmentWidth / 2, planck.Vec2(centerX, centerY)),
            friction: 0.5
        });

        // Visual Mesh
        const segmentGeo = new THREE.BoxGeometry(segmentLength, 0.5, segmentWidth);
        this.disposer.add(segmentGeo);
        const segmentMesh = new THREE.Mesh(segmentGeo, Pier.getDeckMaterial());

        // Position visual
        segmentMesh.position.set(centerX, 1.5, centerY);
        mesh.add(segmentMesh);
    }

    private addPilesForSegment(centerX: number, len: number, centerY: number, width: number, totalLength: number, mesh: THREE.Group) {
        const numPiles = Math.max(1, Math.floor(len / 3));
        for (let i = 0; i <= numPiles; i++) {
            // Local x within segment
            const xRel = -len / 2 + (len / numPiles) * i;
            const pileX = centerX + xRel;

            if (Math.abs(pileX) > totalLength / 2 - 0.2) continue; // Skip if too close to very edge

            // Add two piles at +/- width/2 relative to the segments centerY
            const y1 = centerY - width / 2 + 0.2; // Indent slightly
            const y2 = centerY + width / 2 - 0.2;

            const pile1 = Pier.getPileMesh().clone();
            pile1.position.set(pileX, 0, y1);
            mesh.add(pile1);

            const pile2 = Pier.getPileMesh().clone();
            pile2.position.set(pileX, 0, y2);
            mesh.add(pile2);
        }
    }

    update(dt: number) {
        this.collectedBottles?.update(dt);
    }
}
