import { RiverGeometry, RiverGeometrySample } from '../RiverGeometry';
import { RiverSystem } from '../RiverSystem';

export interface PathPoint extends RiverGeometrySample {
    boatXOffset: number; // Offset from river center along the normal vector
}

export interface ObstaclePlacement {
    index: number;  // index + fractional offset in path  
    range: [number, number]; // Distance range along the normal vector
    aggressiveness?: number;
}

export interface BoatPathSection<T extends string> {
    iStart: number;
    iEnd: number;
    placements: Partial<Record<T, ObstaclePlacement[]>>;
}

export interface BoatPathLayout<T extends string> {
    path: PathPoint[];
    sections: BoatPathSection<T>[];
}

export interface DensityConfig {
    start: number; // expected instances per 100m
    end: number;   // expected instances per 100m
}

/**
 * Each section is populated with animals from an animal group,
 * slalom objects from a slalom group, and path objects from a
 * path group.
 * 
 * waterAnimals identifies animals that should be placed in water
 * all others are placed on shore if possible.
 * 
 * weights determines the relative frequencies of each obstacle
 * type. The weights only matter within each set of groups. So
 * weights for things that are only in slalom groups don't affect
 * things only in animal groups. 
 */
export interface BoatPathLayoutConfig<T extends string> {
    animalGroups: T[][];
    slalomGroups: T[][];
    pathGroups: T[][];
    waterAnimals: T[];
    weights?: Partial<Record<T, number>>;
    slalomDensity: DensityConfig;
    animalDensity: DensityConfig;
    pathDensity: DensityConfig;
    biomeLength: number;
}

export class BoatPathLayoutStrategy {
    public static createLayout<T extends string>(
        zMin: number,
        zMax: number,
        config: BoatPathLayoutConfig<T>
    ): BoatPathLayout<T> {
        const riverSystem = RiverSystem.getInstance();

        // Direction of travel is -ve z
        const zStart = zMax;
        const zEnd = zMin;

        // Sample the river every 10 units of arc length
        const path: PathPoint[] = RiverGeometry.sampleRiver(riverSystem, zStart, zEnd, 10.0).map((sample) => {
            const arcLength = sample.arcLength;

            // Weaving logic based on arc length
            const wavelength = 400 - (arcLength / config.biomeLength) * 280;
            const baseFreq = (2 * Math.PI) / wavelength;
            const detailFreq = baseFreq * 2.5;

            const normalizedX = Math.sin(arcLength * baseFreq) * 0.6 +
                Math.sin(arcLength * detailFreq) * 0.15;

            // Available movement range (width - safety margin)
            const margin = 5.0;
            const leftWidth = sample.leftBankDist - margin;
            const rightWidth = sample.rightBankDist - margin;
            const center = (rightWidth - leftWidth) / 2;
            const width = (rightWidth + leftWidth) / 2;
            const boatXOffset = center + normalizedX * width;

            return {
                ...sample,
                boatXOffset
            };
        });

        // Sectioning based on boat offset extrema
        const sections: BoatPathSection<T>[] = [];
        let sectionStartIdx = 0;

        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1].boatXOffset;
            const curr = path[i].boatXOffset;
            const next = path[i + 1].boatXOffset;

            const isLocalMax = curr > prev && curr > next;
            const isLocalMin = curr < prev && curr < next;

            const currentArcLength = path[i].arcLength;
            const sectionArcLen = currentArcLength - path[sectionStartIdx].arcLength;

