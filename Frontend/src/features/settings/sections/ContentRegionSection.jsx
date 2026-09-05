import { isValidLocale, isValidTitleMode } from "../../../lib/validate.js";
import { useLocaleCatalog, languageLabel } from "../../preferences/hooks/useWatchProviderCatalog.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Select from "../../../components/ui/Select.jsx";
import PillTabs from "../../../components/ui/PillTabs.jsx";

function ContentRegionSection({ prefs, updatePref, prefsBusy }) {
  const { languages, countries, loading: catalogLoading } = useLocaleCatalog();

  return (
    <SettingsSection id="content" title="Content & region">
      <SettingsRow label="Content language" hint="Titles, overviews and genres in this language where TMDB has a translation." htmlFor="pref-language">
        <Select
          id="pref-language"
          value={prefs.language}
          onChange={(v) => isValidLocale(v) && updatePref({ language: v })}
          options={
            languages.length > 0
              ? languages.map((code) => ({ value: code, label: languageLabel(code) })).sort((a, b) => a.label.localeCompare(b.label))
              : [{ value: prefs.language, label: languageLabel(prefs.language) }]
          }
          disabled={prefsBusy || catalogLoading}
          className="w-full sm:w-56"
        />
      </SettingsRow>

      {prefs.language !== "en-US" && (
        <SettingsRow
          label="Titles"
          hint={
            prefs.titleMode === "native_original"
              ? `Titles originally in ${languageLabel(prefs.language)} keep their original title; everything else shows in English.`
              : `Every title and its details show in ${languageLabel(prefs.language)} where TMDB has a translation.`
          }
          stack
        >
          <PillTabs
            size="sm"
            aria-label="Title style"
            className="w-fit max-w-full"
            tabs={[
              { value: "translated", label: `Everything in ${languageLabel(prefs.language)}` },
              { value: "native_original", label: `Original ${languageLabel(prefs.language)} titles` },
            ]}
            value={prefs.titleMode}
            onChange={(v) => isValidTitleMode(v) && updatePref({ titleMode: v })}
          />
        </SettingsRow>
      )}

      <SettingsRow label="Country" hint="Used for regional release dates and as your default streaming region." htmlFor="pref-country">
        <Select
          id="pref-country"
          value={prefs.region ?? ""}
          onChange={(v) => updatePref({ region: v || null })}
          options={[{ value: "", label: "Not set" }, ...countries.map((c) => ({ value: c.code, label: c.name }))]}
          disabled={prefsBusy || catalogLoading}
          className="w-full sm:w-56"
        />
      </SettingsRow>
    </SettingsSection>
  );
}

export default ContentRegionSection;
