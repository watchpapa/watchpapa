import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useEditProfile } from "../../features/profile/hooks/useEditProfile.js";
import { FavouritesEditor } from "../../components/profile/FavouritesEditor.jsx";

function EditProfilePage({ session }) {
  const navigate = useNavigate();
  const { bio, setBio, saveBio, favourites, setFavourite, saving, error, loaded } = useEditProfile(session);
  const [localBio, setLocalBio] = useState("");
  const [bioSaved, setBioSaved] = useState(false);

  useEffect(() => { if (loaded) setLocalBio(bio ?? ""); }, [loaded, bio]);

  const username = session?.user?.user_metadata?.username ?? "";
  const breadcrumbs = [
    { label: username, to: `/u/${username}` },
    { label: "Edit Profile" },
  ];

  const handleSaveBio = async () => {
    await saveBio(localBio);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 2000);
  };

  if (!loaded) {
    return (
      <AppLayout session={session} breadcrumbs={breadcrumbs}>
        <div className="mx-auto max-w-xl animate-pulse space-y-4 pt-6">
          <div className="h-32 rounded-2xl bg-[#1a1f3a]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title="Edit Profile — watchpapa" path="/profile/edit" />

      <div className="mx-auto max-w-xl space-y-6 py-6 px-4 sm:px-0">
        <h1 className="text-xl font-bold text-white">Edit Profile</h1>

        {error && (
          <p className="rounded-xl border border-red-800/40 bg-red-900/10 px-4 py-2 text-sm text-red-400">{error}</p>
        )}

        {/* Bio */}
        <section className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18]">
          <div className="border-b border-[#2a3570]/50 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">Bio</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <textarea
              value={localBio}
              onChange={(e) => { setLocalBio(e.target.value); setBioSaved(false); }}
              maxLength={200}
              rows={3}
              placeholder="Tell people a bit about yourself…"
              className="w-full resize-none rounded-xl border border-[#2a3570] bg-[#0d0f1e] px-4 py-3 text-sm text-white placeholder-[#4a4a7a] outline-none focus:border-[#5a5aaa]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#4a4a7a]">{localBio.length}/200</span>
              <button
                onClick={handleSaveBio}
                disabled={saving || localBio === (bio ?? "")}
                className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-4 py-1.5 text-xs font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white disabled:opacity-40"
              >
                {saving ? "Saving…" : bioSaved ? "Saved!" : "Save bio"}
              </button>
            </div>
          </div>
        </section>

        {/* Favourites */}
        <section className="rounded-2xl border border-[#2a3570]/50 bg-[#0a0c18]">
          <div className="border-b border-[#2a3570]/50 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#6868b8]">Favourites</h2>
          </div>
          <div className="px-5 py-4">
            <FavouritesEditor favourites={favourites} setFavourite={setFavourite} />
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            to={`/u/${username}`}
            className="rounded-xl border border-[#3a3a7a] bg-[#1a1d35] px-4 py-2 text-sm font-semibold text-[#a0a0e8] transition hover:border-[#5a5aaa] hover:text-white"
          >
            ← Back to profile
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

export default EditProfilePage;
