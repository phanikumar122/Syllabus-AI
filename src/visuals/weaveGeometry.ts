// Five open, pleated course ribbons converge through a braided waist.
// Authored parametrically; no stock sphere, torus, or imported model.
export const WEAVE_STEPS = 120;
export const WEAVE_COLUMNS = 6;
export const WEAVE_PALETTE = [0x27fb6b, 0xb4f8c5, 0x52683b, 0xf3f7ed, 0x75b95d];

export function weavePoint(
  t: number,
  across: number,
  strand: number,
  phase: number,
): [number, number, number] {
  const angle = (strand * Math.PI * 2) / 5 + t * Math.PI * 2.3;
  const flare = Math.pow(Math.abs(2 * t - 1), 1.4);
  const breath = Math.sin(phase * 0.65 + t * Math.PI * 2 + strand * 0.6);
  const radius = 0.54 + 0.66 * flare + 0.09 * breath * Math.sin(Math.PI * t);
  const width = 0.13 + 0.33 * flare;
  const fold = Math.sin(across * Math.PI) * width * 0.22;
  return [
    radius * Math.cos(angle) +
      across * width * Math.cos(angle + 0.8) +
      0.23 * Math.sin(t * Math.PI),
    (t - 0.5) * 3.65 + across * width * Math.sin(angle * 0.7) + fold,
    radius * Math.sin(angle) * 0.78 +
      across * width * Math.sin(angle + 0.8) +
      fold,
  ];
}

export function fillWeavePositions(
  positions: Float32Array,
  strand: number,
  phase: number,
) {
  for (let row = 0; row <= WEAVE_STEPS; row++) {
    for (let col = 0; col <= WEAVE_COLUMNS; col++) {
      const point = weavePoint(
        row / WEAVE_STEPS,
        (col / WEAVE_COLUMNS) * 2 - 1,
        strand,
        phase,
      );
      positions.set(point, (row * (WEAVE_COLUMNS + 1) + col) * 3);
    }
  }
}

export function createWeaveData(strand: number, phase = 0) {
  const positions = new Float32Array(
    (WEAVE_STEPS + 1) * (WEAVE_COLUMNS + 1) * 3,
  );
  fillWeavePositions(positions, strand, phase);
  const indices = new Uint16Array(WEAVE_STEPS * WEAVE_COLUMNS * 6);
  let cursor = 0;
  for (let row = 0; row < WEAVE_STEPS; row++) {
    for (let col = 0; col < WEAVE_COLUMNS; col++) {
      const a = row * (WEAVE_COLUMNS + 1) + col,
        b = a + WEAVE_COLUMNS + 1;
      indices.set([a, b, a + 1, b, b + 1, a + 1], cursor);
      cursor += 6;
    }
  }
  return { positions, indices };
}
