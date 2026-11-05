/**
 * Les sources des données du jour et leurs licences (05/11). Elles ne
 * s'affichent plus sous la météo : la licence CC BY 4.0 de MET Norway et des
 * autres demande seulement une attribution visible, ici (page Vie privée).
 * Même liste que `SOURCES` dans `mobile/src/screens/Settings.tsx`.
 */
export const SOURCES: { quoi: string; qui: string; licence?: string }[] = [
  { quoi: 'Météo et soleil', qui: 'MET Norway', licence: 'CC BY 4.0' },
  { quoi: 'Météo de repli, lieux et voyages', qui: 'Open-Meteo.com, GeoNames', licence: 'CC BY 4.0' },
  { quoi: 'Air et pollens', qui: 'Open-Meteo.com, Copernicus CAMS', licence: 'CC BY 4.0' },
  { quoi: 'Fête du jour', qui: 'nameday.abalin.net' },
  { quoi: 'Jours fériés', qui: 'caldays.com', licence: 'CC BY 4.0' },
  { quoi: 'Jours fériés en France', qui: 'calendrier.api.gouv.fr', licence: 'Licence Ouverte Etalab' },
  { quoi: 'Jours fériés (repli)', qui: 'Nager.Date' },
  { quoi: 'Vacances scolaires', qui: 'ministère de l’Éducation nationale (data.education.gouv.fr), OpenHolidays API' },
  { quoi: 'Lever et coucher du soleil (repli)', qui: 'sunrise-sunset.org' },
  { quoi: 'Lieux', qui: 'IGN Géoplateforme, © les contributeurs d’OpenStreetMap', licence: 'ODbL pour OpenStreetMap' },
  { quoi: 'Photos des lieux', qui: 'Wikimedia Commons, via Wikipédia' },
  { quoi: 'Tendances', qui: 'consultations de Wikipédia' },
];
