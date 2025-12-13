import * as THREE from 'three';
import { Decorations } from '../world/Decorations';
import { GraphicsUtils } from '../core/GraphicsUtils';

export class CollectedBottles {
    public mesh: THREE.Group;
    private gridConfig = {
        rows: 3,
        cols: 7,
        spacingX: 0.6,
        spacingZ: 0.6
    };
    private grid: (THREE.Group | null)[][];
    private activeBottles: THREE.Group[] = [];

    private mixer: THREE.AnimationMixer;

    constructor() {
        this.mesh = new THREE.Group();
        this.mixer = new THREE.AnimationMixer(this.mesh);
        this.mixer.addEventListener('finished', (e: any) => {
            const action = e.action as THREE.AnimationAction;
            const bottle = action.getRoot() as THREE.Group;
            // If the bottle is marked for removal, clean it up when any action finishes.
            // Since we play multiple simultaneous actions (Arc, Fade), any of them finishing
            // signals the end of the sequence.
            if (bottle.userData.removing) {
                this.mesh.remove(bottle);
                this.mixer.uncacheRoot(bottle);
            }
        });

        // Initialize grid
        this.grid = Array(this.gridConfig.rows).fill(null).map(() => Array(this.gridConfig.cols).fill(null));

        // Center the grid relative to parent attachment point
        // Total width = (cols-1) * spacingX
        // Total depth = (rows-1) * spacingZ
        const totalWidth = (this.gridConfig.cols - 1) * this.gridConfig.spacingX;
        const totalDepth = (this.gridConfig.rows - 1) * this.gridConfig.spacingZ;

        // Offset to center
        this.mesh.position.set(-totalWidth / 2, 0, -totalDepth / 2);
    }

    update(dt: number) {
        this.mixer.update(dt);
    }

    addBottle(color: number) {
        // Find empty slots
        const emptySlots: { r: number, c: number }[] = [];
        for (let r = 0; r < this.gridConfig.rows; r++) {
            for (let c = 0; c < this.gridConfig.cols; c++) {
                if (this.grid[r][c] === null) {
                    emptySlots.push({ r, c });
                }
            }
        }

        if (emptySlots.length === 0) return; // Full

        // Pick random slot
        const slot = emptySlots[Math.floor(Math.random() * emptySlots.length)];

        // Create bottle with specified color
        const bottle = Decorations.getBottle(color);

        // Grid Position
        const targetX = slot.c * this.gridConfig.spacingX;
        const targetZ = slot.r * this.gridConfig.spacingZ;

        // Scale down slightly to fit on deck nicely? 
        // Original bottle is ~2.0 high with cork. 
        // 0.4 radius. Grid spacing 0.6 is tight (0.8 diameter).
        // Let's scale to 0.6 to fit better
        bottle.scale.set(0.6, 0.6, 0.6);

        // Position based on grid - Start high up for drop animation
        const dropHeight = 5.0;
        bottle.position.set(targetX, dropHeight, targetZ);

        // Prepare for animation
        GraphicsUtils.cloneMaterials(bottle);

        // Hide initially (Set opacity to 0) so it doesn't show up before the delayed fade-in starts
        GraphicsUtils.setMaterialOpacity(bottle, 0);

        this.mesh.add(bottle);
        this.grid[slot.r][slot.c] = bottle;
        this.activeBottles.push(bottle);

        // --- Animations ---
        const startDelay = 0.25; // this matches the fade out for the collision
        const duration = 0.25;
        const startTime = this.mixer.time + startDelay;

        // 1. Fade In (Use bottle.animations[0] in reverse)
        const bottleFade = Decorations.getBottleFadeAnimation();
        const fadeAction = this.mixer.clipAction(bottleFade, bottle);

        // Play backwards to fade IN (0 to Opacity)
        fadeAction.loop = THREE.LoopOnce;
        fadeAction.clampWhenFinished = true;
        fadeAction.timeScale = -1.0 / duration;
        fadeAction.time = fadeAction.getClip().duration; // Start at end
        fadeAction.startAt(startTime);
        fadeAction.play();

        // 2. Drop Down
        // Create a custom track for position
        // Current position is target (y=0). Start at y=dropHeight.
        const times = [0, duration]; // duration
        const values = [
            targetX, dropHeight, targetZ, // Start
            targetX, 0, targetZ           // End
        ];

        const positionTrack = new THREE.VectorKeyframeTrack('.position', times, values);
        const dropClip = new THREE.AnimationClip('BottleDrop', duration, [positionTrack]);

        const dropAction = this.mixer.clipAction(dropClip, bottle);
        dropAction.loop = THREE.LoopOnce;
        dropAction.clampWhenFinished = true;
        dropAction.startAt(startTime);
        dropAction.play();
    }

