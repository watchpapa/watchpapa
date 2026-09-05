import { Link } from "react-router-dom";
import InfoPageShell from "../../components/static/InfoPageShell.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

const TH = "px-4 py-3 text-left";
const TD = "px-4 py-3 text-[#b0b0d4]";
const TD_MUTED = "px-4 py-3 text-[#5a5a78]";
const YES = <span className="font-semibold text-emerald-400">Yes</span>;
const NO = <span className="text-[#5a5a78]">—</span>;

function PlansTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2a3570]/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a3570]/50 text-[11px] uppercase tracking-widest text-[#5a5a78]">
            <th className={TH}>Feature</th>
            <th className={`${TH} text-green-400`}>Free</th>
            <th className={`${TH} text-amber-400`}>Premium</th>
            <th className={`${TH} text-sky-400`}>Pro</th>
            <th className={`${TH} text-violet-400`}>Pro+</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a3570]/40">
          <tr>
            <td className={TD}>Followed shows</td>
            <td className={TD}>3</td>
            <td className={TD} rowSpan={2}>10 combined</td>
            <td className={TD}>100</td>
            <td className={TD}>100</td>
          </tr>
          <tr>
            <td className={TD}>Followed movies</td>
            <td className={TD}>1</td>
            <td className={TD}>100</td>
            <td className={TD}>100</td>
          </tr>
          <tr>
            <td className={TD}>Watchlists</td>
            <td className={TD}>1</td>
            <td className={TD}>3</td>
            <td className={TD}>10</td>
            <td className={TD}>10</td>
          </tr>
          <tr>
            <td className={TD}>
              Profile stats
              <span className="block text-[11px] text-[#5a5a78]">
                Ratings total, average and distribution are shown on every plan
              </span>
            </td>
            <td className={TD_MUTED}>Basics</td>
            <td className={TD}>+ Top genres</td>
            <td className={TD}>+ Decades, monthly heatmap</td>
            <td className={TD}>+ Decades, monthly heatmap</td>
          </tr>
          <tr>
            <td className={TD}>
              Your streaming services
              <span className="block text-[11px] text-[#5a5a78]">
                “On Your Services” rows, the My Services page, service-filtered suggestions
              </span>
            </td>
            <td className={TD}>{NO}</td>
            <td className={TD}>{NO}</td>
            <td className={TD}>{YES}</td>
            <td className={TD}>{YES}</td>
          </tr>
          <tr>
            <td className={TD}>Custom photo avatar</td>
            <td className={TD}>{NO}</td>
            <td className={TD}>{NO}</td>
            <td className={TD}>{YES}</td>
            <td className={TD}>{YES}</td>
          </tr>
          <tr>
            <td className={TD}>Ads *</td>
            <td className={TD_MUTED}>Yes</td>
            <td className={TD_MUTED}>Yes</td>
            <td className={TD_MUTED}>Yes</td>
            <td className="px-4 py-3 font-semibold text-violet-400">No ads</td>
          </tr>
        </tbody>
      </table>
    </div>
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
        <p className="muted">
          * Ads are not live. The column reflects what each plan will include if advertising is ever
          introduced.
        </p>
        <p>
          Everything else is the same on every plan: unlimited ratings, the rewatch diary, “Suggested
          for you”, content language and country settings, watch regions and the Where to watch
          panel, poster avatars, observing people, share cards, import and export, and home-page
          customisation.
        </p>
        <p className="muted">
          Your current plan, and when a temporary upgrade ends, is shown under{" "}
          <strong>Settings → Plan</strong> and in your profile menu.
        </p>

        <h2>Early Adopters</h2>
        <p>
          The first 5,000 people to join watchpapa receive <strong>lifetime Premium</strong> — no
          action needed. If you signed up early, your plan badge in the profile menu says{" "}
          <strong>Early Adopter</strong>.
        </p>
        <p>
          Early adopters keep Premium permanently: when a temporary upgrade from a referral or a code
          runs out, they fall back to Premium rather than Free.
        </p>

        <h2>Invite a friend, both get rewarded</h2>
        <p>
          Your personal referral code and invite link are under <strong>Settings → Plan</strong> and
          in your profile menu under <strong>Invite Friends</strong>. Share either — once your friend
          joins and gets active, you both receive a 30-day plan upgrade.
        </p>

        <h3>What you both get</h3>
        <p className="muted text-sm">
          Rewards depend on how many <strong>Early Adopter</strong> accounts exist (cap 5,000), not on
          whether you are on Free, Premium or Pro today.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#2a3570]/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a3570]/50 text-[11px] uppercase tracking-widest text-[#5a5a78]">
                <th className={TH}>Situation</th>
                <th className={TH}>You get</th>
                <th className={TH}>Your friend gets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3570]/40">
              <tr>
                <td className={TD}>Fewer than 5,000 Early Adopters so far — pool still has open seats</td>
                <td className="px-4 py-3 font-semibold text-sky-400">Pro — 30 days</td>
                <td className="px-4 py-3 font-semibold text-sky-400">Pro — 30 days</td>
              </tr>
              <tr>
                <td className={TD}>
                  All 5,000 Early Adopter seats are taken, and{" "}
                  <strong className="text-white">you</strong> are an Early Adopter
                </td>
                <td className="px-4 py-3 font-semibold text-sky-400">Pro — 30 days</td>
                <td className="px-4 py-3 font-semibold text-amber-400">Premium — 30 days</td>
              </tr>
              <tr>
                <td className={TD}>
                  All 5,000 Early Adopter seats are taken, and{" "}
                  <strong className="text-white">you</strong> are not an Early Adopter
                </td>
                <td className="px-4 py-3 font-semibold text-amber-400">Premium — 30 days</td>
                <td className="px-4 py-3 font-semibold text-amber-400">Premium — 30 days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          A timed upgrade never replaces a better plan you already have — if you’re already on Pro,
          a Premium reward simply doesn’t apply.
        </p>

        <h3>How your friend qualifies</h3>
        <p>To make sure rewards go to real people, your friend needs to:</p>
        <ul>
          <li>
            <span>
              Follow at least <strong>3 shows or upcoming movies</strong> (titles that have already
              been released, or shows that have ended, can’t be newly followed).
            </span>
          </li>
          <li>
            <span>
              Sign in on at least <strong>2 different days</strong>.
            </span>
          </li>
        </ul>

        <div className="rounded-xl border border-[#2a3570] bg-[#0d0f1e] px-4 py-3">
          <p className="text-sm text-[#c0c0e8]">
            <strong className="text-white">Rewards are not instant.</strong> Neither of you receives
            the upgrade until your friend has done both. The moment they have, both upgrades are
            applied automatically — no action needed from either side.
          </p>
        </div>

        <h3>Refer 10 friends, get Pro for life</h3>
        <p>
          Early adopters whose referrals complete the steps above 10 or more times earn{" "}
          <strong>lifetime Pro</strong>. This milestone is available while watchpapa remains free to
          use.
        </p>

        <h2>Reward codes</h2>
        <p>
          Occasionally we run promotions with reward codes. Enter one under{" "}
          <strong>Settings → Plan → Claim a reward code</strong>. Each code can be used once per
          account.
        </p>

        <h2>How to use a referral code</h2>
        <p>You can enter a friend’s code two ways:</p>
        <ul>
          <li>
            <span>
              Click a referral link your friend shared — the code is filled in automatically on the
              sign-up form.
            </span>
          </li>
          <li>
            <span>
              Or paste their code into the optional <strong>referral or gift code</strong> field when
              you register. It also works if you sign up with Google or GitHub.
            </span>
          </li>
        </ul>
        <p className="muted">Each account can use only one referral code, and only at sign-up.</p>

        <h2>When an upgrade ends</h2>
        <p>
          You drop back to Premium if you’re an Early Adopter, otherwise to Free. Nothing is deleted.
          If you’re then following more titles than your plan allows, the Releases Radar pauses until
          you unfollow enough on the <Link to="/follows">Follows page</Link>; extra watchlists are
          kept, you just can’t create new ones until you’re under the limit.
        </p>
        <p className="muted">
          Fair play: rewards obtained through fake or duplicate accounts are revoked — see the{" "}
          <Link to="/terms">Terms of Use</Link>.
        </p>
      </InfoPageShell>
    </>
  );
}

export default SubscriptionPage;
