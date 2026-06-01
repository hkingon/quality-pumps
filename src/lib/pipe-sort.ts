export function sortPipeSizesByNominal<T extends { nominal_size: string }>(
  sizes: T[]
): T[] {
  return [...sizes].sort((a, b) => {
    const numA = parseFloat(a.nominal_size);
    const numB = parseFloat(b.nominal_size);
    const isNumA = !Number.isNaN(numA);
    const isNumB = !Number.isNaN(numB);

    if (isNumA && isNumB) {
      return numA - numB;
    }
    if (isNumA && !isNumB) {
      return -1;
    }
    if (!isNumA && isNumB) {
      return 1;
    }
    return a.nominal_size.localeCompare(b.nominal_size);
  });
}
