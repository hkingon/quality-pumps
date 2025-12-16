'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MultiSelectFilterProps {
  label: string;
  options: string[] | Record<string, string[]>;
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onSelectionChange,
  placeholder = 'Select...'
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const isHierarchical = typeof options === 'object' && !Array.isArray(options);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSelection = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((item) => item !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const renderHierarchicalOptions = () => {
    const hierarchicalOptions = options as Record<string, string[]>;

    return Object.entries(hierarchicalOptions).map(([category, items]) => {
      const isExpanded = expandedCategories.has(category);
      const categorySelected = items.some((item) => selected.includes(item));

      return (
        <div key={category}>
          <CommandItem
            onSelect={() => toggleCategory(category)}
            className='flex cursor-pointer items-center justify-between font-medium'
          >
            <div className='flex items-center gap-2'>
              {isExpanded ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
              <span>{category}</span>
              {categorySelected && (
                <Badge variant='secondary' className='ml-2 h-5 px-1 text-xs'>
                  {items.filter((item) => selected.includes(item)).length}
                </Badge>
              )}
            </div>
          </CommandItem>

          {isExpanded && (
            <div className='border-muted ml-6 border-l-2'>
              {items.map((item) => {
                const isSelected = selected.includes(item);
                return (
                  <CommandItem
                    key={item}
                    onSelect={() => toggleSelection(item)}
                    className='cursor-pointer'
                  >
                    <div
                      className={cn(
                        'border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Check className='h-4 w-4' />
                    </div>
                    <span>{item}</span>
                  </CommandItem>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  const renderFlatOptions = () => {
    const flatOptions = options as string[];

    return flatOptions.map((option) => {
      const isSelected = selected.includes(option);
      return (
        <CommandItem
          key={option}
          onSelect={() => toggleSelection(option)}
          className='cursor-pointer'
        >
          <div
            className={cn(
              'border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'opacity-50 [&_svg]:invisible'
            )}
          >
            <Check className='h-4 w-4' />
          </div>
          <span>{option}</span>
        </CommandItem>
      );
    });
  };

  return (
    <div className='space-y-2'>
      <label className='text-sm font-medium'>{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className='w-full justify-between'
          >
            {selected.length > 0 ? (
              <div className='flex flex-wrap gap-1'>
                {selected.slice(0, 2).map((item) => (
                  <Badge key={item} variant='secondary' className='text-xs'>
                    {item}
                  </Badge>
                ))}
                {selected.length > 2 && (
                  <Badge variant='secondary' className='text-xs'>
                    +{selected.length - 2}
                  </Badge>
                )}
              </div>
            ) : (
              <span className='text-muted-foreground'>{placeholder}</span>
            )}
            <ChevronDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[300px] p-0' align='start'>
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {isHierarchical
                  ? renderHierarchicalOptions()
                  : renderFlatOptions()}
              </CommandGroup>
            </CommandList>
            {selected.length > 0 && (
              <>
                <Separator />
                <div className='p-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='w-full'
                    onClick={clearAll}
                  >
                    Clear All ({selected.length})
                  </Button>
                </div>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
