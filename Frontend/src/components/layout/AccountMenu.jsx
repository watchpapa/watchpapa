import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { cn } from "../../lib/cn.js";
import { TIER_TEXT_COLORS, tierLabel } from "../../lib/tierMeta.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import { useIsPhone } from "../../hooks/useMediaQuery.js";
import Avatar from "../ui/Avatar.jsx";
import Badge from "../ui/Badge.jsx";
import Popover from "../ui/Popover.jsx";
import Sheet from "../ui/Sheet.jsx";
import IconButton from "../ui/IconButton.jsx";
import { Menu, MenuDivider, MenuGroup, MenuItem } from "../ui/Menu.jsx";
import { CheckIcon, CopyIcon, GiftIcon, LogOutIcon, ShareIcon, ShieldIcon } from "../icons/index.jsx";
import { useNavModel } from "./navigation.js";

// The account menu body — identical whether it opens as a desktop popover
// (avatar in the header) or a phone bottom sheet (avatar tap / "You" tab).
export function AccountMenuContent({ onNavigate }) {
  const me = useCurrentUser();
  const nav = useNavModel();
  const [copied, setCopied] = useState(false);
  const profilePath = me.username ? `/u/${me.username}` : "/settings";

  const close = () => onNavigate?.();

  const copyReferral = () => {
    if (!me.referralUrl) return;
    navigator.clipboard?.writeText(me.referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const shareReferral = () => {
    if (!me.referralUrl) return;
    navigator.share?.({ title: "Join watchpapa", url: me.referralUrl });
  };

  const signOut = async () => {
    close();
    await supabase.auth.signOut();
  };

  return (
    <Menu label="Account" className="py-0">
      {/* Identity card — the whole card is the "My profile" link */}
      <Link
        to={profilePath}
        onClick={close}
        role="menuitem"
        tabIndex={-1}
        className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
      >
        <Avatar
          username={me.username}
          avatarType={me.avatar.type}
          avatarPosterPath={me.avatar.posterPath}
          avatarUploadPath={me.avatar.uploadPath}
          size="lg"
          className="h-12 w-12 text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{me.username || "—"}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("text-xs font-semibold", TIER_TEXT_COLORS[me.tier] ?? "text-text-dim")}>{tierLabel(me.tier)}</span>
            {me.isEarlyAdopter && <Badge variant="gold" size="xs">Early Adopter</Badge>}
          </div>
          <p className="mt-0.5 text-[11px] text-text-faint">View profile</p>
        </div>
      </Link>

      {/* Invite friends — one row instead of the old referral widget */}
      <div className="mx-2 mb-1 flex items-center gap-2 rounded-xl border border-border/50 bg-surface-2/60 px-3 py-2">
        <GiftIcon size={16} className="shrink-0 text-accent" />
        <button type="button" onClick={copyReferral} className="min-w-0 flex-1 text-left" disabled={!me.referralUrl}>
          <span className="block text-xs font-semibold text-white">Invite friends</span>
          <span className="block truncate text-[11px] text-text-faint">
            {me.referralUrl ? (copied ? "Link copied!" : "You both get rewarded · tap to copy") : "Loading your link…"}
          </span>
        </button>
        <IconButton label={copied ? "Copied" : "Copy invite link"} size="sm" onClick={copyReferral} disabled={!me.referralUrl}>
          {copied ? <CheckIcon size={16} className="text-emerald-400" /> : <CopyIcon size={16} />}
        </IconButton>
        {typeof navigator !== "undefined" && navigator.share && (
          <IconButton label="Share invite link" size="sm" onClick={shareReferral} disabled={!me.referralUrl}>
            <ShareIcon size={16} />
          </IconButton>
        )}
      </div>

      <MenuDivider />
      <MenuGroup label="Library">
        {nav.library.map((l) => (
          <MenuItem key={l.to} to={l.to} icon={l.icon} onClick={close}>{l.label}</MenuItem>
        ))}
      </MenuGroup>
      <MenuDivider />
      <MenuGroup label="Social">
        {nav.social.map((l) => (
          <MenuItem key={l.to} to={l.to} icon={l.icon} badge={l.badge} onClick={close}>{l.label}</MenuItem>
        ))}
      </MenuGroup>
      <MenuDivider />
      <MenuGroup label="Account">
        {nav.account.map((l) => (
          <MenuItem key={l.to} to={l.to} icon={l.icon} onClick={close}>{l.label}</MenuItem>
        ))}
        {nav.isAdmin && (
          <MenuItem to="/admin" icon={ShieldIcon} onClick={close} className="text-brand-light">Admin panel</MenuItem>
        )}
      </MenuGroup>
      <MenuDivider />
      <div className="px-2 pb-2 pt-1">
        <MenuItem icon={LogOutIcon} onClick={signOut}>Sign out</MenuItem>
      </div>
    </Menu>
  );
}

// Header trigger: avatar button → Popover on md+ / bottom Sheet on phones.
// Click-to-open everywhere (no hover-open), Escape/outside/route close.
export function AccountMenuButton({ className }) {
  const me = useCurrentUser();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  if (!me.isAuthenticated) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light md:h-10 md:w-10",
          open ? "ring-2 ring-brand" : "hover:ring-2 hover:ring-brand/70",
          className,
        )}
      >
        <Avatar
          username={me.username}
          avatarType={me.avatar.type}
          avatarPosterPath={me.avatar.posterPath}
          avatarUploadPath={me.avatar.uploadPath}
          size="sm"
        />
      </button>
      {isPhone ? (
        <Sheet open={open} onClose={() => setOpen(false)} title="Account" maxHeight="90svh">
          <AccountMenuContent onNavigate={() => setOpen(false)} />
        </Sheet>
      ) : (
        <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} width={300} role="menu" className="p-1">
          <AccountMenuContent onNavigate={() => setOpen(false)} />
        </Popover>
      )}
    </>
  );
}

export default AccountMenuButton;
