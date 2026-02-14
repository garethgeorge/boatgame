import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as planck from 'planck';
import * as THREE from 'three';
import { AnimalUniversalBehavior } from './AnimalUniversalBehavior';
import { Boat } from '../Boat';
import { AnimalLogicRegistry } from './logic/AnimalLogicRegistry';
import { AnimalLogicStep } from './logic/AnimalLogic';
import { AnimalLogicConfig } from './logic/AnimalLogicConfigs';

// Mock dependencies
vi.mock('../Boat', () => ({
    Boat: {
        getPlayerBody: vi.fn(),
        getBottleCount: vi.fn(),
    }
}));

vi.mock('./logic/AnimalLogicRegistry', () => ({
    AnimalLogicRegistry: {
        create: vi.fn(),
    }
}));

vi.mock('./AnimalBehaviorUtils', () => ({
    AnimalBehaviorUtils: {
        setCollisionMask: vi.fn(),
        evaluateNoticeBoatDistance: vi.fn(),
        effectiveAggressiveness: vi.fn(),
        evaluateAttackParams: vi.fn(),
        evaluateSwimAwayParams: vi.fn(),
    }
}));

const mockRiverSystem = {
    terrainGeometry: {
        calculateHeight: vi.fn((x: number, z: number) => 0),
        calculateNormal: vi.fn((x: number, z: number) => new THREE.Vector3(0, 1, 0)),
    },
    getBankPositions: vi.fn((z: number) => ({ center: 0, left: -10, right: 10 })),
};

vi.mock('../../world/RiverSystem', () => ({
    RiverSystem: {
        getInstance: vi.fn(() => mockRiverSystem),
    }
}));

