-- Use a verified free grilled-salmon photo and match the meal by its name.
UPDATE meals
SET image_url='https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=900'
WHERE name LIKE '%سلمون%';