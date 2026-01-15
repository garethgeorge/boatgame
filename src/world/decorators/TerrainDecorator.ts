import { PoissonDecorationStrategy, DecorationRule, PlacementManifest } from './PoissonDecorationStrategy';
export type { DecorationRule, PlacementManifest };
import { RiverSystem } from '../RiverSystem';

export class TerrainDecorator {
    private strategy: PoissonDecorationStrategy;
    private riverSystem: RiverSystem;

    constructor() {
        this.strategy = new PoissonDecorationStrategy();
        this.riverSystem = RiverSystem.getInstance();
    }

    public static generate(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        seed: number = 0
    ): PlacementManifest[] {
        const decorator = new TerrainDecorator();
        return decorator.generate(rules, region, seed);
    }

    private generate(
        rules: DecorationRule[],
        region: { xMin: number, xMax: number, zMin: number, zMax: number },
        seed: number = 0
    ): PlacementManifest[] {

        // Default Terrain Provider using RiverSystem
        const terrainProvider = (x: number, z: number) => {
            const height = this.riverSystem.terrainGeometry.calculateHeight(x, z);
            const normal = this.riverSystem.terrainGeometry.calculateNormal(x, z);

            // Approximate distToRiver logic
            const riverCenter = this.riverSystem.getRiverCenter(z);
            const distToCenter = Math.abs(x - riverCenter);
            const riverWidth = this.riverSystem.getRiverWidth(z);
            const distToRiver = Math.max(0, distToCenter - riverWidth / 2);

            // Slope calculation
            const slope = 1.0 - Math.abs(normal.y);

            return { height, slope, distToRiver };
        };

        const zStart = region.zMax;
        const zEnd = region.zMin;
        const totalLen = Math.abs(zStart - zEnd) || 1; // avoid /0

        const biomeProgressProvider = (z: number) => {
            return (zStart - z) / totalLen;
        };

        return this.strategy.generate(
            rules,
            region,
            terrainProvider,
            biomeProgressProvider,
            seed
        );
    }
}
