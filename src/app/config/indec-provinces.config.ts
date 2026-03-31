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
export const INDEC_PROVINCE_CODES: Readonly<Record<string, string>> = {
  '02': 'CABA',
  '06': 'Buenos Aires',
  '10': 'Catamarca',
  '14': 'Córdoba',
  '18': 'Corrientes',
  '22': 'Chaco',
  '26': 'Chubut',
  '30': 'Entre Ríos',
  '34': 'Formosa',
  '38': 'Jujuy',
  '42': 'La Pampa',
  '46': 'La Rioja',
  '50': 'Mendoza',
  '54': 'Misiones',
  '58': 'Neuquén',
  '62': 'Río Negro',
  '66': 'Salta',
  '70': 'San Juan',
  '74': 'San Luis',
  '78': 'Santa Cruz',
  '82': 'Santa Fe',
  '86': 'Santiago del Estero',
  '90': 'Tucumán',
  '94': 'Tierra del Fuego',
} as const;

/**
 * Extrae el nombre de la provincia a partir del código de departamento INDEC
 * @param departmentCode - Código INDEC del departamento (5 dígitos, los primeros 2 son el código de provincia)
 * @returns Nombre de la provincia o undefined si no se encuentra
 */
export function getProvinceNameFromDepartmentCode(
  departmentCode: string | undefined,
): string | undefined {
  if (!departmentCode || departmentCode.length < 2) {
    return undefined;
  }
  const provinceCode = departmentCode.substring(0, 2);
  return INDEC_PROVINCE_CODES[provinceCode];
}
