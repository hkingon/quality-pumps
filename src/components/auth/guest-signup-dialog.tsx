'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, UserPlus } from 'lucide-react';

interface GuestSignupDialogProps {
  open: boolean;
  onClose: () => void;
  onDownloadExample: () => void;
}

export function GuestSignupDialog({
  open,
  onClose,
  onDownloadExample
}: GuestSignupDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>Sign up to download your report</DialogTitle>
          <DialogDescription>
            Create a free account to generate and download full PDF reports for
            your pump curve analysis.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 pt-2'>
          <Button
            className='w-full'
            onClick={() => {
              onClose();
              router.push('/auth/sign-up');
            }}
          >
            <UserPlus className='mr-2 h-4 w-4' />
            Create Free Account
          </Button>

          <Button
            variant='outline'
            className='w-full'
            onClick={() => {
              onClose();
              router.push('/auth/sign-in');
            }}
          >
            Sign In
          </Button>

          <div className='relative flex items-center py-1'>
            <div className='flex-grow border-t border-gray-200' />
            <span className='text-muted-foreground mx-3 shrink text-xs'>
              or
            </span>
            <div className='flex-grow border-t border-gray-200' />
          </div>

          <Button
            variant='ghost'
            className='w-full text-sm'
            onClick={() => {
              onClose();
              onDownloadExample();
            }}
          >
            <FileDown className='mr-2 h-4 w-4' />
            Download Example Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
