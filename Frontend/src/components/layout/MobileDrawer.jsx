import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { cn } from "../../lib/cn.js";
import { TIER_TEXT_COLORS, tierLabel } from "../../lib/tierMeta.js";
import { useCurrentUser } from "../../features/profile/CurrentUserContext.jsx";
import watchpapaBanner from "../../assets/branding/watchpapa-banner.svg";
import Avatar from "../ui/Avatar.jsx";
import Button from "../ui/Button.jsx";
import Sheet from "../ui/Sheet.jsx";
import { Menu, MenuDivider, MenuGroup, MenuItem } from "../ui/Menu.jsx";
import { CalendarIcon, LogOutIcon, ShieldIcon } from "../icons/index.jsx";
import { isPathActive, useNavModel } from "./navigation.js";

// Full-height left drawer (phones/tablets < md). Every destination in the app
// lives here, grouped: Browse · Library · Social · Account.
function MobileDrawer({ open, onClose, onAuthPrompt }) {
  const me = useCurrentUser();
  const nav = useNavModel();
  const { pathname } = useLocation();

  const activeClass = (to, end) => (isPathActive(pathname, to, end) ? "bg-surface-2 text-white" : "");
  const adultClass = (l) => (l.adult ? "text-red-400 hover:text-red-300" : "");

  const signOut = async () => {
    onClose();
    await supabase.auth.signOut();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="left"
      width={320}
      title={
        <Link to="/" onClick={onClose} className="flex items-center">
          <img src={watchpapaBanner} alt="watchpapa" className="h-6 w-auto" />
        </Link>
      }
      panelClassName="landscape-short:w-[min(320px,80vw)]"
    >
      {me.isAuthenticated ? (
        <Link
          to={me.username ? `/u/${me.username}` : "/settings"}
          onClick={onClose}
          className="mb-2 flex items-center gap-3 rounded-2xl border border-border/50 bg-surface-2/60 px-3 py-3 transition hover:bg-surface-2"
        >
          <Avatar
            username={me.username}
            avatarType={me.avatar.type}
            avatarPosterPath={me.avatar.posterPath}
            avatarUploadPath={me.avatar.uploadPath}
            size="lg"
            className="h-12 w-12 text-lg"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{me.username || "—"}</p>
            <p className={cn("text-xs font-semibold", TIER_TEXT_COLORS[me.tier] ?? "text-text-dim")}>{tierLabel(me.tier)}</p>
          </div>
        </Link>
      ) : (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Button to="/login" variant="secondary" size="md" onClick={onClose}>Sign in</Button>
          <Button to="/register" variant="primary" size="md" onClick={onClose}>Register</Button>
        </div>
      )}

      <Menu label="Main navigation" className="-mx-2">
        <MenuGroup label="Browse">
          {[...nav.browse, ...nav.more].map((l) => (
            <MenuItem key={l.to} to={l.to} icon={l.icon} onClick={onClose} className={cn(activeClass(l.to, l.end), adultClass(l))}>
              {l.label}
            </MenuItem>
          ))}
        </MenuGroup>

        {me.isAuthenticated ? (
          <>
            <MenuDivider />
            <MenuGroup label="Library">
              {nav.library.map((l) => (
                <MenuItem key={l.to} to={l.to} icon={l.icon} onClick={onClose} className={activeClass(l.to)}>
                  {l.label}
                </MenuItem>
              ))}
            </MenuGroup>
            <MenuDivider />
            <MenuGroup label="Social">
              {nav.social.map((l) => (
                <MenuItem key={l.to} to={l.to} icon={l.icon} badge={l.badge} onClick={onClose} className={activeClass(l.to)}>
                  {l.label}
                </MenuItem>
              ))}
            </MenuGroup>
            <MenuDivider />
            <MenuGroup label="Account">
              {nav.account.map((l) => (
                <MenuItem key={l.to} to={l.to} icon={l.icon} onClick={onClose} className={activeClass(l.to)}>
                  {l.label}
                </MenuItem>
              ))}
              {nav.isAdmin && (
                <MenuItem to="/admin" icon={ShieldIcon} onClick={onClose} className={cn("text-brand-light", activeClass("/admin"))}>
                  Admin panel
                </MenuItem>
              )}
            </MenuGroup>
            <MenuDivider />
            <div className="px-2 pb-1">
              <MenuItem icon={LogOutIcon} onClick={signOut}>Sign out</MenuItem>
            </div>
          </>
        ) : (
          <>
            <MenuDivider />
            <MenuGroup label="Track">
              <MenuItem icon={CalendarIcon} onClick={() => { onClose(); onAuthPrompt?.(); }}>
                Releases Radar
              </MenuItem>
            </MenuGroup>
          </>
        )}
      </Menu>
    </Sheet>
  );
}

export default MobileDrawer;
