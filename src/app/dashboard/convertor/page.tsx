// 'use client'
// import React, { Suspense, useState } from 'react';
// // import Papa from 'papaparse';
// import { Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';
// import PageContainer from '@/components/layout/page-container';
// import { Heading } from '@/components/ui/heading';
// import { Separator } from '@/components/ui/separator';

// const CSVToRainfallArrayConverter = () => {
//   const [uploadedFiles, setUploadedFiles] = useState([]);
//   const [processedData, setProcessedData] = useState(null);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [selectedCityIndex, setSelectedCityIndex] = useState('');
//   const [selectedDuration, setSelectedDuration] = useState('');
//   const [selectedAEP, setSelectedAEP] = useState('');
//   const [lookupResult, setLookupResult] = useState(null);

//   // Function to process a single CSV file and extract rainfall data
//   const processRainfallCSV = (csvContent, fileName) => {
//     try {
//       const lines = csvContent.split('\n');
      
//       // Extract city name from filename or location label
//       let cityName = fileName.replace(/intensities_|_ifds\.csv|\.csv/g, '').replace(/_/g, ' ');
//       const locationLine = lines.find(line => line.includes('Location Label:'));
//       if (locationLine) {
//         const match = locationLine.match(/Location Label:,\s*(.+)/);
//         if (match) cityName = match[1].trim();
//       }

//       // Extract coordinates
//       const coordLine = lines.find(line => line.includes('Requested coordinate'));
//       let latitude = null, longitude = null;
//       if (coordLine) {
//         const latMatch = coordLine.match(/Latitude,([^,]+)/);
//         const lonMatch = coordLine.match(/Longitude,([^,]+)/);
//         latitude = latMatch ? parseFloat(latMatch[1]) : null;
//         longitude = lonMatch ? parseFloat(lonMatch[1]) : null;
//       }

//       // Find the header row (contains "Duration,Duration in min")
//       const headerIndex = lines.findIndex(line => line.includes('Duration,Duration in min'));
//       if (headerIndex === -1) {
//         throw new Error('Invalid CSV format: Header row not found');
//       }

//       const headers = lines[headerIndex].split(',').map(h => h.trim());
//       const aepColumns = headers.slice(2); // Skip "Duration" and "Duration in min"

//       const cityObject = {
//         label: cityName,
//         coordinates: {
//           latitude: latitude,
//           longitude: longitude
//         },
//         data: {}
//       };

//       // Process data rows
//       for (let i = headerIndex + 1; i < lines.length; i++) {
//         const line = lines[i].trim();
//         if (!line || line.startsWith('Copyright')) continue;

//         const values = line.split(',').map(v => v.trim());
//         if (values.length < 3) continue;

//         const duration = values[0];
//         const durationMin = values[1];
        
//         if (duration && durationMin && !isNaN(parseInt(durationMin))) {
//           cityObject.data[duration] = {
//             durationInMin: parseInt(durationMin),
//             aepValues: {}
//           };

//           // Map AEP percentages to their values
//           for (let j = 2; j < values.length && j - 2 < aepColumns.length; j++) {
//             const aepPercent = aepColumns[j - 2];
//             const value = values[j];
//             if (value && !isNaN(parseFloat(value))) {
//               cityObject.data[duration].aepValues[aepPercent] = parseFloat(value);
//             }
//           }
//         }
//       }

//       return cityObject;
//     } catch (error) {
//       console.error(`Error processing CSV for ${fileName}:`, error);
//       throw error;
//     }
//   };

//   // Handle file upload
//   const handleFileUpload = (event) => {
//     const files = Array.from(event.target.files);
//     setUploadedFiles(files);
//     setProcessedData(null);
//     setLookupResult(null);
//     setSelectedCityIndex('');
//   };

//   // Process all uploaded CSV files into an array
//   const processFiles = async () => {
//     if (uploadedFiles.length === 0) return;

//     setIsProcessing(true);
//     const citiesArray = [];

//     try {
//       for (const file of uploadedFiles) {
//         const csvContent = await new Promise((resolve, reject) => {
//           const reader = new FileReader();
//           reader.onload = (e) => resolve(e.target.result);
//           reader.onerror = reject;
//           reader.readAsText(file);
//         });

