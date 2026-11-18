-- Demo content for the first storefront preview. This migration runs once.
INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available)
SELECT 'صدر دجاج مشوي مع الأرز','صدر دجاج متبل ومشوي مع أرز بسمتي وخضار طازجة.',id,32,'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=900&auto=format&fit=crop&q=85',520,48,55,12,1 FROM categories WHERE name='وجبات رئيسية';
INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available)
SELECT 'سلمون مشوي مع الخضار','فيليه سلمون مشوي يقدم مع خضار موسمية.',id,42,'https://images.unsplash.com/photo-1467129931372-7e5e1f7b1b3d?w=900&auto=format&fit=crop&q=85',460,39,18,24,1 FROM categories WHERE name='وجبات رئيسية';
INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available)
SELECT 'باول اللحم والكينوا','لحم بقري قليل الدهون مع الكينوا والخضار.',id,36,'https://images.unsplash.com/photo-1547592180-85f173990554?w=900&auto=format&fit=crop&q=85',490,36,42,17,1 FROM categories WHERE name='وجبات رئيسية';
INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available)
SELECT 'زبادي يوناني بالتوت','زبادي يوناني غني بالبروتين مع التوت والشوفان.',id,18,'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&auto=format&fit=crop&q=85',240,20,28,5,1 FROM categories WHERE name='سناكات صحية';
INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available)
SELECT 'كرات الطاقة بالشوفان','سناك خفيف بالشوفان وزبدة الفول السوداني.',id,14,'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=900&auto=format&fit=crop&q=85',190,8,22,9,1 FROM categories WHERE name='سناكات صحية';
INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available)
SELECT 'سموذي البروتين بالفراولة','مشروب منعش بالفراولة والموز ومصدر بروتين.',id,19,'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=900&auto=format&fit=crop&q=85',280,25,34,6,1 FROM categories WHERE name='مشروبات';
INSERT INTO plans(name,duration,price,description,meals_per_day,active) VALUES
('باقة البداية','weekly',189,'تجربة أسبوعية متوازنة للتعرف على وجبات سعودي دايت.',2,1),
('باقة الالتزام','weekly',299,'وجبات يومية محسوبة تساعدك على تنظيم أكلك طوال الأسبوع.',3,1),
('باقة التغيير','monthly',1099,'اشتراك شهري متكامل مع خيارات متنوعة ووجبات يومية.',3,1);
