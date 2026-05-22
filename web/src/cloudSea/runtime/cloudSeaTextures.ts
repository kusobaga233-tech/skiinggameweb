function createLcg(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967295;
  };
}

function fillRgba(size: number, sampler: (x: number, y: number) => [number, number, number]): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = sampler(x, y);
      data[offset++] = r;
      data[offset++] = g;
      data[offset++] = b;
      data[offset++] = 255;
    }
  }
  return data;
}

export function createNoiseTextureData(size: number): Uint8Array {
  const random = createLcg(0x51f15e);
  return fillRgba(size, () => {
    const value = Math.floor(random() * 255);
    return [value, value, value];
  });
}

export function createOverlayTextureData(size: number): Uint8Array {
  const random = createLcg(0xc10d5ea);
  return fillRgba(size, (x, y) => {
    const u = x / Math.max(1, size - 1);
    const v = y / Math.max(1, size - 1);
    const grain = random() * 0.05 + random() * 0.03;
    const vignette = Math.pow(16.0 * u * v * (1.0 - u) * (1.0 - v), 0.2);
    const tone = 0.5 + 0.5 * Math.min(1, vignette) + grain;
    const warm = Math.min(1, tone * 0.99);
    const green = Math.min(1, tone * 0.97);
    const blue = Math.min(1, tone * 0.95);
    return [Math.floor(warm * 255), Math.floor(green * 255), Math.floor(blue * 255)];
  });
}
