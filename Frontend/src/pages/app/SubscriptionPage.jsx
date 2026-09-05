import { Link } from "react-router-dom";
import InfoPageShell from "../../components/static/InfoPageShell.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { cn } from "../../lib/cn.js";

const PLANS = [
  { key: "free", label: "Free", color: "text-emerald-400", border: "border-emerald-900/50" },
  { key: "premium", label: "Premium", color: "text-amber-400", border: "border-amber-900/50" },
  { key: "pro", label: "Pro", color: "text-sky-400", border: "border-sky-900/50" },
  { key: "pro_plus", label: "Pro+", color: "text-violet-400", border: "border-violet-900/50" },
];

const YES = <span className="font-semibold text-emerald-400">Yes</span>;
const NO = <span className="text-text-faint">—</span>;

// One row per feature; values keyed by plan. `note` renders under the label.
const FEATURES = [
  { label: "Followed shows", values: { free: "3", premium: "10 combined", pro: "100", pro_plus: "100" } },
  { label: "Followed movies", values: { free: "1", premium: "(shows + movies)", pro: "100", pro_plus: "100" } },
  { label: "Watchlists", values: { free: "1", premium: "3", pro: "10", pro_plus: "10" } },
  {
    label: "Profile stats",
    note: "Ratings total, average and distribution are shown on every plan",
    values: { free: <span className="text-text-faint">Basics</span>, premium: "+ Top genres", pro: "+ Decades, monthly heatmap", pro_plus: "+ Decades, monthly heatmap" },
  },
  {
    label: "Your streaming services",
    note: "“On Your Services” rows, the My Services page, service-filtered suggestions",
    values: { free: NO, premium: NO, pro: YES, pro_plus: YES },
  },
  { label: "Custom photo avatar", values: { free: NO, premium: NO, pro: YES, pro_plus: YES } },
  { label: "Ads *", values: { free: <span className="text-text-faint">Yes</span>, premium: <span className="text-text-faint">Yes</span>, pro: <span className="text-text-faint">Yes</span>, pro_plus: <span className="font-semibold text-violet-400">No ads</span> } },
];