            if ((isLocalMax || isLocalMin) || sectionArcLen > 250) {
                if (sectionArcLen > 50) {
                    sections.push(this.populateSection(path, sectionStartIdx, i, config));
                    sectionStartIdx = i;
                }
            }
        }

        // Final section
        if (sectionStartIdx < path.length - 1) {
            sections.push(this.populateSection(path, sectionStartIdx, path.length - 1, config));
        }

        return { path, sections };
    }

    private static populateSection<T extends string>(
        path: PathPoint[],
        iStart: number,
        iEnd: number,
        config: BoatPathLayoutConfig<T>
    ): BoatPathSection<T> {
        const placements: Partial<Record<T, ObstaclePlacement[]>> = {};

        // Initialize all potential placement arrays in config
        const allPossibleTypes = new Set<T>([
            ...config.animalGroups.flat(),
            ...config.slalomGroups.flat(),
            ...config.pathGroups.flat()
        ]);
        for (const type of allPossibleTypes) {
            placements[type] = [];
        }

        const pathLength = path[path.length - 1].arcLength;
        const pathCutoff = 0.9 * pathLength;
        const sectionStart = path[iStart].arcLength;
        const sectionEnd = Math.min(path[iEnd].arcLength, pathCutoff);
        const sectionLen = sectionEnd - sectionStart;

        if (sectionLen <= 0) {
            return { iStart, iEnd, placements };
        }

        // Use mid point of section as progress along path
        const progress = 0.5 * (sectionStart + sectionEnd) / pathLength;

        // Selection
        const selectedAnimalGroup = this.pickWeightedGroup(config.animalGroups, config.weights);
        const selectedSlalomGroup = this.pickWeightedGroup(config.slalomGroups, config.weights);
        const selectedPathGroup = this.pickWeightedGroup(config.pathGroups, config.weights);

        // Calculate counts based on density (expected per 100m)
        const getCount = (density: DensityConfig) => {
            const d = density.start + progress * (density.end - density.start);
            const expected = (sectionLen / 100) * d;
            return Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);
        };

        const slalomCount = selectedSlalomGroup.length > 0 ? getCount(config.slalomDensity) : 0;
        const animalCount = selectedAnimalGroup.length > 0 ? getCount(config.animalDensity) : 0;
        const pathCount = selectedPathGroup.length > 0 ? getCount(config.pathDensity) : 0;

        // --- Slalom Obstacles ---
        if (slalomCount > 0) {
            for (let j = 0; j < slalomCount; j++) {
                const slalomType = this.pickWeightedType(selectedSlalomGroup, config.weights);
                if (!placements[slalomType]) placements[slalomType] = [];

                const pathIndex = this.randomIndex(iStart, iEnd, j, slalomCount);
                const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);
                const boatOffset = pathPoint.boatXOffset;

                let range: [number, number];
                if (boatOffset > 0) {
                    range = [-pathPoint.leftBankDist + 2.0, boatOffset - 5.0];
                } else {
                    range = [boatOffset + 5.0, pathPoint.rightBankDist - 2.0];
                }
                placements[slalomType]!.push({ index: pathIndex, range });
            }
        }

        // --- Animals ---
        if (animalCount > 0) {
            for (let j = 0; j < animalCount; j++) {
                const animalType = this.pickWeightedType(selectedAnimalGroup, config.weights);
                if (!placements[animalType]) placements[animalType] = [];

                const isWaterAnimal = config.waterAnimals.includes(animalType);

                const pathIndex = this.randomIndex(iStart, iEnd, j, animalCount);
                const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);
                const boatOffset = pathPoint.boatXOffset;

                let range: [number, number];
                if (isWaterAnimal) {
                    // Near bank but in water
                    range = boatOffset < 0 ?
                        [0.5 * pathPoint.rightBankDist, pathPoint.rightBankDist] :
                        [-pathPoint.leftBankDist, 0.5 * -pathPoint.leftBankDist];
                } else {
                    // On bank
                    range = boatOffset < 0 ?
                        [0.5 * pathPoint.rightBankDist, pathPoint.rightBankDist + 15] :
                        [-pathPoint.leftBankDist - 15, 0.5 * -pathPoint.leftBankDist];
                }

                const aggressiveness = Math.min(1.0, progress * 0.7 + Math.random() * 0.3);
                placements[animalType]!.push({ index: pathIndex, range, aggressiveness });
            }
        }

        // --- Path Obstacles ---
        if (pathCount > 0) {
            for (let j = 0; j < pathCount; j++) {
                const pathType = this.pickWeightedType(selectedPathGroup, config.weights);
                if (!placements[pathType]) placements[pathType] = [];

                const pathIndex = this.randomIndex(iStart, iEnd, j, pathCount);
                const pathPoint = RiverGeometry.getPathPoint(path, pathIndex);
                placements[pathType]!.push({
                    index: pathIndex,
                    range: [pathPoint.boatXOffset - 2, pathPoint.boatXOffset + 2]
                });
            }
        }

        return { iStart, iEnd, placements };
    }

    /**
     * Given a list of groups, picks one with probability equal
     * to the sum of probabilities of the individual obstacles.
     */
    private static pickWeightedGroup<T extends string>(
        groups: T[][],
        weights: Partial<Record<T, number>> | undefined
    ): T[] {
        if (groups.length === 0) return [];
        if (!weights) return groups[Math.floor(Math.random() * groups.length)];

        let totalWeight = 0;
        const groupWeights = groups.map(group => {
            const weight = group.reduce((sum, type) => sum + (weights[type] || 1), 0);
            totalWeight += weight;
            return weight;
        });

        if (totalWeight <= 0) return groups[Math.floor(Math.random() * groups.length)];

        let r = Math.random() * totalWeight;
        for (let i = 0; i < groups.length; i++) {
            r -= groupWeights[i];
            if (r <= 0) return groups[i];
        }
        return groups[groups.length - 1];
    }

    /**
     * Choose a random type applying the weights to influence frequency
     */
    private static pickWeightedType<T extends string>(
        types: T[],
        weights: Partial<Record<T, number>> | undefined
    ): T {
        if (types.length === 0) throw new Error("Empty type list");
        if (!weights) return types[Math.floor(Math.random() * types.length)];

        let totalWeight = 0;
        for (const type of types) {
            totalWeight += (weights[type] || 1);
        }

        if (totalWeight <= 0) return types[Math.floor(Math.random() * types.length)];

        let r = Math.random() * totalWeight;
        for (const type of types) {
            r -= (weights[type] || 1);
            if (r <= 0) return type;
        }
        return types[types.length - 1];
    }

    private static randomIndex(iStart: number, iEnd: number, n: number, count: number) {
        return iStart + (n + Math.random() * 0.99) * (iEnd - iStart) / count;
    }
}
