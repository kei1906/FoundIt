-- 1. Setup Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Database Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, student_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'student_number', '')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 3. Tables (In order of dependency)

-- Create profiles first
create table public.profiles (
  id uuid not null,
  full_name text null,
  student_number text null,
  email text null,
  avatar_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_student_number_key unique (student_number),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create items second (references profiles)
create table public.items (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  category text not null,
  title text not null,
  description text null,
  location_tag text not null,
  image_url text null,
  status text null default 'Active'::text,
  created_at timestamp with time zone null default now(),
  finder_id uuid null,
  constraint items_pkey primary key (id),
  constraint items_finder_id_fkey foreign KEY (finder_id) references auth.users (id),
  constraint items_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint items_category_check check (category = any (array['Lost'::text, 'Found'::text])),
  constraint items_status_check check (status = any (array['Active'::text, 'Resolved'::text]))
) TABLESPACE pg_default;

-- Create chats third (references items and auth.users)
create table public.chats (
  id uuid not null default gen_random_uuid (),
  item_id uuid null,
  finder_id uuid null,
  claimer_id uuid null,
  status text null default 'open'::text,
  created_at timestamp with time zone null default now(),
  constraint chats_pkey primary key (id),
  constraint chats_claimer_id_fkey foreign KEY (claimer_id) references auth.users (id),
  constraint chats_finder_id_fkey foreign KEY (finder_id) references auth.users (id),
  constraint chats_item_id_fkey foreign KEY (item_id) references items (id) on delete CASCADE,
  constraint chats_status_check check (status = any (array['open'::text, 'claimed'::text, 'closed'::text]))
) TABLESPACE pg_default;

-- Create messages last (references chats, items, and profiles)
create table public.messages (
  id uuid not null default gen_random_uuid (),
  sender_id uuid not null,
  receiver_id uuid not null,
  item_id uuid not null,
  content text not null,
  created_at timestamp with time zone null default now(),
  chat_id uuid not null,
  is_read boolean not null default false,
  constraint messages_pkey primary key (id),
  constraint messages_chat_id_fkey foreign KEY (chat_id) references chats (id),
  constraint messages_item_id_fkey foreign KEY (item_id) references items (id) on delete CASCADE,
  constraint messages_receiver_id_fkey foreign KEY (receiver_id) references profiles (id) on delete CASCADE,
  constraint messages_sender_id_fkey foreign KEY (sender_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

-- 4. Indexes
create index IF not exists idx_items_user_id on public.items using btree (user_id);
create index IF not exists idx_messages_item_id on public.messages using btree (item_id);
create index IF not exists idx_messages_sender_receiver on public.messages using btree (sender_id, receiver_id);

-- 5. Triggers

-- Automatically update timestamps
create trigger set_updated_at BEFORE update on public.profiles 
for EACH row execute FUNCTION handle_updated_at();

-- IMPORTANT: Links Auth signup to Public Profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RLS Setup
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;

-- 7. Policies
-- (All original policies remain the same as they were syntactically correct)
CREATE POLICY "Profiles are viewable by everyone" ON "public"."profiles" FOR SELECT TO public USING ( true );
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO authenticated WITH CHECK ( (auth.uid() = id) );
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO public USING ( (auth.uid() = id) ) WITH CHECK ( (auth.uid() = id) );

CREATE POLICY "Items are viewable by everyone" ON "public"."items" FOR SELECT TO public USING ( true );
CREATE POLICY "Users can insert own items" ON "public"."items" FOR INSERT TO authenticated WITH CHECK ( (auth.uid() = user_id) );
CREATE POLICY "Users can update own items" ON "public"."items" FOR UPDATE TO public USING ( (auth.uid() = user_id) ) WITH CHECK ( (auth.uid() = user_id) );

CREATE POLICY "Users can view their own conversations" ON "public"."messages" FOR SELECT TO authenticated USING ( (auth.uid() = sender_id) OR (auth.uid() = receiver_id) );
CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO authenticated WITH CHECK ( (auth.uid() = sender_id) );
CREATE POLICY "Users can view messages for their items" ON "public"."messages" FOR SELECT TO public USING ( EXISTS (SELECT 1 FROM items WHERE items.id = messages.item_id AND items.user_id = auth.uid()) );

CREATE POLICY "chats_insert_with_claimer_null" ON "public"."chats" FOR INSERT TO authenticated WITH CHECK ( (auth.uid() = finder_id) OR (claimer_id IS NULL) );
CREATE POLICY "chats_select_finder_or_claimer" ON "public"."chats" FOR SELECT TO authenticated USING ( (auth.uid() = finder_id) OR (auth.uid() = claimer_id) );
CREATE POLICY "chats_update_claiming" ON "public"."chats" FOR UPDATE TO authenticated USING ( (auth.uid() = finder_id) OR (auth.uid() = claimer_id) ) WITH CHECK ( (auth.uid() = finder_id) OR (auth.uid() = claimer_id) );

-- 1. Remove the old, conflicting policy seen in your screenshot
DROP POLICY IF EXISTS "chats_insert_with_claimer_null" ON public.chats;

-- 2. Create a new policy that allows you to start the chat
CREATE POLICY "allow_authenticated_chat_creation" 
ON public.chats 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = claimer_id);

ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS finder_confirmed_resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS claimer_confirmed_resolved BOOLEAN DEFAULT FALSE;

-- Auto-resolve trigger: when both users confirm resolution in the chat,
-- automatically mark the linked item as 'Resolved'.
-- This eliminates client-side race conditions where stale React state
-- could skip the RPC call.
CREATE OR REPLACE FUNCTION public.auto_resolve_item_on_chat_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.finder_confirmed_resolved = TRUE AND NEW.claimer_confirmed_resolved = TRUE THEN
    UPDATE items
    SET status = 'Resolved'
    WHERE id = NEW.item_id
      AND status = 'Active';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_resolve_item ON public.chats;
CREATE TRIGGER trg_auto_resolve_item
  AFTER UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_item_on_chat_update();

-- ============================================================
-- Migration: fix_cascades_for_deletion (2026-05-09)
-- Ensures full cascade cleanup when deleting users/items
-- ============================================================

-- messages.chat_id: NO ACTION → CASCADE
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;

-- chats.finder_id/claimer_id: NO ACTION → CASCADE (references auth.users)
ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_finder_id_fkey;
ALTER TABLE public.chats ADD CONSTRAINT chats_finder_id_fkey
  FOREIGN KEY (finder_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_claimer_id_fkey;
ALTER TABLE public.chats ADD CONSTRAINT chats_claimer_id_fkey
  FOREIGN KEY (claimer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- items.finder_id: SET NULL on user deletion
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_finder_id_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_finder_id_fkey
  FOREIGN KEY (finder_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- items.reviewed_by: SET NULL
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_reviewed_by_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- profiles.verification_reviewed_by: SET NULL
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_verification_reviewed_by_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_verification_reviewed_by_fkey
  FOREIGN KEY (verification_reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Admin RLS policies for deletion cleanup
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete any chat" ON public.chats FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete any message" ON public.messages FOR DELETE TO authenticated USING (is_admin());