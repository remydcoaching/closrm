-- Migration 062: ajoute 'funnel' à bookings.source
-- Le check constraint d'origine (migration 002) n'autorisait que
-- ('booking_page', 'manual', 'google_sync'). Les bookings créés depuis le
-- builder de funnels (BookingBlock) plantent en 500 sur INSERT.

alter table bookings drop constraint if exists bookings_source_check;
alter table bookings add constraint bookings_source_check
  check (source in ('booking_page', 'manual', 'google_sync', 'funnel'));