//         const cityObject = processRainfallCSV(csvContent, file.name);
//         citiesArray.push(cityObject);
//       }

//       setProcessedData(citiesArray);
//     } catch (error) {
//       alert(`Error processing files: ${error.message}`);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   // Handle lookup
//   const handleLookup = () => {
//     if (processedData && selectedCityIndex !== '' && selectedDuration && selectedAEP) {
//       const cityData = processedData[parseInt(selectedCityIndex)];
//       if (cityData && cityData.data[selectedDuration] && cityData.data[selectedDuration].aepValues[selectedAEP]) {
//         setLookupResult(cityData.data[selectedDuration].aepValues[selectedAEP]);
//       } else {
//         setLookupResult('Data not found');
//       }
//     }
//   };

//   // Download JSON array
//   const downloadJSON = () => {
//     if (processedData) {
//       const blob = new Blob([JSON.stringify(processedData, null, 2)], { type: 'application/json' });
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = 'rainfall_cities_array.json';
//       a.click();
//       URL.revokeObjectURL(url);
//     }
//   };

//   return (
//     <PageContainer>
//       <div className='flex flex-1 flex-col space-y-6'>
//         <Heading title='Convertor(For development only)' description='Converts the CSV to json' />
//         <Separator />
//         <Suspense
//           fallback={
//             <div className='text-muted-foreground text-sm'>
//               Loading calculator...
//             </div>
//           }
//         >
//           <div className=''>
//             <h1 className='mb-6 flex items-center gap-2 text-3xl font-bold '>
//               <FileText className='text-blue-500' />
//               CSV to Rainfall Cities Array Converter
//             </h1>

//             {/* File Upload Section */}
//             <div className='mb-6 rounded-lg bg-blue-50 p-6'>
//               <h2 className='mb-4 flex items-center gap-2 text-xl font-semibold text-gray-700'>
//                 <Upload className='text-blue-500' />
//                 Upload CSV Files
//               </h2>

//               <div className='rounded-lg border-2 border-dashed border-blue-300 p-8 text-center'>
//                 <input
//                   type='file'
//                   multiple
//                   accept='.csv'
//                   onChange={handleFileUpload}
//                   className='hidden'
//                   id='csv-upload'
//                 />
//                 <label htmlFor='csv-upload' className='cursor-pointer'>
//                   <div className='flex flex-col items-center gap-4'>
//                     <Upload className='h-12 w-12 text-blue-400' />
//                     <div>
//                       <p className='text-lg font-medium text-gray-700'>
//                         Click to upload multiple CSV files
//                       </p>
//                       <p className='text-sm text-gray-500'>
//                         Each CSV will become a separate object in the array
//                       </p>
//                     </div>
//                   </div>
//                 </label>
//               </div>

//               {uploadedFiles.length > 0 && (
//                 <div className='mt-4'>
//                   <h3 className='mb-2 font-medium text-gray-700'>
//                     Uploaded Files ({uploadedFiles.length}):
//                   </h3>
//                   <div className='space-y-2'>
//                     {uploadedFiles.map((file, index) => (
//                       <div
//                         key={index}
//                         className='flex items-center gap-2 rounded border bg-white p-2'
//                       >
//                         <CheckCircle className='h-4 w-4 text-green-500' />
//                         <span className='text-sm font-medium'>
//                           #{index + 1}
//                         </span>
//                         <span className='text-sm'>{file.name}</span>
//                         <span className='text-xs text-gray-500'>
//                           ({(file.size / 1024).toFixed(1)} KB)
//                         </span>
//                       </div>
//                     ))}
//                   </div>

//                   <button
//                     onClick={processFiles}
//                     disabled={isProcessing}
//                     className='mt-4 flex items-center gap-2 rounded bg-blue-500 px-6 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400'
//                   >
//                     {isProcessing ? (
//                       <>
//                         <div className='h-4 w-4 animate-spin rounded-full border-b-2 border-white'></div>
//                         Processing {uploadedFiles.length} files...
//                       </>
//                     ) : (
//                       <>
//                         <FileText className='h-4 w-4' />
//                         Process {uploadedFiles.length} Files
//                       </>
//                     )}
//                   </button>
//                 </div>
//               )}
//             </div>

