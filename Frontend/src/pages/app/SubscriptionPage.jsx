import InfoPageShell from "../../components/static/InfoPageShell.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function SubscriptionPage({ session }) {
  return (
    <>
      <PageHead
        title="Plans & Pricing"
        description="Explore watchpapa subscription plans — unlock premium features and support the platform."
        path="/subscription"
      />
      <InfoPageShell
      session={session}
      breadcrumbs={[{ label: "Plans", to: "/subscription" }]}
      title="Plans & Perks"
      lead="watchpapa is free to use. Invite friends or redeem a code to unlock a bigger follow list."
    >
      <h2>What each plan includes</h2>

      <div className="overflow-x-auto rounded-xl border border-[#1a1f3a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1f3a] text-[11px] uppercase tracking-widest text-[#5a5a78]">
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Followed shows</th>
              <th className="px-4 py-3 text-left">Followed movies</th>
              <th className="px-4 py-3 text-left">Ads *</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1f3a]">
            <tr>
              <td className="px-4 py-3 font-semibold text-green-400">Free</td>
              <td className="px-4 py-3 text-[#b0b0d4]">3</td>
              <td className="px-4 py-3 text-[#b0b0d4]">1</td>
              <td className="px-4 py-3 text-[#8080a8]">Yes</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-amber-400">Premium</td>
              <td className="px-4 py-3 text-[#b0b0d4]" colSpan={2}>10 combined</td>
              <td className="px-4 py-3 text-[#8080a8]">Yes</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-sky-400">Pro</td>
              <td className="px-4 py-3 text-[#b0b0d4]">100</td>
              <td className="px-4 py-3 text-[#b0b0d4]">100</td>
              <td className="px-4 py-3 text-[#8080a8]">Yes</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-violet-400">Pro+</td>
              <td className="px-4 py-3 text-[#b0b0d4]">100</td>
              <td className="px-4 py-3 text-[#b0b0d4]">100</td>
              <td className="px-4 py-3 font-semibold text-violet-400">No ads</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">* Ads are not yet live. The column reflects what each plan will include once advertising is introduced.</p>

      <h2>Early Adopters</h2>

      <p>
        The first 5,000 people to join watchpapa receive <strong>lifetime Premium</strong> — no action needed. If you signed up early, your plan badge in the profile menu will say <strong>Early Adopter</strong>.
      </p>
      <p>
        Early adopters keep Premium permanently, even if a temporary upgrade from a referral or code expires.
      </p>

      <h2>Invite a friend, both get rewarded</h2>

      <p>
        Your personal referral code is shown in the profile menu. Share it with someone — once they join and get active, you both earn a plan upgrade for 30 days.
      </p>

      <h3>What you both get</h3>
      <p className="muted text-sm">
        Rewards depend on how many <strong>Early Adopter</strong> accounts exist (cap 5,000), not on whether you are on Free, Premium, or Pro today.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[#1a1f3a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1f3a] text-[11px] uppercase tracking-widest text-[#5a5a78]">
              <th className="px-4 py-3 text-left">Situation</th>
              <th className="px-4 py-3 text-left">You get</th>
              <th className="px-4 py-3 text-left">Your friend gets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1f3a]">
            <tr>
              <td className="px-4 py-3 text-[#b0b0d4]">
                Fewer than 5,000 Early Adopters so far — pool still has open seats
              </td>
              <td className="px-4 py-3 font-semibold text-sky-400">Pro — 30 days</td>
              <td className="px-4 py-3 font-semibold text-sky-400">Pro — 30 days</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-[#b0b0d4]">
                All 5,000 Early Adopter seats are taken, and <strong className="text-white">you</strong> are an Early Adopter
              </td>
              <td className="px-4 py-3 font-semibold text-sky-400">Pro — 30 days</td>
              <td className="px-4 py-3 font-semibold text-amber-400">Premium — 30 days</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-[#b0b0d4]">
                All 5,000 Early Adopter seats are taken, and <strong className="text-white">you</strong> are not an Early Adopter
              </td>
              <td className="px-4 py-3 font-semibold text-amber-400">Premium — 30 days</td>
              <td className="px-4 py-3 font-semibold text-amber-400">Premium — 30 days</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>How your friend qualifies</h3>
      <p>
        To make sure rewards go to real people, your friend needs to:
      </p>
      <ul>
        <li>Follow at least <strong>3 shows or movies</strong></li>
        <li>Remain an active user after joining</li>
      </ul>
      <p className="muted">
        Both conditions must be met within 30 days of joining, otherwise the referral expires.
      </p>

      <div className="rounded-xl border border-[#2a3570] bg-[#0d0f1e] px-4 py-3">
        <p className="text-sm text-[#c0c0e8]">
          <strong className="text-white">Rewards are not instant.</strong> Neither you nor your friend receive the plan upgrade until your friend completes both steps above. Once they do, both upgrades are applied automatically — no action needed from either side.
        </p>
      </div>

      <h3>Refer 10 friends, get Pro for life</h3>
      <p>
        Early adopters who successfully refer 10 or more people earn <strong>lifetime Pro</strong>. This milestone is available while watchpapa remains free to use.
      </p>

      <h2>Reward codes</h2>
      <p>
        Occasionally we run promotions with reward codes. You can enter one in the profile menu under <strong>Claim reward code</strong>. Each code can only be used once per account.
      </p>

      <h2>How to use a referral code</h2>
      <p>
        You can enter a friend's code two ways:
      </p>
      <ul>
        <li>Click a referral link your friend shared — the code is applied automatically when you register.</li>
        <li>Go to the profile menu and choose <strong>Use referral code</strong> to enter it manually.</li>
      </ul>
      <p className="muted">Each account can only use one referral code.</p>
    </InfoPageShell>
    </>
  );
}

export default SubscriptionPage;
