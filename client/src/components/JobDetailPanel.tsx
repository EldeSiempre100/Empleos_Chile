import { useLocation } from "wouter";
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, FileText, MapPin, X, Bookmark } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatJobDate, modalityLabel, salaryLabel } from "./JobCard";
import { toast } from "sonner";

export default function JobDetailPanel({ jobId, onClose }: { jobId: string; onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const detail = trpc.jobs.detail.useQuery({ id: jobId });
  const save = trpc.saved.toggle.useMutation({ onSuccess: async (result) => { toast.success(result.saved ? "Oferta guardada" : "Oferta quitada de guardados"); await utils.jobs.detail.invalidate({ id: jobId }); await utils.jobs.list.invalidate(); } });
  const job = detail.data;
  const openFull = () => setLocation(`/empleos/${jobId}?return=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  if (detail.isLoading) return <aside className="detail-panel"><div className="detail-close"><button className="icon-button" aria-label="Cerrar detalle" onClick={onClose}><X size={18} /></button></div><div className="loading-line" /><div className="loading-line short" /><div className="loading-block" /><div className="loading-block" /></aside>;
  if (detail.error || !job) return <aside className="detail-panel"><div className="detail-close"><button className="icon-button" aria-label="Cerrar detalle" onClick={onClose}><X size={18} /></button></div><div className="empty-state"><div className="empty-icon"><FileText size={19} /></div><h2>No se pudo cargar esta oferta</h2><p>Comprueba el origen almacenado e inténtalo otra vez.</p><button className="button button-secondary button-small" onClick={() => detail.refetch()}>Reintentar</button></div></aside>;
  const source = job.sourceCodes?.join(", ") || "Origen no informado";
  const section = (title: string, icon: React.ReactNode, content: React.ReactNode) => <section className="detail-section"><h3>{icon}{title}</h3>{content}</section>;
  return <aside className="detail-panel" aria-label={`Vista rápida: ${job.title}`}>
    <div className="detail-close"><span className="eyebrow">DETALLE RÁPIDO</span><button className="icon-button" aria-label="Cerrar detalle" onClick={onClose}><X size={18} /></button></div>
    <div className="detail-heading"><div><h2>{job.title}</h2><div className="detail-company">{job.companyConfidential ? "Empresa confidencial" : job.companyName}</div></div><button className={`icon-button ${job.saved ? "is-saved" : ""}`} aria-label={job.saved ? "Quitar de guardados" : "Guardar oferta"} aria-pressed={job.saved} disabled={save.isPending} onClick={() => save.mutate({ jobId })}><Bookmark size={17} fill={job.saved ? "currentColor" : "none"} /></button></div>
    <div className="detail-meta"><span className="pill"><MapPin size={11} />{[job.communeName, job.regionName].filter(Boolean).join(", ") || "Lugar de trabajo no informado"}</span><span className="pill pill-teal">{modalityLabel(job.modality)}</span><span className="pill"><CalendarClock size={11} />{formatJobDate(job.publishedAt)}</span></div>
    <div className="detail-salary"><strong>{salaryLabel(job)}</strong><span>{job.salaryBasis === "gross" ? "Sueldo bruto" : job.salaryBasis === "net" ? "Sueldo líquido" : "Base no especificada"}{job.salaryIsDisclosed ? " · mensual" : ""}</span></div>
    {section("Descripción", <FileText size={13} />, <p>{job.description?.trim() || "No informada."}</p>)}
    {section("Funciones", <BriefcaseBusiness size={13} />, job.responsibilities?.length ? <ul>{job.responsibilities.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul> : <p>No informadas.</p>)}
    {section("Requisitos", <CheckCircle2 size={13} />, job.requirements?.length ? <ul>{job.requirements.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul> : <p>No informados.</p>)}
    {section("Condiciones", <Clock3 size={13} />, <p>{[job.schedule, job.contractType, job.seniority, job.experienceMinYears == null ? "Experiencia no informada" : `${job.experienceMinYears} años de experiencia`].filter(Boolean).join(" · ") || "No informadas."}</p>)}
    {section("Origen y verificación", <CalendarClock size={13} />, <p>{source}<br />Verificada: {formatJobDate(job.lastVerifiedAt)}<br />Estado: {job.verificationStatus === "vigente" ? "Vigente" : job.verificationStatus === "vencido" ? "Vencida" : job.verificationStatus === "archivado" ? "Archivada" : "Por verificar"}</p>)}
    <button className="button button-secondary button-small" style={{ width: "100%", marginTop: 14 }} onClick={openFull}>Abrir ficha completa <ArrowUpRight size={14} /></button>
    {job.canonicalUrl && <a className="button detail-original" href={job.canonicalUrl} target="_blank" rel="noopener noreferrer">Ver oferta original <ArrowUpRight size={14} /></a>}
  </aside>;
}