//             {/* Results Section */}
//             {processedData && (
//               <div className='space-y-6'>
//                 {/* Download Section */}
//                 <div className='rounded-lg bg-green-50 p-4'>
//                   <div className='flex items-center justify-between'>
//                     <div className='flex items-center gap-2'>
//                       <CheckCircle className='h-5 w-5 text-green-500' />
//                       <span className='font-medium text-green-700'>
//                         Successfully processed {processedData.length} cities
//                         into array format
//                       </span>
//                     </div>
//                     <button
//                       onClick={downloadJSON}
//                       className='flex items-center gap-2 rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600'
//                     >
//                       <Download className='h-4 w-4' />
//                       Download Array JSON
//                     </button>
//                   </div>
//                 </div>

//                 {/* Array Structure Preview */}
//                 <div className='rounded-lg bg-purple-50 p-4'>
//                   <h3 className='mb-2 font-medium text-purple-800'>
//                     Array Structure Info:
//                   </h3>
//                   <div className='space-y-1 text-sm text-purple-700'>
//                     <p>
//                       • <strong>Array Length:</strong> {processedData.length}{' '}
//                       cities
//                     </p>
//                     <p>
//                       • <strong>Access Pattern:</strong>{' '}
//                       <code className='rounded bg-purple-100 px-1'>
//                         citiesArray[0].data["5 min"].aepValues["1%"]
//                       </code>
//                     </p>
//                     <p>
//                       • <strong>City Names:</strong>{' '}
//                       {processedData.map((city) => city.label).join(', ')}
//                     </p>
//                   </div>
//                 </div>

//                 {/* Lookup Tool */}
//                 <div className='rounded-lg bg-blue-50 p-6'>
//                   <h2 className='mb-4 text-xl font-semibold text-gray-700'>
//                     Test Array Lookup Tool
//                   </h2>
//                   <div className='mb-4 grid grid-cols-1 gap-4 md:grid-cols-4'>
//                     <div>
//                       <label className='mb-2 block text-sm font-medium text-gray-700'>
//                         City (Array Index)
//                       </label>
//                       <select
//                         value={selectedCityIndex}
//                         onChange={(e) => setSelectedCityIndex(e.target.value)}
//                         className='w-full rounded border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500'
//                       >
//                         <option value=''>Select City</option>
//                         {processedData.map((city, index) => (
//                           <option key={index} value={index}>
//                             [{index}] {city.label}
//                           </option>
//                         ))}
//                       </select>
//                     </div>

//                     <div>
//                       <label className='mb-2 block text-sm font-medium text-gray-700'>
//                         Duration
//                       </label>
//                       <select
//                         value={selectedDuration}
//                         onChange={(e) => setSelectedDuration(e.target.value)}
//                         className='w-full rounded border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500'
//                         disabled={selectedCityIndex === ''}
//                       >
//                         <option value=''>Select Duration</option>
//                         {selectedCityIndex !== '' &&
//                           processedData[parseInt(selectedCityIndex)] &&
//                           Object.keys(
//                             processedData[parseInt(selectedCityIndex)].data
//                           ).map((duration) => (
//                             <option key={duration} value={duration}>
//                               {duration}
//                             </option>
//                           ))}
//                       </select>
//                     </div>

//                     <div>
//                       <label className='mb-2 block text-sm font-medium text-gray-700'>
//                         AEP %
//                       </label>
//                       <select
//                         value={selectedAEP}
//                         onChange={(e) => setSelectedAEP(e.target.value)}
//                         className='w-full rounded border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500'
//                         disabled={!selectedDuration}
//                       >
//                         <option value=''>Select AEP %</option>
//                         {selectedCityIndex !== '' &&
//                           selectedDuration &&
//                           processedData[parseInt(selectedCityIndex)] &&
//                           processedData[parseInt(selectedCityIndex)].data[
//                             selectedDuration
//                           ] &&
//                           Object.keys(
//                             processedData[parseInt(selectedCityIndex)].data[
//                               selectedDuration
//                             ].aepValues
//                           ).map((aep) => (
//                             <option key={aep} value={aep}>
//                               {aep}
//                             </option>
//                           ))}
//                       </select>
//                     </div>

