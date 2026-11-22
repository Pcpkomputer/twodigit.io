-- =========================================================================
-- Twodigit.io - Supabase Schema Migration: TikTok Event Settings Table
-- =========================================================================
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.tiktok_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    enable_join BOOLEAN DEFAULT true NOT NULL,
    enable_chat BOOLEAN DEFAULT true NOT NULL,
    enable_gift BOOLEAN DEFAULT true NOT NULL,
    enable_follow BOOLEAN DEFAULT true NOT NULL,
    enable_share BOOLEAN DEFAULT true NOT NULL,
    enable_tts BOOLEAN DEFAULT true NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed initial row
INSERT INTO public.tiktok_settings (id, enable_join, enable_chat, enable_gift, enable_follow, enable_share, enable_tts)
VALUES ('default', true, true, true, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.tiktok_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for checking live settings in overlay)
CREATE POLICY "Allow public read access to tiktok_settings" 
ON public.tiktok_settings FOR SELECT 
USING (true);

-- Allow service role full access (insert / update / delete)
CREATE POLICY "Allow service role full access to tiktok_settings" 
ON public.tiktok_settings FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);
