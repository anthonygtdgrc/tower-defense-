export const BIOMES = {
  valley: {
    id: 'valley', name: 'Vallée Assiégée',
    groundColor: 0x3d5a3d, pathColor: 0x8a7355, fogColor: 0x9fb8c8,
    obstacleColor: 0x5a6b4f, obstacleType: 'rock'
  },
  forest: {
    id: 'forest', name: 'Forêt Maudite',
    groundColor: 0x1f3320, pathColor: 0x4a3d2a, fogColor: 0x1a2a1f,
    obstacleColor: 0x2d1f14, obstacleType: 'tree'
  },
  desert: {
    id: 'desert', name: 'Désert Brûlant',
    groundColor: 0xc9a862, pathColor: 0xa8895a, fogColor: 0xe8d5a3,
    obstacleColor: 0x8a6d3f, obstacleType: 'dune'
  }
};

// Grid size (cells) and lane start cells (up to 3) toward the central base.
export const LEVEL_LAYOUT = {
  gridSize: 32,
  base: { col: 16, row: 16 },
  laneStarts: [
    { col: 16, row: 1 },  // north
    { col: 30, row: 16 }, // east
    { col: 1, row: 16 }   // west
  ],
  // Static obstacle cells (decorative + tactical), kept clear of the base
  // and lane-start columns/rows so at least a straight fallback lane exists.
  obstacles: [
    { col: 10, row: 10 }, { col: 11, row: 10 }, { col: 21, row: 10 }, { col: 22, row: 10 },
    { col: 10, row: 22 }, { col: 11, row: 22 }, { col: 21, row: 22 }, { col: 22, row: 22 },
    { col: 6, row: 6 }, { col: 25, row: 6 }, { col: 6, row: 25 }, { col: 25, row: 25 },
    { col: 16, row: 8 }, { col: 8, row: 16 }, { col: 24, row: 16 }, { col: 16, row: 24 }
  ]
};
