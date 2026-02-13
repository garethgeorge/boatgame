import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { FlyToPointStrategy, PointLandingStrategy } from './strategy/FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';
import { TerrainSlot } from '../../../world/TerrainSlotMap';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface SlotLandingFlightParams {
    slotTypes: string[];
    flightSpeed: number;
}

/**
 * Logic for flying to and landing on a specific slot.
 */
export class SlotLandingFlightLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'slot_landing_finished';
    public static readonly RESULT_FAILED = 'slot_landing_failed';
    readonly name = 'SlotLandingFlight';

    private slotTypes: string[];
    private flightSpeed: number;
    private state: 'SEARCHING' | 'LANDING' | 'FAILED' = 'SEARCHING';
    private strategy: AnimalPathStrategy | null = null;
    private targetSlot: TerrainSlot | null = null;

    constructor(params: SlotLandingFlightParams) {
        this.slotTypes = params.slotTypes;
        this.flightSpeed = params.flightSpeed;
    }

    activate(context: AnimalLogicContext): void {
        const animal = context.animal;
        if (!animal) return;

        // Release existing slot if any
        if (animal.currentSlot) {
            animal.currentSlot.isOccupied = false;
            animal.currentSlot = null;
        }
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const animal = context.animal;

        const defaultSteering = {
            target: context.originPos,
            speed: 0,
            height: context.currentHeight,
            locomotionType: 'FLIGHT' as const
        };

        if (!animal) return { path: defaultSteering, result: SlotLandingFlightLogic.RESULT_FAILED };

        switch (this.state) {
            case 'SEARCHING': {
                const riverSystem = RiverSystem.getInstance();
                const boatPos = context.targetBody.getPosition();
                const boatForward = AnimalBehaviorUtils.getBoatForward(context.targetBody);
                const searchDistance = 1000.0;

                // 1. Try to find a slot in front of the boat
                let slot = riverSystem.slots.findNearbySlots(
                    this.slotTypes, context.originPos.x, context.originPos.y, searchDistance, false,
                    (s) => AnimalBehaviorUtils.isPointInFront(new planck.Vec2(s.x, s.z), boatPos, boatForward)
                );

                // 2. Fallback to any nearby slot if none found in front
                if (!slot) {
                    slot = riverSystem.slots.findNearbySlots(
                        this.slotTypes, context.originPos.x, context.originPos.y, searchDistance);
                }

                if (slot) {
                    this.targetSlot = slot;
                    this.targetSlot.isOccupied = true;
                    animal.currentSlot = this.targetSlot;
                    this.state = 'LANDING';
                    this.strategy = new PointLandingStrategy(
                        context,
                        this.flightSpeed,
                        new planck.Vec2(this.targetSlot.x, this.targetSlot.z),
                        this.targetSlot.y,
                        15.0
                    );
                } else {
                    this.state = 'FAILED';
                }
                break;
            }

            case 'LANDING': {
                if (this.hasLanded(context)) {
                    return {
                        path: this.strategy?.update(context) ?? defaultSteering,
                        result: SlotLandingFlightLogic.RESULT_FINISHED
                    };
                }
                break;
            }

            case 'FAILED': {
                return { path: defaultSteering, result: SlotLandingFlightLogic.RESULT_FAILED };
            }
        }

        // Update strategy
        const steering = this.strategy?.update(context) ?? defaultSteering;

        return {
            path: steering,
            result: this.state === 'FAILED' ? SlotLandingFlightLogic.RESULT_FAILED : undefined
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }

    private hasLanded(context: AnimalLogicContext): boolean {
        if (this.state !== 'LANDING' || !this.targetSlot) return false;

        const dx = context.originPos.x - this.targetSlot.x;
        const dz = context.originPos.y - this.targetSlot.z;
        const horizDistSq = dx * dx + dz * dz;
        const currentAltitude = Math.max(0, context.currentHeight - this.targetSlot.y);

        // Landed when low enough, horizontally close enough, and slow enough
        return currentAltitude < 0.1 && horizDistSq < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
