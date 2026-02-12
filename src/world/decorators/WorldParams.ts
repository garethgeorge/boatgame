import { RiverSystem } from "../RiverSystem";

export interface WorldParams {
    riverSystem: RiverSystem;

    terrainProvider: (x: number, z: number) => {
        height: number, slope: number, distToRiver: number
    };

    biomeZRange: [number, number];

    random: () => number;
    gaussian: () => number;
    noise2D: (x: number, y: number) => number;
    sampleMap: (name: string, x?: number, y?: number) => number;
}
