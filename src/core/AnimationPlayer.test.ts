import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { AnimationPlayer, AnimationStep, AnimationParameters } from './AnimationPlayer';

describe('AnimationStep', () => {
    const configA: AnimationParameters = { name: 'A' };
    const configB: AnimationParameters = { name: 'B' };

    describe('sequence', () => {
        it('should return configs in order', () => {
            const seq = AnimationStep.sequence([configA, configB]);
            expect(seq(0)).toBe(configA);
            expect(seq(1)).toBe(configB);
            expect(seq(2)).toBe(null);
        });
    });

    describe('random', () => {
        it('should return random choices for specified repeat count', () => {
            const weights = [0.5, 0.5];
            const choices = [configA, configB];
            const rand = AnimationStep.random(2, weights, choices);

            const result0 = rand(0, '');
            const result1 = rand(1, '');
            const result2 = rand(2, '');

            expect([configA, configB]).toContain(result0);
            expect([configA, configB]).toContain(result1);
            expect(result2).toBe(null);
        });

        it('should respect weights (rough check)', () => {
            const weights = [1.0, 0.0];
            const choices = [configA, configB];
            const rand = AnimationStep.random(10, weights, choices);

            for (let i = 0; i < 10; i++) {
                expect(rand(i, '')).toBe(configA);
            }
        });
    });
});

describe('AnimationPlayer', () => {
    let mockGroup: THREE.Group;
    let mockAnimations: THREE.AnimationClip[];
    let player: AnimationPlayer;
    let mockActions: Map<string, any>;
    let finishedCallback: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGroup = new THREE.Group();
        mockAnimations = [
            new THREE.AnimationClip('A', 1.0, []),
            new THREE.AnimationClip('B', 2.0, []),
        ];

        mockActions = new Map();
        mockAnimations.forEach(clip => {
            const action = {
                play: vi.fn().mockReturnThis(),
                stop: vi.fn().mockReturnThis(),
                reset: vi.fn().mockReturnThis(),
                setLoop: vi.fn().mockReturnThis(),
                isRunning: vi.fn().mockReturnValue(false),
                getClip: vi.fn().mockReturnValue(clip),
                crossFadeTo: vi.fn().mockReturnThis(),
                time: 0,
                timeScale: 1,
                loop: THREE.LoopOnce,
                clampWhenFinished: false,
            };
            mockActions.set(clip.name, action);
        });

        vi.spyOn(THREE.AnimationMixer.prototype, 'clipAction').mockImplementation((clip: any) => mockActions.get(clip.name));
        vi.spyOn(THREE.AnimationMixer.prototype, 'addEventListener').mockImplementation((type: string, cb: any) => {
            if (type === 'finished') finishedCallback = cb;
        });
        vi.spyOn(THREE.AnimationMixer.prototype, 'update').mockImplementation(() => ({}) as any);
        vi.spyOn(THREE.AnimationMixer.prototype, 'stopAllAction').mockImplementation(() => ({}) as any);

        player = new AnimationPlayer(mockGroup, mockAnimations);
    });

    it('should initialize and map actions', () => {
        expect(player.getAction('A')).toBeDefined();
        expect(player.getAction('B')).toBeDefined();
        expect(player.getAction('C')).toBeUndefined();
    });

    it('should play a single animation config', () => {
        const config: AnimationParameters = { name: 'A', startTime: 0.5, repeat: 1 };
        player.play(config);

        const action = player.getAction('A') as any;
        expect(action.play).toHaveBeenCalled();
        expect(action.time).toBe(0.5);
        expect(action.setLoop).toHaveBeenCalledWith(THREE.LoopOnce, 1);
    });

    it('should handle sequential animation scripts', () => {
        const configA: AnimationParameters = { name: 'A' };
        const configB: AnimationParameters = { name: 'B' };
        const script = AnimationStep.sequence([configA, configB]);

        player.play(script);

        // Should play first step immediately
        expect(mockActions.get('A').play).toHaveBeenCalled();
        expect(mockActions.get('B').play).not.toHaveBeenCalled();

        // Simulate animation finished event
        finishedCallback();

        // Should now play B
        expect(mockActions.get('B').play).toHaveBeenCalled();
    });

    it('should stop all animations and clear stack', () => {
        const script = AnimationStep.sequence([{ name: 'A' }, { name: 'B' }]);
        player.play(script);

        player.stopAll();

        expect((player as any).scriptStack).toHaveLength(0);
        expect((player as any).currentAction).toBeNull();
    });

    it('should handle nested animation scripts', () => {
        const seqA = AnimationStep.sequence([{ name: 'A' }]);
        const seqB = AnimationStep.sequence([{ name: 'B' }]);
        const mainSeq = AnimationStep.sequence([seqA, seqB]);

        player.play(mainSeq);
        expect(mockActions.get('A').play).toHaveBeenCalled();

        finishedCallback();
        expect(mockActions.get('B').play).toHaveBeenCalled();
    });

    it('should calculate timeScale correctly based on duration', () => {
        const actionA = mockActions.get('A'); // Clip duration is 1.0
        player.play({ name: 'A', duration: 2.0 });

        expect(actionA.timeScale).toBeCloseTo(0.5);
    });
});
