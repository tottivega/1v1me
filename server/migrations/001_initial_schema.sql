-- Migration 001: Initial schema
-- Run in Supabase SQL editor before first deploy.

create table match_results (
  id              bigint generated always as identity primary key,
  created_at      timestamptz default now(),
  room_id         text        not null,
  winner_nickname text        not null,
  loser_nickname  text        not null,
  winner_score    int         not null,
  loser_score     int         not null,
  ended_reason    text        not null,  -- 'completed' | 'forfeit'
  winner_user_id  text,                  -- anonymous localStorage UUID, nullable
  loser_user_id   text                   -- anonymous localStorage UUID, nullable
);
