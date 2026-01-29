
// Leaves 

export type LeafKind = 'blob' | 'willow' | 'irregular' | 'cluster' | 'umbrella';
export interface BlobLeafKindParams {
    kind: 'blob';
    size: number;
    thickness: number;
    variation?: { h: number, s: number, l: number };
}
export interface WillowLeafKindParams {
    kind: 'willow';
    strands: number;
    variation?: { h: number, s: number, l: number };
};
export interface IrregularLeafKindParams {
    kind: 'irregular';
    size: number;
    thickness: number;
    variation?: { h: number, s: number, l: number };
}
export interface ClusterLeafKindParams {
    kind: 'cluster';
    size: number;
    thickness: number;
    leaves: number;
    leafSize: number;
    variation?: { h: number, s: number, l: number };
}
export interface UmbrellaLeafKindParams {
    kind: 'umbrella';
    size: number;
    leaves: number;
    leafSize: number;
    variation?: { h: number, s: number, l: number };
}
export type LeafKindParams = BlobLeafKindParams | WillowLeafKindParams |
    IrregularLeafKindParams | ClusterLeafKindParams | UmbrellaLeafKindParams;

// Flower parts 

export interface RectangleFlowerPetalParams {
    kind: 'rectangle';
    size: number;
    length: number;
    variation?: { h: number, s: number, l: number };
    lGradient?: [number, number]; // [base, tip] lightness adjustment
}

export interface KiteFlowerPetalParams {
    kind: 'kite';
    width: number;
    length: number;
    middle: number; // 0 to 1 position of widest part
    bend?: number;  // in degrees
    variation?: { h: number, s: number, l: number };
    lGradient?: [number, number]; // [base, tip] lightness adjustment
}

export interface FlowerCenterParams {
    kind: 'center';
    size: number;
    thickness: number;
    offset?: number;
    variation?: { h: number, s: number, l: number };
}

export type FlowerPartKind = 'rectangle' | 'kite' | 'center';

export type FlowerPartParams =
    RectangleFlowerPetalParams |
    KiteFlowerPetalParams |
    FlowerCenterParams;


// Branches

export interface CylinderBranchParams {
    kind: 'cylinder';
    variation?: { h: number, s: number, l: number };
}

export interface RectangleBranchParams {
    kind: 'rectangle';
    widthScale?: [number, number];
    variation?: { h: number, s: number, l: number };
    lGradient?: [number, number]; // [base, tip] lightness adjustment
}

export type BranchPartKind = 'cylinder' | 'rectangle';

export type BranchPartParams =
    CylinderBranchParams |
    RectangleBranchParams;


export type PlantPartParams =
    LeafKindParams
    | FlowerPartParams
    | BranchPartParams
