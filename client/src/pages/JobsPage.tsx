import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  ListFilter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { JobFilters, Modality } from "@shared/domain";
import { normalizeText } from "@shared/normalization";
import { communes, regions } from "@shared/locations";
import { trpc } from "@/lib/trpc";
import JobCard from "@/components/JobCard";
import JobDetailPanel from "@/components/JobDetailPanel";
import FilterFacet from "@/components/FilterFacet";

const modalities: Array<{ value: Modality; label: string }> = [
  { value: "presencial", label: "Presencial" },
  { value: "hibrida", label: "Híbrida" },
  { value: "remota", label: "Remota" },
];
const categories = [
  "Administración",
  "Finanzas",
  "Comercial",
  "Salud",
  "Logística",
  "Tecnología",
  "Construcción",
  "Minería",
  "Educación",
  "Servicios",
  "Sector público",
  "Industria",
  "Retail",
];
const seniority = [
  "Operativo",
  "Técnico",
  "Administrativo",
  "Profesional",
  "Analista",
  "Coordinación",
  "Supervisión",
  "Jefatura",
  "Subgerencia",
  "Gerencia",
];
const sources = [
  { value: "manual", label: "Carga manual" },
  { value: "bne", label: "BNE" },
  { value: "chiletrabajos", label: "ChileTrabajos" },
  { value: "laborum", label: "Laborum" },
  { value: "trabajando", label: "Trabajando" },
  { value: "computrabajo", label: "Computrabajo" },
  { value: "empleos_publicos", label: "Empleos Públicos" },
  { value: "corporate", label: "Corporativo" },
  { value: "other", label: "Otra fuente" },
];

function readUrlFilters(): JobFilters {
  const params = new URLSearchParams(window.location.search);
  const getList = (key: string) => params.getAll(key).filter(Boolean);
  const number = (key: string) => {
    const value = params.get(key);
    return value && Number.isFinite(Number(value)) ? Number(value) : undefined;
  };
  return {
    q: params.get("q") ?? "",
    regions: getList("region"),
    communes: getList("commune"),
    modalities: params.has("modality")
      ? (getList("modality") as Modality[])
      : ["presencial"],
    includeUnknownModality: params.get("unknownModality") === "true",
    publishedWithinDays: number("days"),
    dateBasis:
      params.get("dateBasis") === "verification"
        ? "verification"
        : "publication",
    dateFrom: params.get("from") ?? undefined,
    dateTo: params.get("to") ?? undefined,
    salaryMin: number("salaryMin"),
    salaryMax: number("salaryMax"),
    salaryBasis: (params.get("basis") as JobFilters["salaryBasis"]) ?? "any",
    includeUndisclosedSalary: params.get("undisclosed") !== "false",
    categories: getList("category"),
    subcategories: getList("subcategory"),
    seniorities: getList("seniority"),
    experience: getList("experience"),
    education: getList("education"),
    schedules: getList("schedule"),
    contracts: getList("contract"),
    companies: getList("company"),
    sources: getList("source"),
    sectors: getList("sector"),
    statuses: getList("status") as JobFilters["statuses"],
    withOriginalUrl: params.get("withUrl") === "true",
    sort: (params.get("sort") as JobFilters["sort"]) ?? "recent",
    page: number("page") ?? 1,
    pageSize: 20,
  };
}
function writeUrlFilters(filters: JobFilters) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const arrays: Array<[string, string[] | undefined]> = [
    ["region", filters.regions],
    ["commune", filters.communes],
    ["modality", filters.modalities],
    ["category", filters.categories],
    ["subcategory", filters.subcategories],
    ["seniority", filters.seniorities],
    ["experience", filters.experience],
    ["education", filters.education],
    ["schedule", filters.schedules],
    ["contract", filters.contracts],
    ["company", filters.companies],
    ["source", filters.sources],
    ["sector", filters.sectors],
    ["status", filters.statuses],
  ];
  arrays.forEach(([key, values]) =>
    values?.forEach(value => params.append(key, value))
  );
  if (filters.includeUnknownModality) params.set("unknownModality", "true");
  if (filters.publishedWithinDays)
    params.set("days", String(filters.publishedWithinDays));
  if (filters.dateBasis === "verification")
    params.set("dateBasis", "verification");
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.salaryMin) params.set("salaryMin", String(filters.salaryMin));
  if (filters.salaryMax) params.set("salaryMax", String(filters.salaryMax));
  if (filters.salaryBasis && filters.salaryBasis !== "any")
    params.set("basis", filters.salaryBasis);
  if (!filters.includeUndisclosedSalary) params.set("undisclosed", "false");
  if (filters.withOriginalUrl) params.set("withUrl", "true");
  if (filters.sort && filters.sort !== "recent")
    params.set("sort", filters.sort);
  if ((filters.page ?? 1) > 1) params.set("page", String(filters.page));
  const savedSearchId = new URLSearchParams(window.location.search).get(
    "savedSearchId"
  );
  if (savedSearchId && /^[a-f0-9]{24}$/i.test(savedSearchId))
    params.set("savedSearchId", savedSearchId);
  const query = params.toString();
  window.history.replaceState({}, "", `/empleos${query ? `?${query}` : ""}`);
}

