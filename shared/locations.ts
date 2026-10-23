import territorialData from "./chile-communes.json";

export type CommuneEntry = {
  regionCode: string;
  regionName: string;
  communeCode: string;
  communeName: string;
};

export const communes = territorialData as CommuneEntry[];
export const regions = [...new Map(communes.map((item) => [item.regionCode, item.regionName])).entries()]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code));

export function communesForRegion(regionCode?: string | null): CommuneEntry[] {
  return communes.filter((item) => !regionCode || item.regionCode === regionCode);
}

export function findRegion(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toLocaleLowerCase("es-CL");
  return regions.find((item) => item.code === value || item.name.toLocaleLowerCase("es-CL") === normalized);
}

export function findCommune(value?: string | null, regionCode?: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");
  return communes.find((item) => (!regionCode || item.regionCode === regionCode) && (item.communeCode === value || item.communeName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL") === normalized));
}
