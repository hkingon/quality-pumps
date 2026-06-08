import { NextResponse } from 'next/server';
import https from 'https';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function logToFile(msg: string) {
  try {
    fs.appendFileSync(
      path.join(process.cwd(), 'api_run.log'),
      `[${new Date().toISOString()}] ${msg}\n`
    );
  } catch (e) {}
}

function getHTML(url: string, headers: Record<string, string>): Promise<{ statusCode?: number; data: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data
        });
      });
    }).on('error', reject);
  });
}

export async function GET(request: Request) {
  logToFile('GET handler triggered');
  try {
    const { searchParams } = new URL(request.url);
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const label = searchParams.get('label') || 'Site';

    logToFile(`Params received: lat=${latitude}, lon=${longitude}, label=${label}`);

    if (!latitude || !longitude) {
      logToFile('Missing parameters error');
      return NextResponse.json(
        { error: 'Latitude and Longitude query parameters are required.' },
        { status: 400 }
      );
    }

    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lonNum)) {
      logToFile('Invalid coordinates format error');
      return NextResponse.json(
        { error: 'Latitude and Longitude must be valid numbers.' },
        { status: 400 }
      );
    }

    const queryUrl = `https://www.bom.gov.au/water/designRainfalls/revised-ifd/?year=2016&coordinate_type=dd&latitude=${latNum}&longitude=${lonNum}&sdmin=true&sdhr=true&sdday=true&user_label=${encodeURIComponent(label)}`;
    logToFile(`Querying BOM URL: ${queryUrl}`);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    const response = await getHTML(queryUrl, headers);
    logToFile(`BOM Response status: ${response.statusCode}`);

    if (response.statusCode !== 200) {
      logToFile(`BOM returned non-200 status`);
      return NextResponse.json(
        { error: `Bureau of Meteorology server returned status ${response.statusCode}.` },
        { status: response.statusCode || 500 }
      );
    }

    const html = response.data;

    // Extract link
    const regex = /class=['"]ifdDownloadCsv csvDownloadIcon['"]\s+href=['"]([^'"]+)['"]/i;
    let match = html.match(regex);

    if (!match) {
      const regexAlt = /href=['"]([^'"]+save=table[^'"]+)['"]/i;
      match = html.match(regexAlt);
    }

    if (!match) {
      if (html.includes('outside the bounds') || html.includes('outside of the grid') || html.includes('error')) {
        logToFile('Coordinates outside bounds error');
        return NextResponse.json(
          { error: 'Coordinates are outside the Bureau of Meteorology grid bounds. BOM design rainfalls only cover Australia.' },
          { status: 400 }
        );
      }
      logToFile('CSV link not found error');
      return NextResponse.json(
        { error: 'Could not find the CSV download link on the BOM page. The coordinates might be outside Australia.' },
        { status: 404 }
      );
    }

    const relativeUrl = match[1].replace(/&amp;/g, '&');
    const downloadUrl = `https://www.bom.gov.au/water/designRainfalls/revised-ifd/${relativeUrl}`;
    logToFile(`Downloading CSV from: ${downloadUrl}`);

    const downloadResponse = await getHTML(downloadUrl, {
      ...headers,
      'Referer': queryUrl
    });
    logToFile(`Download CSV response status: ${downloadResponse.statusCode}`);

    if (downloadResponse.statusCode !== 200) {
      logToFile(`Download CSV failed status`);
      return NextResponse.json(
        { error: `BOM CSV download failed with status ${downloadResponse.statusCode}.` },
        { status: downloadResponse.statusCode || 500 }
      );
    }

    const csvText = downloadResponse.data;
    logToFile(`Successfully downloaded CSV, length = ${csvText.length}`);

    return new NextResponse(csvText, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bom-ifd-${latitude}-${longitude}.csv"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    logToFile(`Exception caught: ${error.message}\nStack: ${error.stack}`);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error while fetching BOM IFD data.' },
      { status: 500 }
    );
  }
}
