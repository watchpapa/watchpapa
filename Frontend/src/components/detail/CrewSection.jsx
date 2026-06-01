import { Link } from "react-router-dom";

function CrewSection({ crew = [] }) {
  if (!crew.length) return null;

  return (
    <div className="space-y-5">
      {crew.map(({ department, jobs }) => (
        <div key={department}>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#c084fc]">
            {department}
          </h4>
          <div className="space-y-2">
            {jobs.map(({ job, people }) => (
              <div key={job} className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
                <span className="shrink-0 font-semibold text-[#a78bfa] sm:w-24 md:w-36">{job}</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {people.map((p) => (
                    <Link
                      key={p.id}
                      to={`/people/${p.personId}`}
                      className="text-[#c0c0e8] transition hover:text-white"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CrewSection;
