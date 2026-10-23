import {
  ArrowUpRight,
  Bookmark,
  MapPin,
  Clock3,
  CircleDollarSign,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import type { JobRecord } from "@shared/domain";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type JobCardProps = {
  job: JobRecord & { saved?: boolean };
  selected?: boolean;
  compact?: boolean;
  returnTo?: string;
  onSelect?: () => void;
};
const sourceLabels: Record<string, string> = {
  manual: "Carga manual",
  bne: "BNE",
  chiletrabajos: "ChileTrabajos",
  laborum: "Laborum",
  trabajando: "Trabajando",
  trabajando_cl: "Trabajando.cl",
  laborum_cl: "Laborum Chile",
  computrabajo: "Computrabajo",
  computrabajo_cl: "Computrabajo",
  empleos_publicos: "Empleos Públicos",
  getonbrd_cl: "Get on Board",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  recruitee: "Recruitee",
  other_ats: "Otro ATS",
  corporate: "Corporativo",
  other: "Otra fuente",
};

export function formatCLP(value?: number | null) {
  return value == null
    ? ""
    : new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }).format(value);
}
export function formatJobDate(value?: string | Date | null) {
  if (!value) return "Fecha no informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no informada";
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeZone: "America/Santiago",
  }).format(date);
}
export function salaryLabel(job: JobRecord) {
  const rawSalary = job.salaryRaw?.trim() ?? "";
  const rawKey = rawSalary
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    job.salaryVisibility === "reserved" ||
    /\b(?:reservad[oa]|confidencial)\b/.test(rawKey)
  )
    return "Sueldo reservado";
  if (
    job.salaryVisibility === "not_disclosed" &&
    !/\b(?:a convenir|negociable)\b/.test(rawKey)
  )
    return "Sueldo no informado";
  if (/^(?:sueldo )?(?:no informado|no publicado|no divulgado|sin renta)$/.test(rawKey))
    return "Sueldo no informado";
  if (job.salaryMinCLP != null && job.salaryMaxCLP != null)
    return `${formatCLP(job.salaryMinCLP)} – ${formatCLP(job.salaryMaxCLP)}`;
  if (job.salaryMinCLP != null)
    return `Desde ${formatCLP(job.salaryMinCLP)}`;
  if (job.salaryMaxCLP != null) return `Hasta ${formatCLP(job.salaryMaxCLP)}`;
  if (rawSalary) return rawSalary.slice(0, 120);
  const sourceMin = job.salaryMinSource;
  const sourceMax = job.salaryMaxSource;
  if (sourceMin != null || sourceMax != null) {
    const formatSource = (value: number | string) => {
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(numeric)
        : String(value);
    };
    const currency = job.salaryCurrency ? `${job.salaryCurrency} ` : "";
    const amount =
      sourceMin != null && sourceMax != null
        ? `${formatSource(sourceMin)} – ${formatSource(sourceMax)}`
        : sourceMin != null
          ? `Desde ${formatSource(sourceMin)}`
          : `Hasta ${formatSource(sourceMax!)}`;
    const period = job.salaryPeriod && job.salaryPeriod !== "unknown"
      ? ` · ${job.salaryPeriod}`
      : "";
    return `${currency}${amount}${period}`.trim();
  }
  if (!job.salaryIsDisclosed || job.salaryVisibility === "not_disclosed")
    return "Sueldo no informado";
  return job.salaryMinCLP != null
    ? `Desde ${formatCLP(job.salaryMinCLP)}`
    : "Sueldo no informado";
}
export function modalityLabel(value?: string | null) {
  return (
    (
      {
        presencial: "Presencial",
        hibrida: "Híbrida",
        remota: "Remota",
        no_informada: "Modalidad no informada",
      } as Record<string, string>
    )[value ?? ""] ?? "Modalidad no informada"
  );
}

export default function JobCard({
  job,
  selected,
  compact,
  returnTo,
  onSelect,
}: JobCardProps) {
  const utils = trpc.useUtils();
  const save = trpc.saved.toggle.useMutation({
    onSuccess: async result => {
      toast.success(
        result.saved ? "Oferta guardada" : "Oferta quitada de guardados"
      );
      await utils.jobs.list.invalidate();
      await utils.saved.list.invalidate();
      await utils.jobs.detail.invalidate({ id: job.id });
    },
  });
  const company = job.companyConfidential
    ? "Empresa confidencial"
    : job.companyName || "Empresa no informada";
  const monogram =
    company
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase() || "EC";
  const color =
    job.id.charCodeAt(0) % 3 === 0
      ? "gold"
      : job.id.charCodeAt(0) % 3 === 1
        ? "blue"
        : "";
  const source =
    (job.sourceCodes ?? []).map(id => sourceLabels[id] ?? id).join(", ") ||
    "Origen no informado";
  const salary = salaryLabel(job);
  const location =
    [job.communeName, job.regionName].filter(Boolean).join(", ") ||
    "Ubicación no informada";
  return (
    <article
      className={`job-card ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${job.title}, ${company}`}
      onClick={onSelect}
      onKeyDown={event => {
        if ((event.key === "Enter" || event.key === " ") && onSelect) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="job-card-top">
        <div className={`company-monogram ${color}`} aria-hidden="true">
          {monogram}
        </div>
        <div className="job-card-main">
          <h2 className="job-card-title">{job.title}</h2>
          <div className="job-company">{company}</div>
        </div>
        <button
          type="button"
          className={`icon-button job-save ${job.saved ? "is-saved" : ""}`}
          aria-label={job.saved ? "Quitar de guardados" : "Guardar oferta"}
          aria-pressed={Boolean(job.saved)}
          disabled={save.isPending}
          onClick={event => {
            event.stopPropagation();
            save.mutate({ jobId: job.id });
          }}
        >
          <Bookmark size={16} fill={job.saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="job-meta">
        <span className="pill">
          <MapPin size={11} />
          {location}
        </span>
        <span className="pill pill-teal">{modalityLabel(job.modality)}</span>
        {salary !== "Sueldo no informado" && (
          <span className="pill pill-gold">
            <CircleDollarSign size={11} />
            {salary}
          </span>
        )}
        {job.seniority && (
          <span className="pill pill-outline">{job.seniority}</span>
        )}
        {job.schedule && (
          <span className="pill pill-outline">{job.schedule}</span>
        )}
      </div>
      {!compact && (
        <p className="job-excerpt">
          {job.description?.trim()
            ? job.description.replace(/\s+/g, " ").slice(0, 230)
            : "Descripción no informada."}
        </p>
      )}
      <div className="job-card-bottom">
        <span className="job-source">
          <span className="job-source-dot" />
          {source}
          <span aria-hidden="true">·</span>
          <Clock3 size={11} />
          {formatJobDate(job.publishedAt)}
        </span>
        <div className="job-card-actions">
          <button
            type="button"
            className="job-card-link"
            onClick={event => {
              event.stopPropagation();
              onSelect?.();
            }}
          >
            Vista rápida <ChevronRight size={13} />
          </button>
          <Link
            href={`/empleos/${job.id}${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ""}`}
            className="job-card-link"
            onClick={event => {
              event.stopPropagation();
              sessionStorage.setItem("empleos:scroll", String(window.scrollY));
            }}
            aria-label={`Ver ficha de ${job.title}`}
          >
            Ver ficha <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}
