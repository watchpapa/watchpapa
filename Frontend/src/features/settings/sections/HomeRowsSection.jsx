import { HOME_ROW_LABELS, effectiveHomeRowOrder } from "../../../lib/homeRows.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import IconButton from "../../../components/ui/IconButton.jsx";
import Button from "../../../components/ui/Button.jsx";
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeOffIcon } from "../../../components/icons/index.jsx";
import { cn } from "../../../lib/cn.js";

// Reorder (up/down) + show/hide the home page's rows. `order`/`hidden` are the
// raw saved arrays (order may be empty = app default).
function HomeRowsEditor({ order, hidden, onChange, disabled }) {
  const list = effectiveHomeRowOrder(order);

  function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    onChange({ homeRowOrder: next });
  }

  function toggleHidden(key) {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    onChange({ homeHiddenRows: next });
  }

  return (
    <ul className="flex w-full flex-col gap-1.5">
      {list.map((key, i) => {
        const isHidden = hidden.includes(key);
        return (
          <li key={key} className={cn("flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 transition", isHidden ? "border-border/30 opacity-60" : "border-border/50")}>
            <span className="min-w-0 truncate text-sm text-text">{HOME_ROW_LABELS[key]}</span>
            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton label={`Move ${HOME_ROW_LABELS[key]} up`} size="sm" onClick={() => move(i, -1)} disabled={disabled || i === 0}>
                <ChevronUpIcon size={16} />
              </IconButton>
              <IconButton label={`Move ${HOME_ROW_LABELS[key]} down`} size="sm" onClick={() => move(i, 1)} disabled={disabled || i === list.length - 1}>
                <ChevronDownIcon size={16} />
              </IconButton>
              <Button variant={isHidden ? "outline" : "success"} size="xs" icon={isHidden ? EyeOffIcon : EyeIcon} onClick={() => toggleHidden(key)} disabled={disabled} className="ml-1 w-[5.25rem]">
                {isHidden ? "Hidden" : "Shown"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HomeRowsSection({ prefs, updatePref, prefsBusy }) {
  return (
    <SettingsSection id="home" title="Home page">
      <SettingsRow label="Rows" hint="Order and visibility of the rows on your home page." stack>
        <HomeRowsEditor order={prefs.homeRowOrder} hidden={prefs.homeHiddenRows} onChange={updatePref} disabled={prefsBusy} />
      </SettingsRow>
    </SettingsSection>
  );
}

export default HomeRowsSection;
