import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { CollectedBottles } from '../CollectedBottles';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class Pier extends Entity {

    public static readonly MIN_LENGTH_WITH_DEPOT = 10;

    // Cached materials and geometry
    private static deckMaterial: THREE.MeshToonMaterial | null = null;
    private static pileMesh: THREE.Mesh | null = null;
    private static signMaterials: THREE.Material[] | null = null;

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
        deckMaterial.name = 'Pier - Deck Material';
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

        const pileMaterial = new THREE.MeshToonMaterial({ map: pileTexture, name: 'Pier - Pile Material' });
        pileMaterial.color.set(0x8B4513);

        // Create pile geometry and mesh
        const pileGeometry = new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8);
        pileGeometry.name = 'Pier - Pile Geometry';
        Pier.pileMesh = GraphicsUtils.createMesh(pileGeometry, pileMaterial, 'PierPile');

        return Pier.pileMesh;
    }

    private static getSignMaterials(): THREE.Material[] {
        if (Pier.signMaterials) return Pier.signMaterials;

        const textureLoader = new THREE.TextureLoader();

        // Load the texture once and clone it for the back
        const signFrontTexture = textureLoader.load('assets/dock-sign.png');
        const signBackTexture = signFrontTexture.clone();

        // Top Half for Front
        signFrontTexture.repeat.set(1, 0.5);
        signFrontTexture.offset.set(0, 0.5);

        // Bottom Half for Back
        signBackTexture.repeat.set(1, 0.5);
        signBackTexture.offset.set(0, 0);

        const frontMat = new THREE.MeshToonMaterial({
            name: 'Pier - Sign Front Material',
            map: signFrontTexture,
            transparent: true,
        });

        const backMat = new THREE.MeshToonMaterial({
            name: 'Pier - Sign Back Material',
            map: signBackTexture,
            transparent: true,
        });

        const sideMat = new THREE.MeshToonMaterial({
            name: 'Pier - Sign Side Material',
            transparent: true,
            opacity: 0
        });

        // BoxGeometry material index order: x+, x-, y+, y-, z+, z-
        // We want Front to be z+ (index 4) and Back to be z- (index 5)
        Pier.signMaterials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];

        return Pier.signMaterials;
    }

    private static readonly DOCK_LENGTH: number = 4.0;
    private static readonly DOCK_DEPTH: number = 3.0;
    public static readonly MIN_LENGTH_FOR_DOCK: number = this.DOCK_LENGTH + 2.0;

    constructor(x: number, y: number, length: number, angle: number, physicsEngine: PhysicsEngine, hasDepot: boolean = false) {
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

        if (hasDepot && length > Pier.MIN_LENGTH_FOR_DOCK) {
            this.buildDockedPier(length, width, physicsBody, mesh);
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
        deckGeo.name = 'Pier - Standard Deck Geometry';
        const deck = GraphicsUtils.createMesh(deckGeo, Pier.getDeckMaterial(), 'PierDeck');
        deck.position.y = 1.5; // Raised up
        mesh.add(deck);

        // Piles
        const numPiles = Math.floor(length / 3);
        for (let i = 0; i <= numPiles; i++) {
            const xPos = -length / 2 + (length / numPiles) * i;
            const pile1 = GraphicsUtils.cloneObject(Pier.getPileMesh());
            pile1.position.set(xPos, 0, -width / 2);
            mesh.add(pile1);
            const pile2 = GraphicsUtils.cloneObject(Pier.getPileMesh());
            pile2.position.set(xPos, 0, width / 2);
            mesh.add(pile2);
        }
    }

    private buildDockedPier(length: number, width: number, physicsBody: planck.Body, mesh: THREE.Group) {
        // Construct pier in 3 parts: Base, Head Base (Crossbar), and Head Arms (sides of notch)
        // Pier extends along X axis.
        // Tip is at +length/2.

        //               +---+----+
        // +-------------+.  |.   |
        // |             |.  +----+
        // |             |.  |SS
        // |             |.  +----+
        // +-------------+   |.   |
        //               +---+----+

        const DOCK_LENGTH = Pier.DOCK_LENGTH; // 4.0
        const SENSOR_LENGTH = DOCK_LENGTH / 2.0;
        const HEAD_BACK_THICKNESS = 2.5;
        const ARM_WIDTH = 1.5;
        const NOTCH_WIDTH = Math.max(width - ARM_WIDTH, Pier.DOCK_DEPTH);
        const HEAD_WIDTH = NOTCH_WIDTH + ARM_WIDTH * 2.0;

        const tipX = length / 2;
        const startX = -length / 2;

        // Calculate segment boundaries
        // The Head (Arms + Crossbar) occupies the end of the pier
        const armsEndX = tipX;
        const armsStartX = armsEndX - DOCK_LENGTH;
        const crossbarStartX = armsStartX - HEAD_BACK_THICKNESS;

        // 1. Base Segment (from startX to crossbarStartX)
        const baseLen = crossbarStartX - startX;
        if (baseLen > 0) {
            const baseCenterX = startX + baseLen / 2;
            this.addSegment(baseCenterX, baseLen, 0, width, physicsBody, mesh);
            this.addPilesForSegment(baseCenterX, baseLen, 0, width, length, mesh);
        }

        // 2. Head Crossbar (The "bottom" of the U shape)
        const crossbarCenterX = crossbarStartX + HEAD_BACK_THICKNESS / 2;
        this.addSegment(crossbarCenterX, HEAD_BACK_THICKNESS, 0, HEAD_WIDTH, physicsBody, mesh);

        // 3. Head Arms (The sides of the U shape)
        const armsCenterX = armsStartX + DOCK_LENGTH / 2;

        // Left Arm (+Z)
        const leftArmZ = (NOTCH_WIDTH + ARM_WIDTH) / 2;
        this.addSegment(armsCenterX, DOCK_LENGTH, leftArmZ, ARM_WIDTH, physicsBody, mesh);

        // Right Arm (-Z)
        const rightArmZ = -(NOTCH_WIDTH + ARM_WIDTH) / 2;
        this.addSegment(armsCenterX, DOCK_LENGTH, rightArmZ, ARM_WIDTH, physicsBody, mesh);

        // 4. Sensor (In the notch)
        const sensorCenterX = armsStartX + SENSOR_LENGTH / 2;
        const sensorShape = planck.Box(SENSOR_LENGTH / 2, NOTCH_WIDTH / 2, planck.Vec2(sensorCenterX, 0));
        const sensorFixture = physicsBody.createFixture({
            shape: sensorShape,
            isSensor: true
        });
        sensorFixture.setUserData({ type: 'sensor' });

        // 5. Dock Sign
        const signGeo = new THREE.BoxGeometry(4.0, 4.0, 0.1);
        signGeo.name = 'Pier - Sign Geometry';
        const signMesh = GraphicsUtils.createMesh(signGeo, Pier.getSignMaterials() as any, 'PierSign');

        // Position on the Crossbar, facing the notch (+X)
        // Y = 1.5 (deck) + 2.0 (half sign height)
        signMesh.position.set(crossbarCenterX, 1.5 + 2.0, 0);
        signMesh.rotation.y = Math.PI / 2;

        mesh.add(signMesh);

        // Add Piles for Head
        // Piles for Crossbar
        this.addPilesForSegment(crossbarCenterX, HEAD_BACK_THICKNESS, 0, HEAD_WIDTH, length, mesh);
        // Piles for Arms
        this.addPilesForSegment(armsCenterX, DOCK_LENGTH, leftArmZ, ARM_WIDTH, length, mesh);
        this.addPilesForSegment(armsCenterX, DOCK_LENGTH, rightArmZ, ARM_WIDTH, length, mesh);
    }

    private addSegment(centerX: number, segmentLength: number, centerY: number, segmentWidth: number, physicsBody: planck.Body, mesh: THREE.Group) {
        // Physics Fixture
        physicsBody.createFixture({
            shape: planck.Box(segmentLength / 2, segmentWidth / 2, planck.Vec2(centerX, centerY)),
            friction: 0.5
        });

        // Visual Mesh
        const segmentGeo = new THREE.BoxGeometry(segmentLength, 0.5, segmentWidth);
        segmentGeo.name = 'Pier - Dock Segment Geometry';
        const segmentMesh = GraphicsUtils.createMesh(segmentGeo, Pier.getDeckMaterial(), 'PierSegment');

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

            // Add two piles at +/- width/2 relative to the segments centerY
            const y1 = centerY - width / 2 + 0.2; // Indent slightly
            const y2 = centerY + width / 2 - 0.2;

            const pile1 = GraphicsUtils.cloneObject(Pier.getPileMesh());
            pile1.position.set(pileX, 0, y1);
            mesh.add(pile1);

            const pile2 = GraphicsUtils.cloneObject(Pier.getPileMesh());
            pile2.position.set(pileX, 0, y2);
            mesh.add(pile2);
        }
    }

    update(dt: number) {
        this.collectedBottles?.update(dt);
    }
}
