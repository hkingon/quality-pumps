import Papa from 'papaparse';

export interface IFDData {
  duration: number;
  durationLabel: string;
  intensities: Record<string, number>;
}

export interface ParseIFDResult {
  data: IFDData[];
  fileName: string;
  error?: string;
  isDepth?: boolean;
}

/**
 * Parse a BOM IFD CSV string (intensity or depth format) into a structured array.
 * Depth (mm) values are converted to intensity (mm/h) automatically.
 */
export function parseIFDText(csvText: string, fileName = 'BOM_IFD.csv'): ParseIFDResult {
  let parsedData: IFDData[] = [];
  let isDepth = false;

  try {
    const parseResult = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
    if (parseResult.errors.length > 0) {
      return { data: [], fileName, error: 'Error parsing CSV file.' };
    }

    const rows = parseResult.data;
    if (rows.length === 0) {
      return { data: [], fileName, error: 'CSV file is empty.' };
    }

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if (rows[i] && rows[i][0]) {
        const rowStr = rows[i].join(' ').toLowerCase();
        if (rowStr.includes('depth') && rowStr.includes('(mm)')) {
          isDepth = true;
          break;
        }
      }
    }

    let headerRowIndex = -1;
    let aepColumns: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        row[0] &&
        row[0].toLowerCase().includes('duration') &&
        row.some((cell) => cell && cell.includes('%'))
      ) {
        headerRowIndex = i;
        aepColumns = row.slice(2).filter((cell) => cell && cell.includes('%'));
        break;
      }
    }

    if (headerRowIndex === -1 || aepColumns.length === 0) {
      return {
        data: [],
        fileName,
        error: 'Could not find AEP header row. Please check the CSV format.'
      };
    }

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !row[1]) continue;

      const durationLabel = row[0].trim();
      const durationInMinutes = parseFloat(row[1]);
      if (isNaN(durationInMinutes) || durationInMinutes <= 0) continue;

      const intensities: Record<string, number> = {};
      let hasValid = false;

      for (let j = 0; j < aepColumns.length; j++) {
        let val = parseFloat(row[j + 2]);
        if (!isNaN(val) && val > 0) {
          if (isDepth) {
            val = (val * 60) / durationInMinutes;
          }
          intensities[aepColumns[j]] = val;
          hasValid = true;
        }
      }

      if (hasValid) {
        parsedData.push({ duration: durationInMinutes, durationLabel, intensities });
      }
    }

    parsedData.sort((a, b) => a.duration - b.duration);
  } catch {
    return { data: [], fileName, error: 'Error processing CSV data.' };
  }

  return { data: parsedData, fileName, isDepth };
}

/**
 * Interpolate intensity for a target duration and AEP using log-log interpolation.
 */
export function interpolateIntensity(
  csvData: IFDData[],
  targetDuration: number,
  aep: string
): number | null {
  const exact = csvData.find((d) => d.duration === targetDuration);
  if (exact && exact.intensities[aep] !== undefined) return exact.intensities[aep];

  const sorted = csvData
    .filter((d) => d.intensities[aep] !== undefined)
    .sort((a, b) => a.duration - b.duration);

  if (sorted.length === 0) return null;
  if (targetDuration <= sorted[0].duration) return sorted[0].intensities[aep];
  if (targetDuration >= sorted[sorted.length - 1].duration)
    return sorted[sorted.length - 1].intensities[aep];

  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = sorted[i].duration;
    const d2 = sorted[i + 1].duration;
    if (targetDuration >= d1 && targetDuration <= d2) {
      const I1 = sorted[i].intensities[aep];
      const I2 = sorted[i + 1].intensities[aep];
      if (I1 <= 0 || I2 <= 0 || targetDuration <= 0 || d1 <= 0 || d2 <= 0) {
        return I1 + (I2 - I1) * ((targetDuration - d1) / (d2 - d1));
      }
      return Math.exp(
        Math.log(I1) +
          ((Math.log(I2) - Math.log(I1)) * (Math.log(targetDuration) - Math.log(d1))) /
            (Math.log(d2) - Math.log(d1))
      );
    }
  }

  return null;
}

/**
 * Get intensity for a given duration and AEP, with interpolation if needed.
 */
export function getAEPIntensity(
  csvData: IFDData[],
  durationMin: number,
  aep: string
): number | null {
  return interpolateIntensity(csvData, durationMin, aep);
}
