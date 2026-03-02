import * as planck from 'planck';
import * as THREE from 'three';
import { TerrainMap, EdgeType } from '../../TerrainMap';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';
import { AnimalBehaviorUtils } from '../../AnimalBehaviorUtils';

/**
 * 0: Face Toward river
 * 1: Face Upstream (+Z)
 * 2: Face Away from river
 * 3: Face Downstream (-Z)
 */
export type TurnDirection = 0 | 1 | 2 | 3;
export type WalkDirection = 'upstream' | 'downstream';

export class ShoreTurnStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreTurn';

    private isOnLeftBank: boolean = true;
    private targetAngle: number = 0;

    constructor(
        private readonly startPos: planck.Vec2,
        terrainMap: TerrainMap,
        private readonly direction: TurnDirection,
        private readonly rotationSpeed: number,
        private readonly onFinish: () => void
    ) {
        super();
        this.initialize(startPos, terrainMap);
    }

    private initialize(pos: planck.Vec2, terrainMap: TerrainMap) {
        this.targetAngle = this.calculateAngle(terrainMap, pos);
    }

    private calculateAngle(terrainMap: TerrainMap, pos: planck.Vec2): number {
        const flowDir = terrainMap.getNearestWaterFlow(pos.x, pos.y);
        const shoreline = terrainMap.getNearestEdge(pos.x, pos.y, EdgeType.SHORE);

        const downAngle = Math.atan2(flowDir.x, -flowDir.y);         // Facing downstream
        const upAngle = Math.atan2(-flowDir.x, flowDir.y);           // Facing upstream
        const riverAngle = Math.atan2(shoreline.normal.x, -shoreline.normal.y);   // Facing river
        const awayAngle = Math.atan2(-shoreline.normal.x, shoreline.normal.y);    // Facing away

        switch (this.direction) {
            case 1: return upAngle;
            case 3: return downAngle;
            case 0: return riverAngle;
            case 2: return awayAngle;
        }
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const currentAngle = context.physicsBody.getAngle();
        const diff = Math.atan2(Math.sin(this.targetAngle - currentAngle), Math.cos(this.targetAngle - currentAngle));

        if (Math.abs(diff) < 0.1) {
            this.onFinish();
        }

        const direction = planck.Vec2(Math.sin(this.targetAngle), -Math.cos(this.targetAngle));
        const rotationTarget = context.originPos.clone().add(direction);

        return {
            target: rotationTarget,
            speed: 0,
            turningSpeed: this.rotationSpeed,
            locomotionType: 'LAND'
        };
    }
}

export class ShoreWalkStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreWalk';

    public isOnLeftBank: boolean = true;
    private bankDistance: number = 0;
    private lastPos: planck.Vec2;
    private distanceTravelled: number;

    constructor(
        private readonly startPos: planck.Vec2,
        terrainMap: TerrainMap,
        private readonly direction: WalkDirection,
        private readonly distance: number,
        private readonly speed: number,
        private readonly onFinish: () => void
    ) {
        super();
        this.initialize(startPos, terrainMap);
    }

    private initialize(pos: planck.Vec2, terrainMap: TerrainMap) {
        this.lastPos = pos.clone();
        this.distanceTravelled = 0;

        const shoreline = terrainMap.getNearestEdge(pos.x, pos.y, EdgeType.SHORE);
        // shoreline.distance represents distance to shore boundary (positive if on land)
        this.bankDistance = Math.max(0, shoreline.distance);
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const currentPos = context.originPos;

        // Calculate progress
        this.distanceTravelled += AnimalBehaviorUtils.distance(currentPos, this.lastPos);
        this.lastPos.setVec2(currentPos);

        if (this.distanceTravelled >= this.distance) {
            this.onFinish();
        }

        const terrainMap = context.animal.getTerrainMap();
        const shoreline = terrainMap.getNearestEdge(currentPos.x, currentPos.y, EdgeType.SHORE);
        const flowDir = terrainMap.getNearestWaterFlow(currentPos.x, currentPos.y);

        // Determine shore tangent based on flow
        const isDirectionDownstream = (shoreline.direction.x * flowDir.x + shoreline.direction.y * flowDir.y) > 0;

        let walkDir = shoreline.direction.clone();
        if (this.direction === 'downstream' && !isDirectionDownstream) {
            walkDir.negate();
        } else if (this.direction === 'upstream' && isDirectionDownstream) {
            walkDir.negate();
        }
        walkDir.multiplyScalar(this.speed);

        // Target is speed units ahead along walkDir, offset by bankDistance inland
        const targetWorldPos = new planck.Vec2(
            shoreline.position.x + walkDir.x - shoreline.normal.x * this.bankDistance,
            shoreline.position.y + walkDir.y - shoreline.normal.y * this.bankDistance
        );

        return {
            target: targetWorldPos,
            speed: this.speed,
            locomotionType: 'LAND'
        };
    }

}