describe('AnimalUniversalBehavior', () => {
    let mockEntity: any;
    let mockBody: any;
    let mockLogic: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockBody = {
            getPosition: vi.fn(() => planck.Vec2(0, 0)),
            getAngle: vi.fn(() => 0),
            getWorldPoint: vi.fn((v) => v),
            setAngularVelocity: vi.fn(),
            setLinearVelocity: vi.fn(),
            getAngularVelocity: vi.fn(() => 0),
            getLinearVelocity: vi.fn(() => planck.Vec2(0, 0)),
            getType: vi.fn(() => planck.Body.DYNAMIC),
            setType: vi.fn(),
            setAngle: vi.fn(),
            setPosition: vi.fn(),
            getFixtureList: vi.fn(() => ({
                getNext: vi.fn(() => null),
                setFilterData: vi.fn(),
                getFilterCategoryBits: vi.fn(() => 0x0001),
                getFilterMaskBits: vi.fn(() => 0xFFFF),
                getFilterGroupIndex: vi.fn(() => 0),
            })),
        };

        const mockMesh = {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            quaternion: new THREE.Quaternion(),
        };

        mockEntity = {
            getPhysicsBody: vi.fn(() => mockBody),
            getMesh: vi.fn(() => mockMesh),
            getHeight: vi.fn(() => 0),
            currentSlot: null,
            handleBehaviorEvent: vi.fn(),
            setDynamicPosition: vi.fn(),
            parent: vi.fn(() => null),
            localPos: vi.fn(() => mockMesh.position),
            worldToLocalPos: vi.fn((v: THREE.Vector3) => {
                const parent = mockEntity.parent();
                if (parent && parent.meshes.length > 0) {
                    parent.meshes[0].worldToLocal(v);
                }
            }),
            localToWorldPos: vi.fn((v: THREE.Vector3) => {
                const parent = mockEntity.parent();
                if (parent && parent.meshes.length > 0) {
                    parent.meshes[0].localToWorld(v);
                }
            }),
            localAngle: vi.fn(() => {
                const worldAngle = mockBody.getAngle();
                const parent = mockEntity.parent();
                if (parent && parent.physicsBodies && parent.physicsBodies.length > 0) {
                    return worldAngle - parent.physicsBodies[0].getAngle();
                }
                return worldAngle;
            }),
            getTerrainMap: vi.fn(() => ({
                sample: vi.fn((x: number, z: number, waterHeight: number, margin: number) => {
                    const terrainHeight = mockRiverSystem.terrainGeometry.calculateHeight(x, z);
                    const terrainNormal = mockRiverSystem.terrainGeometry.calculateNormal(x, z);

                    const banks = mockRiverSystem.getBankPositions(z);
                    const distFromLeft = x - banks.left;
                    const distFromRight = banks.right - x;
                    const distIntoWater = Math.min(distFromLeft, distFromRight);

                    let height = terrainHeight;
                    let zone: any = 'land';

                    if (distIntoWater < 0) {
                        height = terrainHeight;
                        zone = 'land';
                    } else if (distIntoWater < margin) {
                        const t = distIntoWater / margin;
                        height = terrainHeight * (1 - t) + waterHeight * t;
                        zone = 'margin';
                    } else {
                        height = waterHeight;
                        zone = 'water';
                    }

                    return { y: height, normal: terrainNormal, zone };
                })
            }))
        };

        mockLogic = {
            name: 'MockLogic',
            activate: vi.fn(),
            update: vi.fn(() => ({
                path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'LAND' as const }
            })),
            getPhase: vi.fn(() => 'TEST' as any),
        };

        (Boat.getPlayerBody as any).mockReturnValue({ getPosition: () => planck.Vec2(10, 10) });
        (Boat.getBottleCount as any).mockReturnValue(5);
        (AnimalLogicRegistry.create as any).mockImplementation((config: any) => {
            if (config.name === 'WalkTowardBoat') {
                return {
                    name: 'WalkTowardBoat',
                    activate: vi.fn(),
                    update: vi.fn((ctx) => ({
                        path: { target: ctx.targetBody.getPosition(), speed: config.params.speed, locomotionType: 'LAND' }
                    })),
                    getPhase: vi.fn(() => 'WALKING'),
                };
            }
            return mockLogic;
        });
    });

    it('should initialize with a single config script', () => {
        const script: any = { name: 'TestLogic' };
        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, script);

        behavior.update(0.1);

        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(script);
        expect(mockLogic.activate).toHaveBeenCalled();
    });

    it('should handle sequential scripts', () => {
        const configA: any = { name: 'A' };
        const configB: any = { name: 'B' };
        const script = AnimalLogicStep.sequence([configA, configB]);

        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, script);

        // First logic: A
        mockLogic.update.mockReturnValueOnce({
            path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'LAND' as const },
            result: 'DONE',
            finish: true
        });

        behavior.update(0.1);
        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(configA);

        // Next update should switch to B
        behavior.update(0.1);
        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(configB);
    });

    it('should handle loop termination with until', () => {
        const configA: any = { name: 'A' };
        const script = AnimalLogicStep.until('MATCH', Infinity, configA);

        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, script);

        // Not matching yet
        mockLogic.update.mockReturnValue({
            path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'LAND' as const },
            result: 'CONTINUE',
            finish: true
        });

        behavior.update(0.1);
        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(configA);

        // Matching
        mockLogic.update.mockReturnValue({
            path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'LAND' as const },
            result: 'MATCH',
            finish: true
        });

        behavior.update(0.1);

        // After matching, resolveNextLogic should return null for the 'until' script
        // And the behavior should call finished event
        expect(mockEntity.handleBehaviorEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'LOGIC_FINISHED' }));
    });

    it('should handle immediate chaining (finish: false)', () => {
        const configA: any = { name: 'A' };
        const configB: any = { name: 'B' };
        const script = AnimalLogicStep.sequence([configA, configB]);

        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, script);

        // Mock different logic instances for A and B
        const logicA = { ...mockLogic, name: 'A' };
        const logicB = { ...mockLogic, name: 'B' };
        (AnimalLogicRegistry.create as any).mockReturnValueOnce(logicA).mockReturnValueOnce(logicB);

        logicA.update.mockReturnValueOnce({
            path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'LAND' as const },
            result: 'IMMEDIATE',
            finish: false // Immediate switch
        });

        behavior.update(0.1);

        // Should have created both in the same update
        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(configA);
        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(configB);
        expect(logicA.update).toHaveBeenCalled();
        expect(logicB.update).toHaveBeenCalled();
    });

    it('should derive FLIGHT orientation and bank correctly', () => {
        const config: any = { name: 'FlightLogic' };
        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, config);

        // Flight moving toward (10, 0) from (0, 0) -> Angle should be PI/2
        mockLogic.update.mockReturnValue({
            path: { target: planck.Vec2(10, 0), speed: 5, turningSpeed: Math.PI, locomotionType: 'FLIGHT' as const },
        });

        behavior.update(0.1);
        behavior.updatePhysics(0.1);
        behavior.updateVisuals(0.1, 1.0);

        const mesh = mockEntity.getMesh();
        // Extract angle from quaternion
        const worldEuler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
        const angle = -worldEuler.y;

        // Since we are at 0 and max rotation is PI * 0.1 = 0.314, PI/2 is further.
        expect(angle).toBeGreaterThan(0);
        expect(angle).toBeLessThanOrEqual(Math.PI / 2);
    });

    it('should respect turningSpeed in LAND mode', () => {
        const config: any = { name: 'LandLogic' };
        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, config);

        // Land moving toward (10, 0) from (0, 0) -> Angle should be PI/2
        // Set a very slow turning speed
        mockLogic.update.mockReturnValue({
            path: { target: planck.Vec2(10, 0), speed: 5, turningSpeed: 0.1, locomotionType: 'LAND' as const },
        });

        behavior.update(0.1);
        behavior.updatePhysics(0.1);
        behavior.updateVisuals(0.1, 1.0);

        const mesh = mockEntity.getMesh();
        const worldEuler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
        const angle = -worldEuler.y;

        // Expected rotation is 0.1 * 0.1 = 0.01
        expect(angle).toBeCloseTo(0.01, 5);
    });

    describe('Jumps', () => {
        it('should execute a parabolic jump during land locomotion', () => {
            const script: any = { name: 'JumpLogic' };
            const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, script);

            // Define a jump: height 2, scale 10
            mockLogic.update.mockReturnValue({
                path: { target: planck.Vec2(0, 10), speed: 10, locomotionType: 'LAND' as const },
                jump: { height: 2, distance: 10 }
            });

            // Frame 0: Start of jump
            behavior.update(0.1); // dt=0.1, speed=10 => move 1 unit
            behavior.updatePhysics(0.1);
            behavior.updateVisuals(0.1, 1.0);
            mockBody.getPosition.mockReturnValue(planck.Vec2(mockEntity.getMesh().position.x, mockEntity.getMesh().position.z));

            // At t = 1/10 = 0.1
            // height = 0 + 4 * 0.1 * (1 - 0.1) * 2 = 4 * 0.1 * 0.9 * 2 = 0.72
            expect(mockEntity.getMesh().position.y).toBeCloseTo(0.72, 2);

            // Frame 4: Peak of jump (t = 0.5)
            for (let i = 0; i < 4; i++) {
                behavior.update(0.1);
                behavior.updatePhysics(0.1);
                behavior.updateVisuals(0.1, 1.0);
                mockBody.getPosition.mockReturnValue(planck.Vec2(mockEntity.getMesh().position.x, mockEntity.getMesh().position.z));
            }
            // total moved = 5
            // At t = 5/10 = 0.5
            // height = 4 * 0.5 * 0.5 * 2 = 2
            expect(mockEntity.getMesh().position.y).toBeCloseTo(2.0, 2);

            // Frame 9: End of jump (t = 1.0)
            for (let i = 0; i < 5; i++) {
                behavior.update(0.1);
                behavior.updatePhysics(0.1);
                behavior.updateVisuals(0.1, 1.0);
                mockBody.getPosition.mockReturnValue(planck.Vec2(mockEntity.getMesh().position.x, mockEntity.getMesh().position.z));
            }
            // total moved = 10
            // At t = 1.0, height = 0, which is <= normalHeight (0)
            // jump should end
            expect(mockEntity.getMesh().position.y).toBeCloseTo(0, 2);
        });

        it('should land early if terrain height increases', () => {
            const script: any = { name: 'JumpLogic' };
            const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, script);

            // Define a jump: height 2, scale 10, moving at x=20 (outside river)
            mockLogic.update.mockReturnValue({
                path: { target: planck.Vec2(20, 10), speed: 10, locomotionType: 'LAND' as const },
                jump: { height: 2, distance: 10 }
            });

            // Set initial position outside river
            mockEntity.getMesh().position.set(20, 0, 0);
            mockBody.getPosition.mockReturnValue(planck.Vec2(20, 0));

            // Mock terrain height increasing at z=5
            mockRiverSystem.terrainGeometry.calculateHeight.mockImplementation((x: number, z: number) => {
                if (z >= 5) return 3; // Terrain is higher than the jump peak
                return 0;
            });

            // Move to z=5
            for (let i = 0; i < 5; i++) {
                behavior.update(0.1);
                behavior.updatePhysics(0.1);
                behavior.updateVisuals(0.1, 1.0);
                mockBody.getPosition.mockReturnValue(planck.Vec2(mockEntity.getMesh().position.x, mockEntity.getMesh().position.z));
            }

            // At z=5, t=0.5, parabolic height is 2.0
            // But terrain height is 3.0
            // 2.0 <= 3.0, so jump should end and height should be 3.0
            expect(mockEntity.getMesh().position.y).toBe(3);
        });
    });

    describe('NONE locomotion', () => {
        it('should stop dynamic motion when locomotion is NONE', () => {
            const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, { name: 'NoneLogic' } as any);

            mockLogic.update.mockReturnValue({
                path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'NONE' as const },
            });

            // Set to dynamic mode first
            behavior.update(0.1); // This will set computeNoneLocomotion which will stop dynamic motion if already dynamic
            behavior.updatePhysics(0.1);

            expect(mockBody.setLinearVelocity).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: 0 }));
            expect(mockBody.setAngularVelocity).toHaveBeenCalledWith(0);

            // Should NOT have called setDynamicPosition because height/normal are undefined in pendingDynamic
            expect(mockEntity.setDynamicPosition).not.toHaveBeenCalled();
        });

        it('should keep kinematic state when locomotion is NONE', () => {
            const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, { name: 'NoneLogic' } as any);

            // First enter land (kinematic)
            mockLogic.update.mockReturnValue({
                path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'LAND' as const },
            });
            behavior.update(0.1);
            behavior.updatePhysics(0.1);

            // Now switch to NONE
            mockLogic.update.mockReturnValue({
                path: { target: planck.Vec2(0, 0), speed: 0, locomotionType: 'NONE' as const },
            });

            const mesh = mockEntity.getMesh();
            mesh.position.set(123, 456, 789);

            behavior.update(0.1);
            behavior.updatePhysics(0.1);

            // Position should NOT have been updated by computeNoneLocomotion
            expect(mesh.position.x).toBe(123);
            expect(mesh.position.y).toBe(456);
            expect(mesh.position.z).toBe(789);
        });
    });

    describe('Parented Locomotion', () => {
        it('should handle parented locomotion correctly', () => {
            const config: any = { name: 'LandLogic' };
            const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, config);

            // Mock parent mesh
            const parentMesh = new THREE.Group();
            parentMesh.position.set(100, 0, 100);
            parentMesh.updateMatrixWorld();

            const mockParent = {
                meshes: [parentMesh],
                physicsBodies: [{ getAngle: () => 0 }]
            };

            mockEntity.parent.mockReturnValue(mockParent);

            // Target is at world (110, 110)
            // Relative to parent (100, 100), this should be (10, 10)
            mockLogic.update.mockReturnValue({
                path: { target: planck.Vec2(110, 110), speed: 10, turningSpeed: 100, locomotionType: 'LAND' as const },
            });

            // Initial local position is (0, 0)
            const mesh = mockEntity.getMesh();
            mesh.position.set(0, 0, 0);

            behavior.update(0.1); // moveDist = 10 * 0.1 = 1.0
            behavior.updatePhysics(0.1);
            behavior.updateVisuals(0.1, 1.0);

            // moveVec local is (10, 10)
            // normalized moveDir local is (1/sqrt(2), 1/sqrt(2)) approx (0.707, 0.707)
            expect(mesh.position.x).toBeCloseTo(0.707, 3);
            expect(mesh.position.z).toBeCloseTo(0.707, 3);

            // Rotation should be atan2(10, -10) = 3 * PI / 4 = 2.356
            const worldEuler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
            const angle = -worldEuler.y;
            expect(angle).toBeCloseTo(2.356, 3);
        });

        it('should move toward boat in WalkTowardBoatLogic', () => {
            const config: any = { name: 'WalkTowardBoat', params: { speed: 2.0 } };
            const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, 0, config);

            // Boat is at (10, 10)
            behavior.update(0.1); // moveDist = 2.0 * 0.1 = 0.2
            behavior.updatePhysics(0.1);
            behavior.updateVisuals(0.1, 1.0);

            const mesh = mockEntity.getMesh();
            // moveVec is (10, 10), normalized is (0.707, 0.707)
            // nextPos = (0, 0) + (0.707, 0.707) * 0.2 = (0.1414, 0.1414)
            expect(mesh.position.x).toBeCloseTo(0.1414, 4);
            expect(mesh.position.z).toBeCloseTo(0.1414, 4);
        });
    });
});
