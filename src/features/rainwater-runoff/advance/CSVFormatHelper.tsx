'use client';

// import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CSVFormatHelper() {
  const downloadSampleCSV = () => {
    const link = document.createElement('a');
    link.href = '/sample-idf.csv';
    link.download = 'intensity-duration-sample.csv';
    link.click();
  };

  return (
    <Card className='border-2 border-dashed'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <FileText className='h-5 w-5' />
          CSV Format Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div>
          <h4 className='mb-2 font-medium'>Required CSV Structure:</h4>
          <ul className='text-muted-foreground list-inside list-disc space-y-1 text-sm'>
            <li>
              <strong>Duration</strong> column: Time in minutes (e.g., 5, 10,
              15, 30, 60)
            </li>
            <li>
              <strong>Intensity</strong> column: Rainfall intensity in mm/hr
              (e.g., 120.5, 95.2)
            </li>
            <li>Headers can be: Duration/Time and Intensity/Rainfall</li>
            <li>CSV should be comma-separated with headers in the first row</li>
            <li>All values must be numeric and greater than 0</li>
          </ul>
        </div>

        {/* <div>
          <h4 className="font-medium mb-2">Sample Data Preview:</h4>
          <div className="max-h-64 overflow-y-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Duration (minutes)</TableHead>
                  <TableHead>Intensity (mm/hr)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>{row.intensity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div> */}

        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={downloadSampleCSV}
            className='flex cursor-pointer items-center gap-1'
          >
            <Download className='h-4 w-4' />
            Download Sample CSV
          </Button>
        </div>

        <div className='rounded border border-amber-200 bg-amber-50 p-3 text-sm'>
          <strong className='text-amber-800'>Important:</strong>
          <p className='mt-1 text-amber-700'>
            The intensity-duration data should represent the rainfall
            intensities for different storm durations specific to your
            geographic location and selected AEP/ARI event. This data is
            typically obtained from meteorological agencies or engineering
            rainfall databases.
          </p>
        </div>

        <div className='rounded border border-sky-200 bg-sky-50 p-3 text-sm'>
          <strong className='text-sky-800'>
            How to Download CSV from the BOM Website:
          </strong>
          <ol className='mt-1 list-inside list-decimal space-y-1 text-sky-700'>
            <li>
              Go to:{' '}
              <a
                href='http://www.bom.gov.au/water/designRainfalls/revised-ifd/'
                target='_blank'
                className='text-blue-600 underline'
              >
                http://www.bom.gov.au/water/designRainfalls/revised-ifd/
              </a>
            </li>
            <li>
              On the left sidebar, click <strong>Select from Map</strong> under
              the Search.
            </li>
            <li>Click anywhere on the map to choose your location/region.</li>
            <li>Once selected, the coordinates will populate in the fields.</li>
            <li>
              Click <strong>“Submit”</strong> on the left panel to generate
              results.
            </li>
            <li>
              In the right-hand results table, change the unit from{' '}
              <strong>mm</strong> to <strong>mm/hr</strong> using the dropdown
              menu above the table.
            </li>
            <li>
              Once the table updates, click the{' '}
              <strong>CSV download icon</strong> at the top right of the table
              to download your data.
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
