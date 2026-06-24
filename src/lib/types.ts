export interface AdminLevel {
  level: number;
  id: string; // e.g. "tun_admin2"
  pmtilesUrl: string;
  parquetUrl: string;
  bbox: [number, number, number, number];
  columns: string[];
}

export interface Country {
  iso3: string;
  iso2: string;
  name: string;
  maxAdmLevel: number;
  bbox: [number, number, number, number];
  adminLevels: AdminLevel[];
  catalogId: string; // e.g. "cod_ab_tun"
}

export interface PcodeResult {
  latitude: number;
  longitude: number;
  levels: Array<{
    level: number;
    pcode: string;
    name: string;
  }>;
}
