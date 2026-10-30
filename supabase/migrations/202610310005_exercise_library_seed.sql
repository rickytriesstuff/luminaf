-- Seed a starter exercise library. Content is general guidance, not individualized medical advice.
insert into public.exercises(name,category,instructions,difficulty) values
('Brisk walking','Cardio','Walk at a pace that raises your breathing while still allowing conversation. Begin gently and increase time gradually.','beginner'),
('Easy running','Cardio','Start with a comfortable warm-up walk, then jog at a pace you can sustain. Stop if you feel unwell.','beginner'),
('Cycling','Cardio','Use a comfortable resistance and steady cadence. Check bike fit and wear a helmet outdoors.','beginner'),
('Jump rope','Cardio','Use short intervals on a forgiving surface. Keep jumps low and land softly.','intermediate'),
('Bodyweight squat','Strength','Stand with feet around shoulder width. Sit hips back, keep knees tracking with toes, then stand tall.','beginner'),
('Wall push-up','Strength','Place hands on a wall at chest height. Bend elbows to bring chest toward wall, then press away.','beginner'),
('Push-up','Strength','Keep body in a straight line, lower chest with control, then press up. Use knees or an incline as needed.','intermediate'),
('Reverse lunge','Strength','Step one foot back, lower both knees comfortably, then return to standing. Alternate sides.','beginner'),
('Glute bridge','Strength','Lie on your back with knees bent. Lift hips by squeezing glutes, pause, then lower slowly.','beginner'),
('Plank','Core','Support yourself on forearms or hands. Keep a neutral spine and breathe steadily. Stop when form breaks.','intermediate'),
('Dead bug','Core','Lie on your back with arms up and knees bent. Extend opposite arm and leg slowly while keeping lower back steady.','beginner'),
('Bird dog','Core','On hands and knees, extend opposite arm and leg without rotating hips. Return slowly and switch sides.','beginner'),
('Pull-up','Strength','Use a secure bar. Pull until chin reaches bar height, then lower with control. Use assisted variations if needed.','advanced'),
('Resistance-band row','Strength','Anchor a suitable band securely. Pull elbows back while keeping shoulders relaxed, then return slowly.','beginner'),
('Yoga flow','Mobility','Move through comfortable poses with steady breathing. Avoid forcing range of motion.','beginner'),
('Sun salutations','Mobility','Move smoothly through a gentle sequence of standing, fold, plank variation and upward stretch. Modify as needed.','beginner'),
('Hamstring stretch','Mobility','Extend one leg comfortably and hinge gently at hips until a mild stretch is felt. Do not bounce.','beginner'),
('Cat-cow','Mobility','On hands and knees, gently alternate arching and rounding the spine with your breath.','beginner'),
('Calf raises','Strength','Rise onto the balls of your feet, pause, then lower slowly while holding support if needed.','beginner'),
('Box breathing','Recovery','Breathe gently in, pause, breathe out and pause for comfortable equal counts. Stop if dizzy.','beginner')
on conflict(name) do nothing;
