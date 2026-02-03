-- Fix resource b5ebe51a visibility (if it exists)
-- Set visible_to_owner = true

UPDATE resources 
SET visible_to_owner = true 
WHERE uuid = 'b5ebe51a-7c9e-4c3a-8f2d-1e4b6a9c5d3f'
  AND visible_to_owner = false;

-- Also ensure the "Doctor" resource has proper visibility
UPDATE resources 
SET visible_to_owner = true 
WHERE data->>'name' = 'Doctor'
  AND visible_to_owner = false;

-- Display results
SELECT uuid, data->>'name' as name, visible_to_owner, visible_to_admin, visible_to_editor, visible_to_viewer
FROM resources
WHERE data->>'name' = 'Doctor' OR uuid = 'b5ebe51a-7c9e-4c3a-8f2d-1e4b6a9c5d3f';
