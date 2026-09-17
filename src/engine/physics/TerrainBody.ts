/**
 * TerrainBody — Static Matter.js body for the planetary surface.
 *
 * Generates procedural terrain geometry using a seeded Perlin-like noise
 * function. The terrain is built as a series of connected static bodies
 * forming an irregular surface profile.
 *
 * For canyon levels (Serpentine Rifts), vertical wall bodies are added.
 */

import Matter from "matter-js";

export interface TerrainOptions {
  /** Canvas width in pixels */
  width: number;
  /** Y position of the flat terrain reference level (from top) */
  surfaceY: number;
  /** Procedural noise seed */
  seed: number;
  /** Terrain roughness [0=flat, 1=very rough] */
  roughness: number;
  /** Whether to add canyon walls */
  hasCanyonWalls: boolean;
}

export interface TerrainResult {
  bodies: Matter.Body[];
  /** Y positions of terrain at each x sample (for visual rendering) */
  heightmap: number[];
  /** X step between heightmap samples */
  sampleStep: number;
}

/**
 * Create static terrain bodies for the physics world.
 * Also returns heightmap data for PixiJS rendering.
 */
export function createTerrainBodies(options: TerrainOptions): TerrainResult {
  const { width, surfaceY, seed, roughness, hasCanyonWalls } = options;

  const SAMPLE_COUNT = 60;
  const sampleStep = width / SAMPLE_COUNT;
  const heightmap: number[] = [];

  const rng = mulberry32(seed);

  // Generate heightmap using simple 1D noise
  // Start with a flat base, add octaves of noise
  const baseNoise: number[] = [];
  let runningVal = 0;
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    runningVal += (rng() - 0.5) * 2;
    runningVal *= 0.85; // damping to prevent drift
    baseNoise.push(runningVal);
  }

  // Normalize and scale by roughness
  const maxAbsNoise = Math.max(...baseNoise.map(Math.abs), 1);
  const maxHeightVariation = roughness * 60; // pixels

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const normalizedNoise = baseNoise[i] / maxAbsNoise;
    heightmap.push(surfaceY + normalizedNoise * maxHeightVariation);
  }

  // Create terrain as a series of thin static rectangles connecting height samples
  const bodies: Matter.Body[] = [];

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const x1 = i * sampleStep;
    const x2 = (i + 1) * sampleStep;
    const y1 = heightmap[i];
    const y2 = heightmap[i + 1];

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const segment = Matter.Bodies.rectangle(midX, midY + 30, length, 60, {
      isStatic: true,
      angle,
      label: "terrain",
      friction: 0.8,
      restitution: 0.05,
      collisionFilter: { category: 0x0002, mask: 0x0001 },
    });

    bodies.push(segment);
  }

  // Solid bedrock base plate: massive collision volume extending 2000px below surface
  // to ensure extreme velocity drops never tunnel through the planetary crust
  const bedrock = Matter.Bodies.rectangle(width / 2, surfaceY + 1000, width * 3, 2000, {
    isStatic: true,
    label: "terrain-bedrock",
    friction: 0.9,
    restitution: 0.01,
    collisionFilter: { category: 0x0002, mask: 0x0001 },
  });
  bodies.push(bedrock);

  // Canyon walls (for Serpentine Rifts)
  if (hasCanyonWalls) {
    const wallHeight = 400;
    const leftWall = Matter.Bodies.rectangle(-30, surfaceY - wallHeight / 2, 60, wallHeight, {
      isStatic: true,
      label: "terrain-wall",
      friction: 0.5,
      collisionFilter: { category: 0x0002, mask: 0x0001 },
    });
    const rightWall = Matter.Bodies.rectangle(
      width + 30,
      surfaceY - wallHeight / 2,
      60,
      wallHeight,
      {
        isStatic: true,
        label: "terrain-wall",
        friction: 0.5,
        collisionFilter: { category: 0x0002, mask: 0x0001 },
      },
    );
    bodies.push(leftWall, rightWall);
  }

  return { bodies, heightmap, sampleStep };
}

/** Fast seeded pseudo-random number generator */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
