import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as planck from 'planck';
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
            setType: vi.fn(),
            setAngle: vi.fn(),
            setPosition: vi.fn(),
        };

        mockEntity = {
            getPhysicsBody: vi.fn(() => mockBody),
            getHeight: vi.fn(() => 0),
            handleBehaviorEvent: vi.fn(),
        };

        mockLogic = {
            activate: vi.fn(),
            update: vi.fn(() => ({
                path: { target: planck.Vec2(0, 0), speed: 0 },
                locomotionType: 'LAND'
            })),
            getPhase: vi.fn(() => 'TEST' as any),
        };

        (Boat.getPlayerBody as any).mockReturnValue({ getPosition: () => planck.Vec2(10, 10) });
        (Boat.getBottleCount as any).mockReturnValue(5);
        (AnimalLogicRegistry.create as any).mockReturnValue(mockLogic);
    });

    it('should initialize with a single config script', () => {
        const script: any = { name: 'TestLogic' };
        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, script);

        behavior.update(0.1);

        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(script);
        expect(mockLogic.activate).toHaveBeenCalled();
    });

    it('should handle sequential scripts', () => {
        const configA: any = { name: 'A' };
        const configB: any = { name: 'B' };
        const script = AnimalLogicStep.sequence([configA, configB]);

        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, script);

        // First logic: A
        mockLogic.update.mockReturnValueOnce({
            path: { target: planck.Vec2(0, 0), speed: 0 },
            locomotionType: 'LAND',
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

        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, script);

        // Not matching yet
        mockLogic.update.mockReturnValue({
            path: { target: planck.Vec2(0, 0), speed: 0 },
            locomotionType: 'LAND',
            result: 'CONTINUE',
            finish: true
        });

        behavior.update(0.1);
        expect(AnimalLogicRegistry.create).toHaveBeenCalledWith(configA);

        // Matching
        mockLogic.update.mockReturnValue({
            path: { target: planck.Vec2(0, 0), speed: 0 },
            locomotionType: 'LAND',
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

        const behavior = new AnimalUniversalBehavior(mockEntity, 0.5, script);

        // Mock different logic instances for A and B
        const logicA = { ...mockLogic, name: 'A' };
        const logicB = { ...mockLogic, name: 'B' };
        (AnimalLogicRegistry.create as any).mockReturnValueOnce(logicA).mockReturnValueOnce(logicB);

        logicA.update.mockReturnValueOnce({
            path: { target: planck.Vec2(0, 0), speed: 0 },
            locomotionType: 'LAND',
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
});
