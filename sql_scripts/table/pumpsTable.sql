-- First, create the bucket (you can do this through the Supabase dashboard or via SQL)
insert into
  storage.buckets (id, name, public)
values
  ('pump-assets', 'pump-assets', false);

-- Storage policies for the pump-assets bucket:
-- Policy 1: Allow authenticated users to upload files to their own folder
create policy "Users can upload their own files" on storage.objects for INSERT
with
  check (
    bucket_id = 'pump-assets'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

-- Policy 2: Allow users to view their own files
create policy "Users can view their own files" on storage.objects for
select
  using (
    bucket_id = 'pump-assets'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

-- Policy 3: Allow users to update their own files
create policy "Users can update their own files" on storage.objects
for update
  using (
    bucket_id = 'pump-assets'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

-- Policy 4: Allow users to delete their own files
create policy "Users can delete their own files" on storage.objects for DELETE using (
  bucket_id = 'pump-assets'
  and auth.uid ()::text = (storage.foldername (name)) [1]
);

ALTER TABLE pumps 
  ALTER COLUMN type TYPE text[] USING array[type],
  ALTER COLUMN configuration TYPE text[] USING array[configuration],
  ALTER COLUMN pump_class TYPE text[] USING array[pump_class],
  ALTER COLUMN application TYPE text[] USING array[application];