-- ========================================================
-- HIDDEN MUSIC VAULT - SUPABASE DATABASE SCHEMA FIX
-- Copy and run this script in Supabase SQL Editor
-- ========================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles viewable" ON public.profiles;
CREATE POLICY "Public profiles viewable" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. Create albums table (Folder level)
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  original_year INTEGER,
  ban_reason TEXT DEFAULT '',
  cover_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access albums" ON public.albums;
CREATE POLICY "Open access albums" ON public.albums FOR ALL USING (true) WITH CHECK (true);

-- 3. Create tracks table (Child level)
CREATE TABLE IF NOT EXISTS public.tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  media_type TEXT DEFAULT 'audio' CHECK (media_type IN ('audio', 'video')),
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  lyrics TEXT,
  duration NUMERIC(6, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access tracks" ON public.tracks;
CREATE POLICY "Open access tracks" ON public.tracks FOR ALL USING (true) WITH CHECK (true);

-- 4. Create album_comments table
CREATE TABLE IF NOT EXISTS public.album_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  user_id TEXT,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.album_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access album_comments" ON public.album_comments;
CREATE POLICY "Open access album_comments" ON public.album_comments FOR ALL USING (true) WITH CHECK (true);

-- 5. Create feedbacks table
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  user_name TEXT,
  category TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access feedbacks" ON public.feedbacks;
CREATE POLICY "Open access feedbacks" ON public.feedbacks FOR ALL USING (true) WITH CHECK (true);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