//                     <div className='flex items-end'>
//                       <button
//                         onClick={handleLookup}
//                         disabled={
//                           selectedCityIndex === '' ||
//                           !selectedDuration ||
//                           !selectedAEP
//                         }
//                         className='w-full rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400'
//                       >
//                         Lookup Value
//                       </button>
//                     </div>
//                   </div>

//                   {lookupResult !== null && (
//                     <div className='rounded border-l-4 border-green-500 bg-white p-4'>
//                       <h3 className='font-semibold text-gray-700'>
//                         Array Access Result:
//                       </h3>
//                       <p className='mb-1 text-sm text-gray-600'>
//                         <code>
//                           citiesArray[{selectedCityIndex}].data["
//                           {selectedDuration}"].aepValues["{selectedAEP}"]
//                         </code>
//                       </p>
//                       <p className='text-2xl font-bold text-green-600'>
//                         {processedData[parseInt(selectedCityIndex)]?.label} -{' '}
//                         {selectedDuration} - {selectedAEP}: {lookupResult} mm/h
//                       </p>
//                     </div>
//                   )}
//                 </div>

//                 {/* Cities Array Summary */}
//                 <div className='rounded-lg bg-gray-50 p-4'>
//                   <h2 className='mb-4 text-xl font-semibold text-gray-700'>
//                     Cities Array Summary
//                   </h2>
//                   <div className='space-y-3'>
//                     {processedData.map((cityData, index) => (
//                       <div
//                         key={index}
//                         className='flex items-center justify-between rounded border bg-white p-4'
//                       >
//                         <div>
//                           <h3 className='text-lg font-bold text-gray-800'>
//                             [{index}] {cityData.label}
//                           </h3>
//                           <p className='text-sm text-gray-600'>
//                             Coordinates: {cityData.coordinates.latitude},{' '}
//                             {cityData.coordinates.longitude}
//                           </p>
//                           <p className='text-sm text-gray-600'>
//                             Durations: {Object.keys(cityData.data).length} | AEP
//                             Options:{' '}
//                             {Object.keys(
//                               Object.values(cityData.data)[0]?.aepValues || {}
//                             ).join(', ')}
//                           </p>
//                         </div>
//                         <div className='text-2xl font-bold text-blue-500'>
//                           #{index}
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>

//                 {/* JSON Array Preview */}
//                 <div className='rounded-lg bg-gray-50 p-4'>
//                   <h2 className='mb-4 text-xl font-semibold text-gray-700'>
//                     JSON Array Preview
//                   </h2>
//                   <div className='rounded border bg-white p-4'>
//                     <p className='mb-2 text-sm text-gray-600'>
//                       Array with {processedData.length} city objects:
//                     </p>
//                     <pre className='max-h-96 overflow-auto text-xs'>
//                       {JSON.stringify(processedData, null, 2)}
//                     </pre>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Instructions */}
//             <div className='mt-6 rounded-lg bg-yellow-50 p-4'>
//               <div className='flex items-start gap-2'>
//                 <AlertCircle className='mt-0.5 h-5 w-5 text-yellow-600' />
//                 <div>
//                   <h3 className='mb-2 font-medium text-yellow-800'>
//                     Array Format Instructions:
//                   </h3>
//                   <ul className='space-y-1 text-sm text-yellow-700'>
//                     <li>
//                       • Upload multiple CSV files - each becomes an array
//                       element
//                     </li>
//                     <li>
//                       • Final output:{' '}
//                       <code className='rounded bg-yellow-100 px-1'>
//                         [cityObj1, cityObj2, cityObj3, ...]
//                       </code>
//                     </li>
//                     <li>
//                       • Access pattern:{' '}
//                       <code className='rounded bg-yellow-100 px-1'>
//                         citiesArray[index].data[duration].aepValues[aep]
//                       </code>
//                     </li>
//                     <li>
//                       • Perfect for iterating through cities with{' '}
//                       <code className='rounded bg-yellow-100 px-1'>
//                         map(), forEach()
//                       </code>{' '}
//                       etc.
//                     </li>
//                     <li>
//                       • Each city object maintains the same structure as before
//                     </li>
//                   </ul>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </Suspense>
//       </div>
//     </PageContainer>
//   );
// };

// export default CSVToRainfallArrayConverter;

const page = () => {
  return (
    <div>
      <p>Heloo</p>
    </div>
  )
}

export default page
