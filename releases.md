# Release Notes

## Recent Changes

### 2026-06 Media Sharing & Profile Features

#### New Features
- **Media Share Captions**: Users can now add a short personal thought (up to 100 characters) above the poster when sharing movies/shows. Text automatically wraps to multiple lines for longer captions.
- **Media Share Modal Enhancements**: Set 'rich' as default detail level in media share modal, providing more context when sharing movies/shows
- **Clear All Notifications**: Added button to clear all notifications at once
- **Full Ratings Page**: Display all ratings at once in compact grid on `/ratings` page with sortable interface
- **Favourites Labeling**: Added favourites label and display of recent ratings on profile pages
- **Profile Share Permissions**: New profile share permission setting (disabled by default) — allows users to control who can view their profile
- **Responsive Media Share Popup**: Media share popup now responsive on mobile devices

#### Fixes & Improvements
- **Media Share Caption Rendering**: Caption text wraps across multiple lines; quoted text in soft purple color displayed above poster; 300ms debounce prevents flickering during typing
- **Preview Sizing**: Made preview even smaller on mobile for better UX
- **Recent Ratings Flickering**: Fixed flickering issue when recent ratings load on profile page
- **Profile Stats Labels**: Show username in stats labels and update profile stats labels correctly when viewing others' profiles
- **Recap Cards**: Removed profile weekly and monthly recap cards; added posters to remaining recap cards
- **Asset Loading**: Fixed watchpapa branding to load from correct public assets path
- **Share Card Styling**: Improved recap card layout and media share card branding consistency
- **Share Card Simplification**: Simplified media share cards with story format, banner images, and object-specific filenames

### Backend Infrastructure
- All changes use raw SQL via `sequelize.query()` with named replacements
- Soft-delete patterns maintained across queries
- Background ingest deduplication via `dedupIngest()` preserved
- No model-level Sequelize CRUD introduced

### Frontend Architecture
- Media sharing components updated (`MediaShareModal.jsx`, `generateMediaShareCard.js`)
- Rating display improvements (`RatingHistogram.jsx`, detail pages)
- Profile page enhancements for cross-user viewing
- Responsive design patterns applied consistently
- Toast notifications and UI feedback maintained

---

## Migration & Schema Changes

No database migrations required for these releases. All changes are frontend and lightweight backend route modifications.

---

## Testing Recommendations

- Test media share modal across desktop and mobile viewports
- Verify profile permissions gate correctly when disabled
- Test notification clearing with multiple notifications
- Validate sortable ratings grid functionality
- Confirm preview sizing on various mobile devices (iOS/Android)

---

## Known Limitations

- Profile share permissions default to disabled for privacy; users must explicitly enable
- Ratings grid uses client-side sorting (no backend pagination currently)
- Media share cards optimized for story/square/wide formats only
