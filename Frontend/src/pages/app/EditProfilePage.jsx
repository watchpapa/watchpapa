import { useState } from "react";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import ErrorNote from "../../components/ui/ErrorNote.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import { useEditProfile } from "../../features/profile/hooks/useEditProfile.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { FavouritesEditor } from "../../components/profile/FavouritesEditor.jsx";
import AvatarPicker from "../../components/profile/AvatarPicker.jsx";
import BannerPicker from "../../components/profile/BannerPicker.jsx";
import { ArrowLeftIcon } from "../../components/icons/index.jsx";

function EditProfilePage({ session }) {
  const { bio, saveBio, favourites, setFavourite, banner, bannerSaving, saveBanner, avatar, avatarSaving, setAvatarPoster, uploadAvatarPhoto, setAvatarDefault, saving, error, loaded } = useEditProfile(session);
  const me = useCurrentUser();
  const [localBio, setLocalBio] = useState(null); // null = not edited yet → mirrors saved bio
  const [bioSaved, setBioSaved] = useState(false);
  const draft = localBio ?? bio ?? "";

  const username = me.username || session?.user?.user_metadata?.username || "";
  const breadcrumbs = [{ label: username, to: `/u/${username}` }, { label: "Edit profile" }];

  const handleSaveBio = async () => {
    await saveBio(draft);
    setLocalBio(null);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 2000);
  };

  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <PageHead title="Edit profile — watchpapa" path="/profile/edit" noindex />
      <PageContainer width="narrow" className="space-y-5">
        <PageHeader title="Edit profile" actions={<Button to={`/u/${username}`} variant="ghost" size="sm" icon={ArrowLeftIcon}>Back to profile</Button>} />

        {error && <ErrorNote inline>{error}</ErrorNote>}

        {!loaded ? (
          <>
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </>
        ) : (
          <>
            <SettingsSection id="avatar" title="Avatar" description="Shown next to your name everywhere in the app.">
              <div className="px-4 py-4 sm:px-5">
                <AvatarPicker username={username} tier={me.tier} avatar={avatar} avatarSaving={avatarSaving} setAvatarPoster={setAvatarPoster} uploadAvatarPhoto={uploadAvatarPhoto} setAvatarDefault={setAvatarDefault} />
              </div>
            </SettingsSection>

            <SettingsSection id="banner" title="Profile banner" description="Pick which favourite's artwork sits behind your profile header, and crop it.">
              <div className="px-4 py-4 sm:px-5">
                <BannerPicker favourites={favourites} banner={banner} saving={bannerSaving} onSave={saveBanner} />
              </div>
            </SettingsSection>

            <SettingsSection id="bio" title="Bio">
              <div className="space-y-3 px-4 py-4 sm:px-5">
                <textarea
                  value={draft}
                  onChange={(e) => { setLocalBio(e.target.value); setBioSaved(false); }}
                  maxLength={200}
                  rows={3}
                  placeholder="Tell people a bit about yourself…"
                  className="w-full resize-none rounded-xl border border-border-strong bg-surface-3/80 px-4 py-3 text-sm text-white placeholder:text-text-faint outline-none transition focus:border-brand-light focus:ring-1 focus:ring-brand"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-faint">{draft.length}/200</span>
                  <Button size="sm" onClick={handleSaveBio} loading={saving} disabled={draft === (bio ?? "")}>
                    {bioSaved ? "Saved!" : "Save bio"}
                  </Button>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection id="favourites" title="Favourites" description="Five movies or shows, shown on your profile and share cards.">
              <div className="px-4 py-4 sm:px-5">
                <FavouritesEditor favourites={favourites} setFavourite={setFavourite} />
              </div>
            </SettingsSection>
          </>
        )}
      </PageContainer>
    </AppLayout>
  );
}

export default EditProfilePage;
