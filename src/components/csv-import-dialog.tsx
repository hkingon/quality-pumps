'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';

interface CSVRow {
  brand: string;
  model: string;
  kw: string;
  inlet: string;
  outlet: string;
  configuration: string;
  type: string;
  voltage: string;
  amps: string;
  phases: string;
  max_temp: string;
  head_1?: string;
  flow_1?: string;
  head_2?: string;
  flow_2?: string;
  head_3?: string;
  flow_3?: string;
  head_4?: string;
  flow_4?: string;
  head_5?: string;
  flow_5?: string;
  npshr_head_1?: string;
  npshr_flow_1?: string;
  npshr_head_2?: string;
  npshr_flow_2?: string;
  npshr_head_3?: string;
  npshr_flow_3?: string;
  efficiency_1?: string;
  efficiency_flow_1?: string;
  efficiency_2?: string;
  efficiency_flow_2?: string;
  efficiency_3?: string;
  efficiency_flow_3?: string;
  power_kw_1?: string;
  power_flow_1?: string;
  power_kw_2?: string;
  power_flow_2?: string;
  power_kw_3?: string;
  power_flow_3?: string;
}

interface CSVImportDialogProps {
  onImportComplete: () => void;
}

export const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  onImportComplete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Download sample template
  const downloadTemplate = () => {
    const sampleData = [
      {
        brand: 'Sample Brand',
        model: 'SP100',
        kw: '5.5',
        inlet: '80',
        outlet: '65',
        configuration: 'Horizontal',
        type: 'Centrifugal',
        voltage: '415',
        amps: '10.5',
        phases: '3',
        max_temp: '60',
        head_1: '45',
        flow_1: '0',
        head_2: '40',
        flow_2: '50',
        head_3: '35',
        flow_3: '100',
        head_4: '25',
        flow_4: '150',
        head_5: '0',
        flow_5: '180',
        npshr_head_1: '2.5',
        npshr_flow_1: '0',
        npshr_head_2: '3.0',
        npshr_flow_2: '100',
        npshr_head_3: '4.5',
        npshr_flow_3: '180',
        efficiency_1: '65',
        efficiency_flow_1: '50',
        efficiency_2: '78',
        efficiency_flow_2: '100',
        efficiency_3: '72',
        efficiency_flow_3: '150',
        power_kw_1: '2.5',
        power_flow_1: '50',
        power_kw_2: '4.2',
        power_flow_2: '100',
        power_kw_3: '6.8',
        power_flow_3: '150'
      }
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'pump_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Template downloaded successfully!');
  };

  // Process CSV data
  const processPumpData = (row: CSVRow) => {
    // Parse performance points (PvsQ)
    const pvsq = [];
    for (let i = 1; i <= 5; i++) {
      const head = row[`head_${i}` as keyof CSVRow];
      const flow = row[`flow_${i}` as keyof CSVRow];
      if (head && flow && !isNaN(Number(head)) && !isNaN(Number(flow))) {
        pvsq.push({
          head: Number(head),
          flow: Number(flow)
        });
      }
    }

    // Parse NPSHR points
    const npshr = [];
    for (let i = 1; i <= 3; i++) {
      const head = row[`npshr_head_${i}` as keyof CSVRow];
      const flow = row[`npshr_flow_${i}` as keyof CSVRow];
      if (head && flow && !isNaN(Number(head)) && !isNaN(Number(flow))) {
        npshr.push({
          head: Number(head),
          flow: Number(flow)
        });
      }
    }

    // Parse efficiency points
    const efficiency = [];
    for (let i = 1; i <= 3; i++) {
      const eff = row[`efficiency_${i}` as keyof CSVRow];
      const flow = row[`efficiency_flow_${i}` as keyof CSVRow];
      if (eff && flow && !isNaN(Number(eff)) && !isNaN(Number(flow))) {
        efficiency.push({
          eff: eff,
          flow: flow
        });
      }
    }

    // Parse motor power points
    const motor_power = [];
    for (let i = 1; i <= 3; i++) {
      const kw = row[`power_kw_${i}` as keyof CSVRow];
      const flow = row[`power_flow_${i}` as keyof CSVRow];
      if (kw && flow && !isNaN(Number(kw)) && !isNaN(Number(flow))) {
        motor_power.push({
          kw: Number(kw),
          flow: Number(flow)
        });
      }
    }

    return {
      brand: row.brand?.trim() || '',
      model: row.model?.trim() || '',
      kw: Number(row.kw) || 0,
      inlet: Number(row.inlet) || 0,
      outlet: Number(row.outlet) || 0,
      configuration: row.configuration?.trim() || '',
      type: row.type?.trim() || '',
      voltage: Number(row.voltage) || 0,
      amps: Number(row.amps) || 0,
      phases: Number(row.phases) || 0,
      max_temp: Number(row.max_temp) || 0,
      pvsq,
      npshr,
      efficiency,
      motor_power,
      is_public: false,
      user_id: user?.id
    };
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      toast.error('Please login to import pumps');
      return;
    }

    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const pumpsToInsert = [];
          const errors: string[] = [];

          for (let i = 0; i < results.data.length; i++) {
            const row = results.data[i] as CSVRow;

            // Validate required fields
            if (!row.brand || !row.model) {
              errors.push(`Row ${i + 2}: Brand and Model are required`);
              continue;
            }

            const pumpData = processPumpData(row);
            pumpsToInsert.push(pumpData);
          }

          if (errors.length > 0) {
            toast.error(`Validation errors: ${errors.join(', ')}`);
            setIsUploading(false);
            return;
          }

          console.log('the pumpsToInsert::', pumpsToInsert);

          // Insert pumps to Supabase
          const { data, error } = await supabase
            .from('pumps')
            .insert(pumpsToInsert);

          if (error) {
            console.error('Import error:', error);
            toast.error('Failed to import pumps');
          } else {
            toast.success(
              `Successfully imported ${pumpsToInsert.length} pumps!`
            );
            setIsOpen(false);
            onImportComplete();
          }
        } catch (error) {
          console.error('CSV parsing error:', error);
          toast.error('Failed to parse CSV file');
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        toast.error('Failed to read CSV file');
        setIsUploading(false);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='cursor-pointer'>
          <Upload className='mr-2 h-4 w-4' />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Import Pumps from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple pumps at once. Download the
            template first to see the required format.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div>
            <Button
              variant='outline'
              onClick={downloadTemplate}
              className='w-full cursor-pointer'
            >
              <Download className='mr-2 h-4 w-4' />
              Download Template
            </Button>
            <p className='text-muted-foreground mt-2 text-xs'>
              Download the sample template to see the required CSV format
            </p>
          </div>

          <div>
            <Label htmlFor='csv-file'>Select CSV File</Label>
            <Input
              id='csv-file'
              type='file'
              accept='.csv'
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={isUploading}
              className='cursor-pointer'
            />
          </div>

          {isUploading && (
            <div className='flex items-center justify-center py-4'>
              <div className='border-primary h-4 w-4 animate-spin rounded-full border-b-2'></div>
              <span className='ml-2 text-sm'>Importing pumps...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
