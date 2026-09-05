import { RatingSidebar } from "../rating/RatingSidebar.jsx";
import { RatingHistogram } from "../rating/RatingHistogram.jsx";
import RatingHistoryPanel from "../rating/RatingHistoryPanel.jsx";
import { ObservedRatingsPanel } from "../observe/ObservedRatingsPanel.jsx";
import WatchedPanel from "../watchlist/WatchedPanel.jsx";
import AddToWatchlistButton from "../watchlist/AddToWatchlistButton.jsx";
import ActionChip from "../ui/ActionChip.jsx";
import { ShareIcon } from "../icons/index.jsx";
import { cn } from "../../lib/cn.js";

// "Your activity" — the one card that replaces the old stack of seven
// self-margined widgets. Owns all spacing; children render flush.
//   rating    { mediaType, entityId, isUnreleased, tmdbShowId?, seasonNumber?, episodeNumber? }
//   watched   props for WatchedPanel (entries/count/loading/impliedWatched/busy/onLogWatch/onRemoveEntry) or undefined
//   watchlist { mediaType, entityId } or undefined
//   onShare   () => void or undefined
function MediaActionPanel({ session, onAuthPrompt, rating, watched, watchlist, onShare, tmdbVoteAvg, className }) {
  const chips = [watched, watchlist, onShare].filter(Boolean).length;

  return (
    <section aria-label="Your activity" className={cn("rounded-2xl border border-border/50 bg-surface/70 p-4 backdrop-blur-sm", className)}>
      <RatingSidebar
        mediaType={rating.mediaType}
        entityId={rating.entityId}
        session={session}
        onAuthPrompt={onAuthPrompt}
        isUnreleased={rating.isUnreleased}
        tmdbShowId={rating.tmdbShowId}
        seasonNumber={rating.seasonNumber}
        episodeNumber={rating.episodeNumber}
      />

      {chips > 0 && (
        <div className={cn("mt-4 grid gap-2", chips === 3 ? "grid-cols-3" : chips === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {watched && <WatchedPanel {...watched} session={session} onAuthPrompt={onAuthPrompt} />}
          {watchlist && (
            <AddToWatchlistButton
              variant="chip"
              mediaType={watchlist.mediaType}
              entityId={watchlist.entityId}
              session={session}
              onAuthPrompt={onAuthPrompt}
            />
          )}
          {onShare && <ActionChip icon={ShareIcon} label="Share" onClick={onShare} />}
        </div>
      )}

      <div className="mt-4">
        <RatingHistogram mediaType={rating.mediaType} entityId={rating.entityId} tmdbVoteAvg={tmdbVoteAvg} />
      </div>

      <div className="mt-2 space-y-1">
        <RatingHistoryPanel mediaType={rating.mediaType} entityId={rating.entityId} session={session} />
        <ObservedRatingsPanel mediaType={rating.mediaType} entityId={rating.entityId} session={session} />
      </div>
    </section>
  );
}

export default MediaActionPanel;
