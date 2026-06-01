import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import { useUserSearch } from "../../features/observe/hooks/useUserSearch.js";
import { UserResultRow } from "../../components/observe/UserResultRow.jsx";

function UserSearchPage({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [value, setValue] = useState(qFromUrl);
  const { results, loading, status } = useUserSearch(value);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    const next = new URLSearchParams(searchParams);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const showEmpty = status === "done" && results.length === 0;

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Find People" }]}>
      <PageHead title="Find People" description="Search for people to observe on watchpapa." path="/users" noindex />
      <div className="mx-auto max-w-2xl space-y-6 py-6 px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Find People</h1>
          <p className="mt-1 text-sm text-[#8888c8]">Search by username and observe other watchers.</p>
        </div>

        <div className="relative">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5050a0" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={value}
            onChange={handleChange}
            autoFocus
            placeholder="Search usernames…"
            className="w-full rounded-2xl border border-[#2a2f5a] bg-[#0d0f1e] py-3 pl-11 pr-4 text-sm text-white placeholder-[#4a4a7a] outline-none transition focus:border-[#5a5aaa]"
          />
        </div>

        {loading && results.length === 0 && (
          <div className="animate-pulse space-y-2">
            <div className="h-14 rounded-xl bg-[#1a1f3a]" />
            <div className="h-14 rounded-xl bg-[#1a1f3a]" />
          </div>
        )}

        {showEmpty && (
          <p className="py-12 text-center text-sm text-[#4a4a7a]">No users found.</p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((u) => (
              <UserResultRow key={u.id} user={u} session={session} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default UserSearchPage;
