-- Performance optimization indexes
-- Migration: V2__add_performance_indexes
-- Description: Add indexes on high-traffic columns to improve query performance

-- HotTake indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_hottake_weeklabel ON hottake(weekLabel);
CREATE INDEX IF NOT EXISTS idx_hottake_createdat ON hottake(createdAt);

-- HotTakeAnswer indexes for user activity lookups
CREATE INDEX IF NOT EXISTS idx_hottakeanswer_userid_answeredat ON hottakeanswer(user_id, answered_at);

-- AlbumRating indexes for album lookups and user ratings
CREATE INDEX IF NOT EXISTS idx_albumrating_albumid_createdat ON albumrating(album_id, created_at);
CREATE INDEX IF NOT EXISTS idx_albumrating_userid_score ON albumrating(user_id, score);

-- PostMedia collection table index for post media ordering
CREATE INDEX IF NOT EXISTS idx_postmedia_postid_sortorder ON post_media(post_id, sort_order);
