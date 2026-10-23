import { useMemo, useState } from "react";
import { Bookmark, Check, CircleX, RotateCcw, Tag } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import JobCard from "@/components/JobCard";

export default function SavedPage() {
  const [includeDiscarded, setIncludeDiscarded] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const saved = trpc.saved.list.useQuery({ includeDiscarded }, { retry: false });
  const utils = trpc.useUtils();
  const update = trpc.saved.update.useMutation({ onSuccess: async () => { await utils.saved.list.invalidate(); await utils.jobs.list.invalidate(); toast.success("Cambios guardados"); }, onError: (error) => toast.error(error.message) });
  const candidates = useMemo(() => saved.data ?? [], [saved.data]);
  const allTags = [...new Set(candidates.flatMap((item) => item.tags ?? []))].sort((a, b) => a.localeCompare(b, "es-CL"));
  const visible = useMemo(() => tagFilter ? candidates.filter((item) => item.tags?.includes(tagFilter)) : candidates, [candidates, tagFilter]);
  const editTags = (jobId: string, tags: string[] = []) => {
    const value = window.prompt("Etiquetas privadas, separadas por coma", tags.join(", "));
    if (value === null) return;
    const next = [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
    update.mutate({ jobId, tags: next });
  };
  return <div className="page-wrap">
    <div className="page-heading"><div><span className="eyebrow">TU SEGUIMIENTO</span><h1>Empleos guardados</h1><p>Oportunidades y notas privadas vinculadas a tu cuenta.</p></div><div className="heading-actions"><button className={`button ${includeDiscarded ? "button-primary" : "button-secondary"}`} type="button" onClick={() => setIncludeDiscarded((value) => !value)}><RotateCcw size={14} />{includeDiscarded ? "Ocultar descartadas" : "Incluir descartadas"}</button></div></div>
    {allTags.length > 0 && <div className="saved-tags-toolbar"><span><Tag size={14} /> Filtrar por etiqueta</span>{allTags.map((tag) => <button className={`pill ${tagFilter === tag ? "pill-teal" : ""}`} key={tag} type="button" onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}>{tag}</button>)}{tagFilter && <button type="button" className="button button-quiet button-small" onClick={() => setTagFilter("")}>Quitar filtro</button>}</div>}
    {saved.isLoading ? <div className="surface empty-state"><span className="loading-spinner" /><p>Cargando tus ofertas guardadas…</p></div> : saved.error ? <div className="surface empty-state"><h2>No se pudieron cargar los guardados</h2><p>Inténtalo nuevamente.</p><button className="button button-secondary" onClick={() => saved.refetch()}>Reintentar</button></div> : visible.length === 0 ? <div className="surface empty-state"><div className="empty-icon"><Bookmark size={19} /></div><h2>{candidates.length ? "No hay ofertas con esa etiqueta" : "Aún no has guardado ofertas"}</h2><p>Guarda una oportunidad desde Explorar para revisarla más tarde, agregar una nota o clasificarla.</p>{tagFilter ? <button className="button button-secondary" onClick={() => setTagFilter("")}>Quitar filtro</button> : <Link href="/empleos" className="button button-primary">Explorar empleos</Link>}</div> : <div className="saved-list">{visible.map((job) => <article className={`saved-card surface ${job.discardedAt ? "saved-discarded" : ""}`} key={job.id}><JobCard job={{ ...job, saved: true }} compact /><div className="saved-card-tools"><div className="saved-card-meta">{job.tags?.map((tag: string) => <button className="pill" type="button" key={tag} onClick={() => setTagFilter(tag)}><Tag size={10} />{tag}</button>)}{job.note && <span className="saved-note-preview">Nota: {job.note}</span>}{job.discardedAt && <span className="pill pill-gold"><CircleX size={10} />Descartada</span>}</div><div className="saved-card-actions"><button type="button" className="button button-secondary button-small" onClick={() => editTags(job.id, job.tags)}><Tag size={12} /> Editar etiquetas</button><button type="button" className="button button-secondary button-small" onClick={() => update.mutate({ jobId: job.id, discarded: !job.discardedAt })}>{job.discardedAt ? <><RotateCcw size={12} /> Recuperar</> : <><Check size={12} /> Descartar</>}</button><button type="button" className="button button-quiet button-small" onClick={() => update.mutate({ jobId: job.id, tags: [] })}>Quitar etiquetas</button></div></div></article>)}</div>}
  </div>;
}
