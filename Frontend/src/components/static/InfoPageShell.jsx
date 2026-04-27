import AppLayout from "../../layouts/AppLayout.jsx";

function InfoPageShell({ session, breadcrumbs, title, children }) {
  return (
    <AppLayout session={session} breadcrumbs={breadcrumbs}>
      <article className="mx-auto max-w-3xl space-y-5 text-[15px] leading-relaxed text-[#b8b8e0] sm:text-base">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        <div className="space-y-4 [&_a]:text-[#9b9bf0] [&_a]:underline [&_a]:decoration-[#6f6fdc]/60 [&_a]:underline-offset-2 [&_a]:transition hover:[&_a]:text-[#c4c4ff] [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[#d8d8f4] [&_h2]:first:mt-0 [&_li]:mt-1.5 [&_strong]:text-[#d0d0ee] [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </AppLayout>
  );
}

export default InfoPageShell;
