import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";
import PageContainer from "../../components/ui/PageContainer.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Input from "../../components/ui/Input.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { Skeleton } from "../../components/ui/Skeleton.jsx";
import { useUserSearch } from "../../features/observe/hooks/useUserSearch.js";
import { UserResultRow } from "../../components/observe/UserResultRow.jsx";
import { SearchIcon, UsersIcon } from "../../components/icons/index.jsx";

function UserSearchPage({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const { results, loading, status } = useUserSearch(value);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    const next = new URLSearchParams(searchParams);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  return (
    <AppLayout session={session} breadcrumbs={[{ label: "Find People" }]}>
      <PageHead title="Find People" description="Search for people to observe on watchpapa." path="/users" noindex />
      <PageContainer width="narrow" className="space-y-5">
        <PageHeader title="Find People" subtitle="Search by username and observe other watchers.">
          <div className="relative">
            <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input value={value} onChange={handleChange} autoFocus placeholder="Search usernames…" className="rounded-2xl pl-11" aria-label="Search usernames" />
          </div>
        </PageHeader>
        {loading && results.length === 0 && <div className="space-y-2"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-14 rounded-xl" /></div>}
        {status === "done" && results.length === 0 && <EmptyState compact icon={UsersIcon} title="No users found" />}
        {results.length > 0 && <div className="space-y-2">{results.map((u) => <UserResultRow key={u.id} user={u} session={session} />)}</div>}
      </PageContainer>
    </AppLayout>
  );
}

export default UserSearchPage;
