-- ========================================================
-- HIDDEN MUSIC VAULT - SUPABASE SCHEMA FIX (MANDATORY UPDATE)
-- ========================================================

-- 1. Create profiles table for RBAC
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

-- 2. Create albums table (Folder Level)
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

-- 3. Re-create tracks table with album_id column (DROP & RE-CREATE FOR SCHEMA SYNC)
DROP TABLE IF EXISTS public.tracks CASCADE;

CREATE TABLE public.tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  media_type TEXT DEFAULT 'video' CHECK (media_type IN ('audio', 'video')),
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  lyrics TEXT,
  duration NUMERIC(6, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access tracks" ON public.tracks;
CREATE POLICY "Open access tracks" ON public.tracks FOR ALL USING (true) WITH CHECK (true);

-- 4. Storage Buckets Initialization & Open Storage Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('cover-arts', 'cover-arts', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Open Audio Objects" ON storage.objects;
CREATE POLICY "Open Audio Objects" ON storage.objects FOR ALL USING (bucket_id IN ('audio', 'audio-files')) WITH CHECK (bucket_id IN ('audio', 'audio-files'));

DROP POLICY IF EXISTS "Open Video Objects" ON storage.objects;
CREATE POLICY "Open Video Objects" ON storage.objects FOR ALL USING (bucket_id IN ('videos', 'video-files')) WITH CHECK (bucket_id IN ('videos', 'video-files'));

DROP POLICY IF EXISTS "Open Cover Arts Objects" ON storage.objects;
CREATE POLICY "Open Cover Arts Objects" ON storage.objects FOR ALL USING (bucket_id = 'cover-arts') WITH CHECK (bucket_id = 'cover-arts');