// Comparison table from `md`; one card per plan below it (a 5-column table is
// unreadable on a phone).
function PlansTable() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border/50 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-widest text-text-faint">
              <th className="px-4 py-3 text-left">Feature</th>
              {PLANS.map((p) => <th key={p.key} className={cn("px-4 py-3 text-left", p.color)}>{p.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {FEATURES.map((f) => (
              <tr key={f.label}>
                <td className="px-4 py-3 text-text">
                  {f.label}
                  {f.note && <span className="block text-[11px] text-text-faint">{f.note}</span>}
                </td>
                {PLANS.map((p) => <td key={p.key} className="px-4 py-3 text-text">{f.values[p.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:hidden">
        {PLANS.map((p) => (
          <div key={p.key} className={cn("rounded-xl border bg-surface p-4", p.border)}>
            <p className={cn("text-base font-extrabold", p.color)}>{p.label}</p>
            <dl className="mt-3 space-y-2 text-xs">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-3">
                  <dt className="text-text-dim">{f.label}</dt>
                  <dd className="text-right text-text">{f.values[p.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

const REWARD_ROWS = [
  { situation: "Fewer than 5,000 Early Adopters so far — pool still has open seats", you: ["Pro — 30 days", "text-sky-400"], friend: ["Pro — 30 days", "text-sky-400"] },
  { situation: <>All 5,000 Early Adopter seats are taken, and <strong className="text-white">you</strong> are an Early Adopter</>, you: ["Pro — 30 days", "text-sky-400"], friend: ["Premium — 30 days", "text-amber-400"] },
  { situation: <>All 5,000 Early Adopter seats are taken, and <strong className="text-white">you</strong> are not an Early Adopter</>, you: ["Premium — 30 days", "text-amber-400"], friend: ["Premium — 30 days", "text-amber-400"] },
];

function RewardsTable() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border/50 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-widest text-text-faint">
              <th className="px-4 py-3 text-left">Situation</th>
              <th className="px-4 py-3 text-left">You get</th>
              <th className="px-4 py-3 text-left">Your friend gets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {REWARD_ROWS.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-text">{r.situation}</td>
                <td className={cn("px-4 py-3 font-semibold", r.you[1])}>{r.you[0]}</td>
                <td className={cn("px-4 py-3 font-semibold", r.friend[1])}>{r.friend[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {REWARD_ROWS.map((r, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-surface p-4 text-sm">
            <p className="text-text">{r.situation}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-text-faint">You get</p><p className={cn("font-semibold", r.you[1])}>{r.you[0]}</p></div>
              <div><p className="text-text-faint">Your friend gets</p><p className={cn("font-semibold", r.friend[1])}>{r.friend[0]}</p></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SubscriptionPage({ session }) {
  return (
    <>
      <PageHead
        title="Plans & Perks"
        description="watchpapa is free. See what Free, Premium, Pro and Pro+ include, how the first 5,000 accounts get lifetime Premium, and how referrals and reward codes earn upgrades."
        path="/subscription"
      />
      <InfoPageShell
        session={session}
        breadcrumbs={[{ label: "Plans", to: "/subscription" }]}
        title="Plans & Perks"
        lead="watchpapa is free, and there is nothing to buy yet. Bigger plans are earned — by joining early, inviting friends, or redeeming a code."
      >
        <h2>What each plan includes</h2>
        <PlansTable />
        <p className="muted">* Ads are not live. The column reflects what each plan will include if advertising is ever introduced.</p>
        <p>
          Everything else is the same on every plan: unlimited ratings, the rewatch diary, “Suggested for you”, content language and country settings, watch regions and the Where to watch panel, poster avatars, observing people, share cards, import and export, and home-page customisation.
        </p>
        <p className="muted">
          Your current plan, and when a temporary upgrade ends, is shown under <strong>Settings → Plan & rewards</strong> and in your account menu.
        </p>

        <h2>Early Adopters</h2>
        <p>
          The first 5,000 people to join watchpapa receive <strong>lifetime Premium</strong> — no action needed. If you signed up early, your plan badge in the account menu says <strong>Early Adopter</strong>.
        </p>
        <p>Early adopters keep Premium permanently: when a temporary upgrade from a referral or a code runs out, they fall back to Premium rather than Free.</p>

        <h2>Invite a friend, both get rewarded</h2>
        <p>
          Your personal referral code and invite link are under <strong>Settings → Plan & rewards</strong> and in your account menu under <strong>Invite friends</strong>. Share either — once your friend joins and gets active, you both receive a 30-day plan upgrade.
        </p>

        <h3>What you both get</h3>
        <p className="muted text-sm">Rewards depend on how many <strong>Early Adopter</strong> accounts exist (cap 5,000), not on whether you are on Free, Premium or Pro today.</p>
        <RewardsTable />
        <p className="muted">A timed upgrade never replaces a better plan you already have — if you’re already on Pro, a Premium reward simply doesn’t apply.</p>

        <h3>How your friend qualifies</h3>
        <p>To make sure rewards go to real people, your friend needs to:</p>
        <ul>
          <li><span>Follow at least <strong>3 shows or upcoming movies</strong> (titles that have already been released, or shows that have ended, can’t be newly followed).</span></li>
          <li><span>Sign in on at least <strong>2 different days</strong>.</span></li>
        </ul>

        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-sm text-text">
            <strong className="text-white">Rewards are not instant.</strong> Neither of you receives the upgrade until your friend has done both. The moment they have, both upgrades are applied automatically — no action needed from either side.
          </p>
        </div>

        <h3>Refer 10 friends, get Pro for life</h3>
        <p>Early adopters whose referrals complete the steps above 10 or more times earn <strong>lifetime Pro</strong>. This milestone is available while watchpapa remains free to use.</p>

        <h2>Reward codes</h2>
        <p>Occasionally we run promotions with reward codes. Enter one under <strong>Settings → Plan & rewards → Claim a reward code</strong>. Each code can be used once per account.</p>

        <h2>How to use a referral code</h2>
        <p>You can enter a friend’s code two ways:</p>
        <ul>
          <li><span>Click a referral link your friend shared — the code is filled in automatically on the sign-up form.</span></li>
          <li><span>Or paste their code into the optional <strong>referral or gift code</strong> field on the second step of sign-up. It also works if you sign up with Google or GitHub.</span></li>
        </ul>
        <p className="muted">Each account can use only one referral code, and only at sign-up.</p>

        <h2>When an upgrade ends</h2>
        <p>
          You drop back to Premium if you’re an Early Adopter, otherwise to Free. Nothing is deleted. If you’re then following more titles than your plan allows, the Releases Radar pauses until you unfollow enough on the <Link to="/follows">Follows page</Link>; extra watchlists are kept, you just can’t create new ones until you’re under the limit.
        </p>
        <p className="muted">Fair play: rewards obtained through fake or duplicate accounts are revoked — see the <Link to="/terms">Terms of Use</Link>.</p>
      </InfoPageShell>
    </>
  );
}

export default SubscriptionPage;