export default function JobsPage() {
  const [filters, setFilters] = useState<JobFilters>(() => readUrlFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const utils = trpc.useUtils();
  const currentUser = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const list = trpc.jobs.list.useQuery(filters, {
    retry: false,
    placeholderData: previous => previous,
  });
  const saved = trpc.saved.list.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });
  const savedSearchList = trpc.searches.list.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });
  const facetsQuery = trpc.jobs.facets.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const searches = trpc.searches.create.useMutation({
    onSuccess: () => toast.success("Búsqueda guardada"),
  });
  const updateSearch = trpc.searches.update.useMutation({
    onSuccess: () => {
      toast.success("Criterios de búsqueda actualizados");
      utils.searches.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const regionsOptions = useMemo(
    () => regions.map(({ code, name }) => ({ value: code, label: name })),
    []
  );
  const communesOptions = useMemo(
    () =>
      communes
        .filter(
          item =>
            !filters.regions?.length ||
            filters.regions.includes(item.regionCode)
        )
        .map(item => ({ value: item.communeCode, label: item.communeName })),
    [filters.regions]
  );
  const baseRegionNames =
    filters.regions?.map(
      code => regions.find(region => region.code === code)?.name ?? code
    ) ?? [];
  const activeCount = [
    Boolean(filters.q),
    (filters.regions?.length ?? 0) > 0,
    (filters.communes?.length ?? 0) > 0,
    filters.modalities?.join(",") !== "presencial",
    Boolean(
      filters.publishedWithinDays ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.dateBasis === "verification"
    ),
    Boolean(
      filters.salaryMin ||
        filters.salaryMax ||
        (filters.salaryBasis && filters.salaryBasis !== "any") ||
        filters.includeUndisclosedSalary === false
    ),
    (filters.categories?.length ?? 0) > 0,
    (filters.subcategories?.length ?? 0) > 0,
    (filters.seniorities?.length ?? 0) > 0,
    (filters.experience?.length ?? 0) > 0,
    (filters.education?.length ?? 0) > 0,
    (filters.schedules?.length ?? 0) > 0,
    (filters.contracts?.length ?? 0) > 0,
    (filters.companies?.length ?? 0) > 0,
    (filters.sources?.length ?? 0) > 0,
    (filters.sectors?.length ?? 0) > 0,
    Boolean(filters.includeUnknownModality),
    Boolean(filters.withOriginalUrl),
    Boolean(filters.statuses?.length),
  ].filter(Boolean).length;
  const jobSavedIds = useMemo(
    () => new Set((saved.data ?? []).map(item => item.id)),
    [saved.data]
  );

  const update = useCallback((patch: Partial<JobFilters>) => {
    setFilters(current => {
      const next = {
        ...current,
        ...patch,
        page: patch.page ?? 1,
        pageSize: 20,
      };
      setDraftQuery(next.q ?? "");
      writeUrlFilters(next);
      return next;
    });
  }, []);
  const toggleModality = (value: Modality) => {
    const next = new Set(filters.modalities ?? ["presencial"]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (!next.size) {
      toast.info(
        "Mantén una modalidad seleccionada. Activa Híbrida o Remota antes de quitar Presencial."
      );
      return;
    }
    update({ modalities: [...next] as Modality[] });
  };
  const reset = () => {
    const next: JobFilters = {
      q: "",
      modalities: ["presencial"],
      includeUnknownModality: false,
      includeUndisclosedSalary: true,
      sort: "recent",
      page: 1,
      pageSize: 20,
    };
    setFilters(next);
    setDraftQuery("");
    writeUrlFilters(next);
    setSelectedId(null);
  };

  useEffect(() => {
    const onGlobalSearch = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      setDraftQuery(value);
      update({ q: value, page: 1 });
    };
    const onPopState = () => {
      const next = readUrlFilters();
      setFilters(next);
      setDraftQuery(next.q ?? "");
    };
    window.addEventListener("employments:search", onGlobalSearch);
    window.addEventListener("popstate", onPopState);
    const previousScroll = sessionStorage.getItem("empleos:scroll");
    if (previousScroll) {
      window.scrollTo(0, Number(previousScroll));
      sessionStorage.removeItem("empleos:scroll");
    }
    return () => {
      window.removeEventListener("employments:search", onGlobalSearch);
      window.removeEventListener("popstate", onPopState);
    };
  }, [update]);

  const optionsFromFacets = (
    items: Array<{ value: string; count: number }> | undefined
  ) => (items ?? []).map(item => ({ ...item, label: item.value }));
  const dynamicOptionSet = (
    staticValues: string[],
    items: Array<{ value: string; count: number }> | undefined
  ) => [
    ...new Map([
      ...staticValues.map(
        value => [normalizeText(value), { value, label: value }] as const
      ),
      ...(items ?? []).map(
        item =>
          [
            normalizeText(item.value),
            { value: item.value, label: item.value, count: item.count },
          ] as const
      ),
    ]).values(),
  ];
  const saveSearch = () => {
    const existingId = new URLSearchParams(window.location.search).get(
      "savedSearchId"
    );
    const existing = existingId
      ? savedSearchList.data?.find(item => item.id === existingId)
      : undefined;
    const name = window.prompt(
      existing ? "Nombre de la búsqueda guardada" : "Nombre para esta búsqueda",
      existing?.name ?? ""
    );
    if (!name?.trim()) return;
    const savedFilters = { ...filters };
    delete savedFilters.page;
    delete savedFilters.pageSize;
    if (existingId)
      updateSearch.mutate({
        id: existingId,
        name: name.trim(),
        filters: savedFilters,
      });
    else
      searches.mutate(
        { name: name.trim(), filters: savedFilters },
        {
          onSuccess: () => utils.searches.list.invalidate(),
          onError: error => toast.error(error.message),
        }
      );
  };
  const clearOne = (key: keyof JobFilters, value?: string) => {
    const current = filters[key];
    if (Array.isArray(current))
      update({
        [key]: value ? current.filter(item => item !== value) : [],
      } as Partial<JobFilters>);
    else if (key === "q") update({ q: "" });
    else if (key === "salaryMin" || key === "salaryMax")
      update({ [key]: undefined });
    else if (key === "publishedWithinDays")
      update({ publishedWithinDays: undefined });
    else if (key === "dateFrom") update({ dateFrom: undefined });
    else if (key === "dateTo") update({ dateTo: undefined });
    else if (key === "dateBasis")
      update({
        dateBasis: "publication",
        publishedWithinDays: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
    else if (key === "salaryBasis") update({ salaryBasis: "any" });
    else if (key === "includeUndisclosedSalary")
      update({ includeUndisclosedSalary: true });
    else if (key === "includeUnknownModality")
      update({ includeUnknownModality: false });
    else if (key === "withOriginalUrl") update({ withOriginalUrl: false });
  };
  const chips = [
    ...(filters.q ? [{ label: `“${filters.q}”`, key: "q" as const }] : []),
    ...(filters.regions ?? []).map(code => ({
      label: regions.find(item => item.code === code)?.name ?? code,
      key: "regions" as const,
      value: code,
    })),
    ...(filters.communes ?? []).map(code => ({
      label:
        communes.find(item => item.communeCode === code)?.communeName ?? code,
      key: "communes" as const,
      value: code,
    })),
    ...(filters.modalities ?? [])
      .filter(item => item !== "presencial")
      .map(item => ({
        label:
          modalities.find(modality => modality.value === item)?.label ?? item,
        key: "modalities" as const,
        value: item,
      })),
    ...(filters.categories ?? []).map(value => ({
      label: value,
      key: "categories" as const,
      value,
    })),
    ...(filters.subcategories ?? []).map(value => ({
      label: value,
      key: "subcategories" as const,
      value,
    })),
    ...(filters.seniorities ?? []).map(value => ({
      label: value,
      key: "seniorities" as const,
      value,
    })),
    ...(filters.companies ?? []).map(value => ({
      label: value,
      key: "companies" as const,
      value,
    })),
    ...(filters.sources ?? []).map(value => ({
      label: sources.find(item => item.value === value)?.label ?? value,
      key: "sources" as const,
      value,
    })),
    ...(filters.experience ?? []).map(value => ({
      label: `Experiencia ${value}`,
      key: "experience" as const,
      value,
    })),
    ...(filters.education ?? []).map(value => ({
      label: `Formación ${value}`,
      key: "education" as const,
      value,
    })),
    ...(filters.schedules ?? []).map(value => ({
      label: `Jornada ${value}`,
      key: "schedules" as const,
      value,
    })),
    ...(filters.contracts ?? []).map(value => ({
      label: `Contrato ${value}`,
      key: "contracts" as const,
      value,
    })),
    ...(filters.salaryMin
      ? [
          {
            label: `Desde ${filters.salaryMin.toLocaleString("es-CL")}`,
            key: "salaryMin" as const,
          },
        ]
      : []),
    ...(filters.salaryMax
      ? [
          {
            label: `Hasta ${filters.salaryMax.toLocaleString("es-CL")}`,
            key: "salaryMax" as const,
          },
        ]
      : []),
    ...(filters.salaryBasis && filters.salaryBasis !== "any"
      ? [
          {
            label: `Base ${filters.salaryBasis === "gross" ? "bruta" : filters.salaryBasis === "net" ? "líquida" : "no informada"}`,
            key: "salaryBasis" as const,
          },
        ]
      : []),
    ...(filters.includeUndisclosedSalary === false
      ? [
          {
            label: "Solo ofertas con renta declarada",
            key: "includeUndisclosedSalary" as const,
          },
        ]
      : []),
    ...(filters.publishedWithinDays
      ? [
          {
            label: `Últimos ${filters.publishedWithinDays} días`,
            key: "publishedWithinDays" as const,
          },
        ]
      : []),
    ...(filters.dateFrom
      ? [{ label: `Desde ${filters.dateFrom}`, key: "dateFrom" as const }]
      : []),
    ...(filters.dateTo
      ? [{ label: `Hasta ${filters.dateTo}`, key: "dateTo" as const }]
      : []),
    ...(filters.dateBasis === "verification"
      ? [{ label: "Fecha de verificación", key: "dateBasis" as const }]
      : []),
    ...(filters.sectors ?? []).map(value => ({
      label: `Sector ${value}`,
      key: "sectors" as const,
      value,
    })),
    ...(filters.statuses ?? []).map(value => ({
      label: `Estado ${value.replaceAll("_", " ")}`,
      key: "statuses" as const,
      value,
    })),
    ...(filters.withOriginalUrl
      ? [{ label: "Con oferta original", key: "withOriginalUrl" as const }]
      : []),
    ...(filters.includeUnknownModality
      ? [
          {
            label: "Modalidad no informada",
            key: "includeUnknownModality" as const,
          },
        ]
      : []),
  ];

  const renderFilters = () => (
    <>
      <div className="filter-panel-head">
        <strong>Filtros</strong>
        <span className="filter-count">
          {activeCount ? `${activeCount} activos` : "Chile · Presencial"}
        </span>
      </div>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Ubicación</span>
          <button
            type="button"
            onClick={() => update({ regions: [], communes: [] })}
          >
            Limpiar
          </button>
        </div>
        <FilterFacet
          label="Regiones"
          options={regionsOptions}
          values={filters.regions ?? []}
          onChange={values =>
            update({
              regions: values,
              communes: (filters.communes ?? []).filter(code =>
                communes.some(
                  item =>
                    values.includes(item.regionCode) &&
                    item.communeCode === code
                )
              ),
            })
          }
          placeholder={
            baseRegionNames.length
              ? `${baseRegionNames.length} región(es)`
              : "Seleccionar regiones"
          }
        />
        <div style={{ height: 7 }} />
        <FilterFacet
          label="Comunas"
          options={communesOptions}
          values={filters.communes ?? []}
          onChange={values => update({ communes: values })}
          placeholder="Todas las comunas"
          maxHeight={270}
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Modalidad</span>
          <button
            type="button"
            onClick={() =>
              update({
                modalities: ["presencial"],
                includeUnknownModality: false,
              })
            }
          >
            Restablecer
          </button>
        </div>
        <div className="filter-option-list">
          {modalities.map(item => (
            <label className="filter-option" key={item.value}>
              <input
                type="checkbox"
                checked={(filters.modalities ?? ["presencial"]).includes(
                  item.value
                )}
                onChange={() => toggleModality(item.value)}
              />
              <span>
                {item.label}
                {item.value === "hibrida"
                  ? " · opcional"
                  : item.value === "remota"
                    ? " · excluir exterior"
                    : ""}
              </span>
            </label>
          ))}
          <label className="filter-option">
            <input
              type="checkbox"
              checked={Boolean(filters.includeUnknownModality)}
              onChange={event =>
                update({ includeUnknownModality: event.target.checked })
              }
            />
            <span>Incluir modalidad no informada</span>
          </label>
        </div>
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Fecha de publicación/verificación</span>
          <button
            type="button"
            onClick={() =>
              update({
                publishedWithinDays: undefined,
                dateFrom: undefined,
                dateTo: undefined,
                dateBasis: "publication",
              })
            }
          >
            Limpiar
          </button>
        </div>
        <select
          className="control-input"
          aria-label="Fecha que se filtra"
          value={filters.dateBasis ?? "publication"}
          onChange={event =>
            update({ dateBasis: event.target.value as JobFilters["dateBasis"] })
          }
        >
          <option value="publication">Por fecha de publicación</option>
          <option value="verification">Por fecha de verificación</option>
        </select>
        <select
          className="control-input"
          aria-label="Intervalo relativo de fecha"
          value={filters.publishedWithinDays ?? ""}
          onChange={event =>
            update({
              publishedWithinDays: event.target.value
                ? Number(event.target.value)
                : undefined,
            })
          }
        >
          <option value="">Todas las fechas</option>
          <option value="1">Últimas 24 horas</option>
          <option value="3">Últimos 3 días</option>
          <option value="7">Últimos 7 días</option>
          <option value="15">Últimos 15 días</option>
          <option value="30">Últimos 30 días</option>
        </select>
        <div className="range-row date-range-row">
          <label>
            Desde
            <input
              aria-label="Fecha desde"
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={event =>
                update({ dateFrom: event.target.value || undefined })
              }
            />
          </label>
          <label>
            Hasta
            <input
              aria-label="Fecha hasta"
              type="date"
              value={filters.dateTo ?? ""}
              onChange={event =>
                update({ dateTo: event.target.value || undefined })
              }
            />
          </label>
        </div>
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Renta mensual · CLP</span>
          <button
            type="button"
            onClick={() =>
              update({
                salaryMin: undefined,
                salaryMax: undefined,
                salaryBasis: "any",
                includeUndisclosedSalary: true,
              })
            }
          >
            Limpiar
          </button>
        </div>
        <div className="range-row">
          <label>
            Mínimo
            <input
              aria-label="Renta mínima mensual"
              type="number"
              min="0"
              step="50000"
              value={filters.salaryMin ?? ""}
              placeholder="$ 0"
              onChange={event =>
                update({
                  salaryMin: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </label>
          <label>
            Máximo
            <input
              aria-label="Renta máxima mensual"
              type="number"
              min="0"
              step="50000"
              value={filters.salaryMax ?? ""}
              placeholder="Sin tope"
              onChange={event =>
                update({
                  salaryMax: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </label>
        </div>
        <div style={{ height: 8 }} />
        <select
          className="control-input"
          aria-label="Base de remuneración"
          value={filters.salaryBasis ?? "any"}
          onChange={event =>
            update({
              salaryBasis: event.target.value as JobFilters["salaryBasis"],
            })
          }
        >
          <option value="any">Bruto, líquido o sin especificar</option>
          <option value="gross">Solo sueldo bruto</option>
          <option value="net">Solo sueldo líquido</option>
          <option value="unknown">Base no especificada</option>
        </select>
        <label className="filter-option" style={{ marginTop: 9 }}>
          <input
            type="checkbox"
            checked={filters.includeUndisclosedSalary !== false}
            onChange={event =>
              update({ includeUndisclosedSalary: event.target.checked })
            }
          />
          <span>Incluir ofertas sin renta</span>
        </label>
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Área y subárea</span>
        </div>
        <FilterFacet
          label="Áreas"
          options={dynamicOptionSet(categories, facetsQuery.data?.categories)}
          values={filters.categories ?? []}
          onChange={values => update({ categories: values })}
          placeholder="Todas las áreas"
        />
        <div style={{ height: 7 }} />
        <FilterFacet
          label="Subáreas"
          options={optionsFromFacets(facetsQuery.data?.subcategories)}
          values={filters.subcategories ?? []}
          onChange={values => update({ subcategories: values })}
          placeholder="Todas las subáreas"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Cargo / seniority</span>
        </div>
        <FilterFacet
          label="Niveles"
          options={dynamicOptionSet(seniority, facetsQuery.data?.seniorities)}
          values={filters.seniorities ?? []}
          onChange={values => update({ seniorities: values })}
          placeholder="Todos los niveles"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Experiencia requerida</span>
        </div>
        <FilterFacet
          label="Años de experiencia"
          options={[
            { value: "sin_experiencia", label: "Sin experiencia" },
            { value: "0-1", label: "0–1 año" },
            { value: "1-2", label: "1–2 años" },
            { value: "3-5", label: "3–5 años" },
            { value: "6-10", label: "6–10 años" },
            { value: ">10", label: "Más de 10 años" },
            { value: "no_informada", label: "No informada" },
          ]}
          values={filters.experience ?? []}
          onChange={values => update({ experience: values })}
          placeholder="Cualquier experiencia"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Formación</span>
        </div>
        <FilterFacet
          label="Formación"
          options={[
            "Básica",
            "Media",
            "Técnica",
            "Universitaria",
            "Posgrado",
            "Indistinto / no informado",
          ].map(value => ({ value, label: value }))}
          values={filters.education ?? []}
          onChange={values => update({ education: values })}
          placeholder="Cualquier nivel"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Jornada</span>
        </div>
        <FilterFacet
          label="Jornada"
          options={dynamicOptionSet(
            [
              "Completa",
              "Parcial",
              "Turnos",
              "Nocturna",
              "Por horas",
              "No informada",
            ],
            facetsQuery.data?.schedules
          )}
          values={filters.schedules ?? []}
          onChange={values => update({ schedules: values })}
          placeholder="Cualquier jornada"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Contrato</span>
        </div>
        <FilterFacet
          label="Contrato"
          options={dynamicOptionSet(
            [
              "Indefinido",
              "Plazo fijo",
              "Obra o faena",
              "Reemplazo",
              "Práctica",
              "Honorarios",
              "No informado",
            ],
            facetsQuery.data?.contracts
          )}
          values={filters.contracts ?? []}
          onChange={values => update({ contracts: values })}
          placeholder="Cualquier contrato"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Empresa</span>
        </div>
        <FilterFacet
          label="Empresas"
          options={optionsFromFacets(facetsQuery.data?.companies)}
          values={filters.companies ?? []}
          onChange={values => update({ companies: values })}
          placeholder="Todas las empresas"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Fuente</span>
        </div>
        <FilterFacet
          label="Fuentes"
          options={sources.map(item => ({
            value: item.value,
            label: item.label,
            count: facetsQuery.data?.sources?.find(
              source => source.value === item.value
            )?.count,
          }))}
          values={filters.sources ?? []}
          onChange={values => update({ sources: values })}
          placeholder="Todas las fuentes"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Sector económico</span>
        </div>
        <FilterFacet
          label="Sectores"
          options={dynamicOptionSet(
            [
              "Salud",
              "Banca",
              "Retail",
              "Servicios",
              "Manufactura",
              "Sector público",
              "Minería",
              "Educación",
              "Construcción",
              "Logística",
              "Tecnología",
              "Comercio",
            ],
            facetsQuery.data?.sectors
          )}
          values={filters.sectors ?? []}
          onChange={values => update({ sectors: values })}
          placeholder="Todos los sectores"
        />
      </section>
      <section className="filter-section">
        <div className="filter-section-title">
          <span>Calidad del aviso</span>
        </div>
        <div className="filter-option-list">
          <label className="filter-option">
            <input
              type="checkbox"
              checked={Boolean(filters.withOriginalUrl)}
              onChange={event =>
                update({ withOriginalUrl: event.target.checked })
              }
            />
            <span>Con enlace a oferta original</span>
          </label>
          <FilterFacet
            label="Estado"
            options={[
              { value: "vigente", label: "Vigente" },
              { value: "por_verificar", label: "Por verificar" },
              { value: "vencido", label: "Vencida" },
            ]}
            values={filters.statuses ?? []}
            onChange={values =>
              update({ statuses: values as JobFilters["statuses"] })
            }
            placeholder="Cualquier estado"
          />
        </div>
      </section>
      <button
        className="button button-quiet button-small"
        type="button"
        style={{ width: "100%" }}
        onClick={reset}
      >
        <RotateCcw size={13} /> Limpiar todos los filtros
      </button>
    </>
  );

  const results = list.data;
  const items = results?.items ?? [];
  const isEmpty = !list.isLoading && !list.error && results?.total === 0;
  const detailVisible = Boolean(selectedId);
  return (
    <div className="page-wrap">
      <section className="search-hero" aria-labelledby="search-hero-heading">
        <div className="search-hero-top">
          <div className="search-hero-copy">
            <span className="hero-kicker">
              <span className="hero-kicker-dot" /> EMPLEOS EN CHILE
            </span>
            <h1 id="search-hero-heading">
              Busca trabajo <em>con más claridad.</em>
            </h1>
            <p>
              Encuentra avisos por cargo, empresa y ubicación. Revisa las
              condiciones y la fuente disponible en cada ficha.
            </p>
          </div>
          <div className="hero-side-note">
            <span className="hero-side-mark">CL</span>
            <span>
              <strong>Un buscador para todo Chile</strong>
              <small>Regiones, comunas y modalidad</small>
            </span>
          </div>
        </div>
        <form
          className="portal-search-row"
          role="search"
          onSubmit={event => {
            event.preventDefault();
            update({ q: draftQuery, page: 1 });
          }}
        >
          <label className="portal-search-field">
            <span className="portal-search-label">¿Qué trabajo buscas?</span>
            <span className="portal-search-input">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="Cargo, empresa o habilidad"
                placeholder="Cargo, empresa o habilidad"
                value={draftQuery}
                onChange={event => setDraftQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") update({ q: draftQuery, page: 1 });
                }}
              />
              {draftQuery && (
                <button
                  type="button"
                  className="portal-search-clear"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setDraftQuery("");
                    update({ q: "" });
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </span>
          </label>
          <label className="portal-search-field portal-location-field">
            <span className="portal-search-label">¿Dónde?</span>
            <span className="portal-search-input">
              <SlidersHorizontal size={17} aria-hidden="true" />
              <select
                aria-label="Región de búsqueda"
                value={filters.regions?.length === 1 ? filters.regions[0] : ""}
                onChange={event =>
                  update({
                    regions: event.target.value ? [event.target.value] : [],
                  })
                }
              >
                <option value="">Todas las regiones</option>
                {regions.map(region => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <button className="button portal-search-submit" type="submit">
            <Search size={15} />
            <span>Buscar ofertas</span>
          </button>
        </form>
        <div className="hero-assurances" aria-label="Criterios del catálogo">
          <span>Avisos con origen visible</span>
          <span>Ubicación en Chile</span>
          <span>Renta según lo informado</span>
        </div>
      </section>
      <div className="page-heading results-heading">
        <div>
          <span className="eyebrow">CATÁLOGO LABORAL</span>
          <h2>Ofertas de empleo</h2>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={saveSearch}
            disabled={searches.isPending || updateSearch.isPending}
          >
            <Search size={14} />
            {new URLSearchParams(window.location.search).has("savedSearchId")
              ? "Actualizar búsqueda"
              : "Guardar búsqueda"}
          </button>
        </div>
      </div>
      <div className="explorer-layout">
        <>
          <div
            className={`filter-backdrop ${filterOpen ? "visible" : ""}`}
            onClick={() => setFilterOpen(false)}
          />
          <aside
            className={`filter-panel ${filterOpen ? "mobile-visible" : ""}`}
            aria-label="Filtros de empleo"
          >
            <div className="filter-panel-mobile-close">
              <span className="eyebrow">AJUSTA TU BÚSQUEDA</span>
              <button
                className="icon-button"
                type="button"
                aria-label="Cerrar filtros"
                onClick={() => setFilterOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {renderFilters()}
          </aside>
        </>
        <section className="results-panel" aria-label="Resultados de empleo">
          <div className="results-toolbar">
            <div className="result-count">
              <strong>{list.isLoading ? "—" : (results?.total ?? 0)}</strong>{" "}
              ofertas encontradas
            </div>
            <div className="toolbar-actions">
              <button
                className="button button-secondary button-small filter-mobile-open"
                type="button"
                onClick={() => setFilterOpen(true)}
              >
                <ListFilter size={14} /> Filtros
                {activeCount > 0 ? ` (${activeCount})` : ""}
              </button>
              <select
                aria-label="Ordenar resultados"
                value={filters.sort ?? "recent"}
                onChange={event =>
                  update({ sort: event.target.value as JobFilters["sort"] })
                }
              >
                <option value="recent">Más recientes</option>
                <option value="relevance">Más relevantes</option>
                <option value="salary">Mayor renta</option>
                <option value="closing">Cierre próximo</option>
              </select>
              <div className="view-toggle" aria-label="Diseño de resultados">
                <button
                  type="button"
                  className={!compact ? "active" : ""}
                  aria-label="Ver tarjetas"
                  onClick={() => setCompact(false)}
                >
                  <LayoutList size={15} />
                </button>
                <button
                  type="button"
                  className={compact ? "active" : ""}
                  aria-label="Ver lista compacta"
                  onClick={() => setCompact(true)}
                >
                  <ArrowDownWideNarrow size={14} />
                </button>
              </div>
            </div>
          </div>
          {chips.length > 0 && (
            <div className="active-chips" aria-label="Filtros activos">
              {chips.map((chip, index) => (
                <span
                  className="filter-chip"
                  key={`${chip.key}-${"value" in chip ? chip.value : chip.label}-${index}`}
                >
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Quitar ${chip.label}`}
                    onClick={() =>
                      clearOne(
                        chip.key,
                        "value" in chip ? chip.value : undefined
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="button button-quiet button-small"
                onClick={reset}
              >
                Limpiar todo
              </button>
            </div>
          )}
          {list.isLoading ? (
            <div className="job-list">
              {[1, 2, 3].map(id => (
                <div className="surface loading-card" key={id}>
                  <div className="skeleton-row">
                    <span className="skeleton-square" />
                    <div>
                      <span className="loading-line" />
                      <span className="loading-line short" />
                    </div>
                  </div>
                  <div className="loading-block" />
                </div>
              ))}
            </div>
          ) : list.error ? (
            <div className="surface empty-state empty-state-error">
              <div className="empty-icon">
                <BriefcaseBusiness size={20} />
              </div>
              <h2>No se pudieron cargar las ofertas</h2>
              <p>
                La conexión con la base de datos o el servicio no está
                disponible en este momento.
              </p>
              <button
                className="button button-secondary"
                onClick={() => list.refetch()}
              >
                <RotateCcw size={14} /> Reintentar
              </button>
            </div>
          ) : isEmpty ? (
            <div className="surface empty-state">
              <div className="empty-state-index" aria-hidden="true">
                <strong>{results?.total ?? 0}</strong>
                <span>
                  {activeCount
                    ? "avisos con estos filtros"
                    : "avisos en el catálogo"}
                </span>
              </div>
              <div className="empty-state-copy">
                <span className="eyebrow">
                  {activeCount
                    ? "AJUSTA LA BÚSQUEDA"
                    : "AVISOS DE EMPLEO EN CHILE"}
                </span>
                <h2>
                  {activeCount
                    ? "No encontramos ofertas con estos criterios"
                    : "Aún no hay ofertas incorporadas"}
                </h2>
                <p>
                  {activeCount
                    ? "Amplía la búsqueda o quita algún filtro para revisar otras ofertas."
                    : "Este catálogo no inventa vacantes para llenar la página. Cuando haya avisos, cada ficha mostrará su origen y la información disponible."}
                </p>
                <div className="empty-state-actions">
                  {activeCount ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={reset}
                    >
                      <RotateCcw size={14} /> Restablecer filtros
                    </button>
                  ) : currentUser.data?.role === "admin" ? (
                    <Link
                      className="button button-primary"
                      href="/administracion/ofertas"
                    >
                      <BriefcaseBusiness size={15} /> Incorporar ofertas reales
                    </Link>
                  ) : (
                    <span className="hint">
                      Las ofertas se incorporan desde fuentes autorizadas.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`job-list ${compact ? "compact" : ""}`}>
              {items.map(job => (
                <JobCard
                  key={job.id}
                  job={{ ...job, saved: job.saved || jobSavedIds.has(job.id) }}
                  selected={selectedId === job.id}
                  compact={compact}
                  returnTo={`${window.location.pathname}${window.location.search}`}
                  onSelect={() => setSelectedId(job.id)}
                />
              ))}
            </div>
          )}
          {results && results.total > results.pageSize && (
            <div className="pagination">
              <button
                type="button"
                disabled={results.page <= 1}
                onClick={() => update({ page: (filters.page ?? 1) - 1 })}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span>
                Página {results.page} de{" "}
                {Math.max(1, Math.ceil(results.total / results.pageSize))}
              </span>
              <button
                type="button"
                disabled={
                  results.page >= Math.ceil(results.total / results.pageSize)
                }
                onClick={() => update({ page: (filters.page ?? 1) + 1 })}
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          )}
        </section>
        <div
          className={`detail-container ${detailVisible ? "detail-open" : ""}`}
        >
          {selectedId && (
            <JobDetailPanel
              jobId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
