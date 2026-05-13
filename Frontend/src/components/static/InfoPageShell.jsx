import AppLayout from "../../layouts/AppLayout.jsx";

function InfoPageShell({ session, breadcrumbs, title, lead, children }) {
  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <article className="mx-auto max-w-2xl">
        {/* Page header */}
        <header className="mb-10 border-b border-[#1a1f3a] pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
          {lead && (
            <p className="mt-4 text-base leading-relaxed text-[#8080a8] sm:text-[17px]">{lead}</p>
          )}
        </header>

        {/* Body */}
        <div
          className={[
            "space-y-6 text-[15px] leading-relaxed text-[#b0b0d4] sm:text-base",
            /* links */
            "[&_a]:text-[#9b9bf0] [&_a]:underline [&_a]:decoration-[#6f6fdc]/50 [&_a]:underline-offset-2 [&_a]:transition hover:[&_a]:text-[#c8c8ff] hover:[&_a]:decoration-[#9b9bf0]",
            /* h2 sections */
            "[&_h2]:mt-10 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-3 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-[0.1em] [&_h2]:text-[#9b9bf0] first:[&_h2]:mt-0",
            "[&_h2]:before:block [&_h2]:before:h-px [&_h2]:before:w-5 [&_h2]:before:shrink-0 [&_h2]:before:bg-[#6f6fdc]",
            /* h3 */
            "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#d0d0ee] first:[&_h3]:mt-0",
            /* lists */
            "[&_ul]:list-none [&_ul]:space-y-2 [&_ul]:pl-0",
            "[&_ul_li]:flex [&_ul_li]:gap-3",
            "[&_ul_li]:before:mt-[0.35em] [&_ul_li]:before:block [&_ul_li]:before:h-1.5 [&_ul_li]:before:w-1.5 [&_ul_li]:before:shrink-0 [&_ul_li]:before:rounded-full [&_ul_li]:before:bg-[#4a4a8a]",
            "[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
            /* strong */
            "[&_strong]:font-semibold [&_strong]:text-[#d0d0ee]",
            /* small / muted */
            "[&_.muted]:text-[#5a5a78] [&_.muted]:text-sm",
          ].join(" ")}
        >
          {children}
        </div>
      </article>
    </AppLayout>
  );
}

export default InfoPageShell;