    removeBottle() {
        if (this.activeBottles.length === 0) return;

        // Pick random bottle to remove
        const index = Math.floor(Math.random() * this.activeBottles.length);
        const bottleToRemove = this.activeBottles[index];

        // Ensure we stop and uncache any actions for this bottle
        this.mixer.uncacheRoot(bottleToRemove);

        // Mark for removal
        bottleToRemove.userData.removing = true;

        // Find in grid to determine side and clear slot
        let bottleCol = 0;
        let found = false;
        for (let r = 0; r < this.gridConfig.rows; r++) {
            for (let c = 0; c < this.gridConfig.cols; c++) {
                if (this.grid[r][c] === bottleToRemove) {
                    this.grid[r][c] = null;
                    bottleCol = c;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        this.activeBottles.splice(index, 1);

        // --- Arc Animation Parameters ---
        const duration = 0.8; // Slightly longer for arc

        // Determine Direction (-1 Left, 1 Right)
        // Adjust threshold based on columns. 7 cols -> 0,1,2 (Left), 3 (Mid), 4,5,6 (Right)
        // If exact middle, maybe random? or right.
        const midPoint = (this.gridConfig.cols - 1) / 2;
        const direction = bottleCol < midPoint ? -1 : 1;

        // Start Point (Current)
        const startX = bottleToRemove.position.x;
        const startY = bottleToRemove.position.y;
        const startZ = bottleToRemove.position.z;

        // Control Point (Up and Out)
        const arcHeight = 3.0;
        const arcDistX = 2.0;
        const controlX = startX + direction * arcDistX;
        const controlY = startY + arcHeight;
        const controlZ = startZ;

        // End Point (Further Out and Down)
        const endX = startX + direction * arcDistX * 2.0;
        const endY = startY - 2.0; // Below deck
        const endZ = startZ;

        // Calculate Keyframes (Position and Rotation)
        const samples = 10;
        const times: number[] = [];
        const posValues: number[] = [];
        const rotValues: number[] = [];

        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(startX, startY, startZ),
            new THREE.Vector3(controlX, controlY, controlZ),
            new THREE.Vector3(endX, endY, endZ)
        );

        const upAxis = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            times.push(t * duration);

            // Position
            const point = curve.getPoint(t);
            posValues.push(point.x, point.y, point.z);

            // Rotation (Tangent)
            const tangent = curve.getTangent(t).normalize();

            // Quaternion to align Y-up to Tangent
            // setFromUnitVectors computes rotation from vFrom to vTo
            const q = new THREE.Quaternion().setFromUnitVectors(upAxis, tangent);
            rotValues.push(q.x, q.y, q.z, q.w);
        }

        const positionTrack = new THREE.VectorKeyframeTrack('.position', times, posValues);
        const rotationTrack = new THREE.QuaternionKeyframeTrack('.quaternion', times, rotValues); // Use quaternion track

        const arcClip = new THREE.AnimationClip('BottleArc', duration, [positionTrack, rotationTrack]);
        const arcAction = this.mixer.clipAction(arcClip, bottleToRemove);

        arcAction.loop = THREE.LoopOnce;
        arcAction.clampWhenFinished = true;
        arcAction.play();

        // Simultaneous Fade Out
        const bottleFade = Decorations.getBottleFadeAnimation();
        const fadeAction = this.mixer.clipAction(bottleFade, bottleToRemove);
        // Standard fade 1.0 -> 0 opacity. Clip duration is 1.0.
        fadeAction.timeScale = 1.0 / duration;
        fadeAction.play();
    }

    get count(): number {
        return this.activeBottles.length;
    }
}

