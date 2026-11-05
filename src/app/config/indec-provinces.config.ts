import { LAYER_NAMES } from '../texts';
/**
 * Códigos INDEC de provincias argentinas
 *
 * Referencia: IGN - Informe de superficies de Argentina
 * https://www.ign.gob.ar/descargas/geoespacial/Informe_supercies_de_Argentina.pdf
 *
 * Los departamentos utilizan un código de 5 dígitos donde
 * los primeros 2 dígitos indican el código de la provincia.
 */

/**
 * Mapeo de códigos INDEC a nombres de provincias
 */
export const INDEC_PROVINCE_CODES: Readonly<Record<string, string>> = LAYER_NAMES.provinces;

/**
 * Extrae el nombre de la provincia a partir del código de departamento INDEC
 * @param departmentCode - Código INDEC del departamento (5 dígitos, los primeros 2 son el código de provincia)
 * @returns Nombre de la provincia, o cadena vacía si no se encuentra
 */
export function getProvinceNameFromDepartmentCode(departmentCode: string | undefined): string {
  if (!departmentCode || departmentCode.length < 2) {
    return '';
  }
  const provinceCode = departmentCode.substring(0, 2);
  return INDEC_PROVINCE_CODES[provinceCode] ?? '';
}
