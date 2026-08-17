export interface Album {
  id: string;
  title: string;
  artist: string;
  original_year?: number;
  cover_url: string;
  is_published?: boolean;
  created_at?: string;
  tracks?: TrackItem[];
}

export interface TrackItem {
  id: string;
  album_id?: string;
  title: string;
  artist?: string;
  media_type?: 'audio' | 'video';
  source?: 'vault' | 'youtube';
  youtube_id?: string;
  audio_url?: string;
  video_url?: string;
  lyrics?: string;
  duration?: number;
  created_at?: string;
  cover_url?: string;
}

export interface UserSession {
  id: string;
  email: string;
  user_metadata?: {
    username?: string;
    avatar_url?: string;
  };
  role?: string;
  is_admin?: boolean;
  is_subscribed?: boolean;
  subscription_status?: 'active' | 'inactive';
  subscription_tier?: 'vip' | 'lifetime';
}

export interface AlbumComment {
  id: string;
  album_id: string;
  user_id?: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  is_vip?: boolean;
  created_at: string;
}
