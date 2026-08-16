export type UserRole = 'user' | 'admin';

export type Theme3D = 'monochrome_disc' | 'cyber_crystal' | 'vinyl_gold' | 'hologram_sphere';

export type MediaType = 'audio' | 'video';

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

// Parent Album / Folder Level
export interface Album {
  id: string;
  title: string;
  artist: string;
  original_year: number;
  cover_url: string;
  is_published: boolean;
  created_at: string;
  created_by?: string;
  tracks?: TrackItem[];
}

// Track / MV Item inside an Album Folder
export interface TrackItem {
  id: string;
  album_id: string;
  title: string;
  artist?: string;
  media_type: MediaType;
  audio_url: string;
  video_url?: string;
  cover_url?: string;
  original_year?: number;
  lyrics?: string;
  duration: number;
  created_at: string;
}

// User Feedback / Bug Reports / Suggestions
export interface FeedbackItem {
  id: string;
  user_id?: string | null;
  user_email: string;
  user_name?: string | null;
  content: string;
  category?: string;
  status?: 'unread' | 'read' | 'resolved';
  created_at: string;
}


