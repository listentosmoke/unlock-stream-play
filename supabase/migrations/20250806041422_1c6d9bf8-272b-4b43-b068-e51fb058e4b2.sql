-- Create thumbnails folder structure in storage
INSERT INTO storage.objects (bucket_id, name, id, updated_at, created_at, last_accessed_at, metadata)
VALUES ('videos', 'thumbnails/.keep', gen_random_uuid(), now(), now(), now(), '{}');

-- Create storage policy for public access to thumbnails
CREATE POLICY "Thumbnails are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'videos' AND name LIKE 'thumbnails/%');