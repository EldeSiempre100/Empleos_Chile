import { ArrowRight, CalendarClock, Edit3, Play, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import type { JobFilters } from "@shared/domain";
import { trpc } from "@/lib/trpc";

function buildFilterQuery(filters: JobFilters) {
  const params = new URLSearchParams();
  const keys: Record<string,string> = { regions: "region", communes: "commune", modalities: "modality", categories: "category", subcategories: "subcategory", seniorities: "seniority", experience: "experience", education: "education", schedules: "schedule", contracts: "contract", companies: "company", sources: "source", sectors: "sector", statuses: "status", publishedWithinDays: "days", dateBasis: "dateBasis", dateFrom: "from", dateTo: "to", salaryMin: "salaryMin", salaryMax: "salaryMax", sort: "sort" };
  for (const [key,value] of Object.entries(filters)) {
    if (value === undefined || value === null || key === "page" || key === "pageSize") continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(keys[key] ?? key,String(item)));
    else if (key === "salaryBasis") { if (value !== "any") params.set("basis",String(value)); }
    else if (key === "includeUnknownModality") { if (value) params.set("unknownModality","true"); }
    else if (key === "includeUndisclosedSalary") { if (!value) params.set("undisclosed","false"); }
    else if (key === "withOriginalUrl") { if (value) params.set("withUrl","true"); }
    else params.set(keys[key] ?? key,String(value));
  }
  return params.toString();
}
function summary(filters: JobFilters) {
  const parts: string[] = [];
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.regions?.length) parts.push(`${filters.regions.length} región(es)`);
  if (filters.communes?.length) parts.push(`${filters.communes.length} comuna(s)`);
  if (filters.modalities?.length) parts.push(filters.modalities.join(", "));
  if (filters.salaryMin || filters.salaryMax) parts.push(`Renta ${filters.salaryMin ?? "0"}–${filters.salaryMax ?? "sin tope"}`);
  if (filters.categories?.length) parts.push(filters.categories.join(", "));
  if (filters.subcategories?.length) parts.push(filters.subcategories.join(", "));
  if (filters.dateFrom || filters.dateTo) parts.push(`Fecha ${filters.dateFrom ?? "inicio"}–${filters.dateTo ?? "hoy"}`);
  if (filters.dateBasis === "verification") parts.push("fecha de verificación");
  if (filters.sort && filters.sort !== "recent") parts.push(`orden ${filters.sort}`);
  return parts.length ? parts.join(" · ") : "Sin criterios registrados";
}

export default function SearchesPage() {
  const [, setLocation] = useLocation();
  const searches = trpc.searches.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const execute = trpc.searches.execute.useMutation({ onSuccess: async (result) => { await utils.searches.list.invalidate(); const query = buildFilterQuery(result.search.filters as JobFilters); const params = new URLSearchParams(query); params.set("savedSearchId", result.search.id); setLocation(`/empleos?${params.toString()}`); }, onError: (error) => toast.error(error.message) });
  const update = trpc.searches.update.useMutation({ onSuccess: () => { toast.success("Búsqueda actualizada"); utils.searches.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const remove = trpc.searches.delete.useMutation({ onSuccess: () => { toast.success("Búsqueda eliminada"); utils.searches.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  return <div className="page-wrap">
    <div className="page-heading"><div><span className="eyebrow">CRITERIOS A TU MEDIDA</span><h1>Búsquedas guardadas</h1><p>Repite una búsqueda con sus filtros, modifica los criterios en Explorar y revisa cuándo se ejecutó por última vez.</p></div><Link className="button button-primary" href="/empleos"><Search size={14} /> Crear desde Explorar</Link></div>
    {searches.isLoading ? <div className="surface empty-state"><span className="loading-spinner" /><p>Cargando búsquedas…</p></div> : searches.error ? <div className="surface empty-state"><h2>No se pudieron cargar las búsquedas</h2><button className="button button-secondary" onClick={() => searches.refetch()}>Reintentar</button></div> : searches.data?.length ? <div className="list-panel">{searches.data.map((item) => { const filters = item.filters as JobFilters; const query = buildFilterQuery(filters); const editUrl = `/empleos${query ? `?${query}&savedSearchId=${encodeURIComponent(item.id)}` : `?savedSearchId=${encodeURIComponent(item.id)}`}`; return <article className="list-row search-saved-row" key={item.id}><div className="search-icon"><SlidersHorizontal size={16} /></div><div className="list-row-main"><h2 className="list-row-title">{item.name}</h2><div className="list-row-sub">{summary(filters)}</div><div className="saved-search-meta"><span><strong>{item.resultCount}</strong> resultados en la última ejecución</span><span><CalendarClock size={11} />{item.lastExecutedAt ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(item.lastExecutedAt)) : "Aún no ejecutada"}</span></div></div><div className="list-row-actions"><button className="button button-primary button-small" type="button" disabled={execute.isPending} onClick={() => execute.mutate({ id: item.id })}><Play size={13} /> Ejecutar <ArrowRight size={12} /></button><Link className="button button-secondary button-small" href={editUrl}><Edit3 size={12} /> Ajustar criterios</Link><button className="button button-quiet button-small" type="button" onClick={() => { const name = window.prompt("Editar nombre de búsqueda", item.name); if (name?.trim()) update.mutate({ id: item.id, name: name.trim() }); }}>Renombrar</button><button className="icon-button" type="button" aria-label={`Eliminar búsqueda ${item.name}`} onClick={() => { if (window.confirm(`¿Eliminar la búsqueda “${item.name}”?`)) remove.mutate({ id: item.id }); }}><Trash2 size={15} /></button></div></article>; })}</div> : <div className="surface empty-state"><div className="empty-icon"><Search size={19} /></div><h2>Aún no tienes búsquedas guardadas</h2><p>En Explorar, ajusta tus criterios y selecciona “Guardar búsqueda”.</p><Link className="button button-primary" href="/empleos">Explorar empleos</Link></div>}
  </div>;
}
