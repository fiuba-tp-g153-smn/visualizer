/**
 * Display names and descriptions of every layer group, subgroup and layer,
 * keyed by product and then by the config `id` (camelCased).
 */
export const LAYER_NAMES = {
  groups: {
    goes19: {
      name: 'Satélite',
      description: 'Capas satelitales GOES-19',
    },
    radar: {
      name: 'Radar',
      description: 'Capas de radar meteorológico',
    },
    modelos: {
      name: 'Modelos',
      description: 'Modelos numéricos de pronóstico',
    },
    smnEstaciones: {
      name: 'Estaciones meteorológicas',
      description: 'Observaciones actuales de estaciones meteorológicas del SMN',
    },
    ignWms: {
      name: 'IGN Argentina',
      description: 'Capas WMS del Instituto Geográfico Nacional',
    },
    base: {
      name: 'Capas de datos',
      subtitle: 'Radar, modelos numéricos',
      description:
        'Capas de datos científicos: radar meteorológico, salidas de modelos numéricos, imágenes satelitales, etc.',
    },
    overlay: {
      name: 'Capas de referencia',
      subtitle: 'IGN, cartografía',
      description:
        'Capas de referencia cartográfica del IGN. Siempre se muestran por encima de las capas de datos.',
    },
    points: {
      name: 'Capas puntuales',
      subtitle: 'Estaciones, puntos de observación',
      description:
        'Capas puntuales interactivas. Se muestran por encima de las capas de referencia para mantener legibilidad.',
    },
  },

  goesAbi: {
    abi: {
      name: 'ABI',
      description: 'Advanced Baseline Imager',
    },
    canal2: {
      name: 'Canal 2',
    },
    bandaVisible064M: {
      description: 'Banda visible (0.64 μm)',
    },
    canal9: {
      name: 'Canal 9',
    },
    bandaDeVaporDeAgua69M: {
      description: 'Banda de vapor de agua (6.9 μm)',
    },
    canal13: {
      name: 'Canal 13',
    },
    bandaInfrarroja103M: {
      description: 'Banda infrarroja (10.3 μm)',
    },
  },

  goesGlm: {
    glm: {
      name: 'GLM',
      description: 'Geostationary Lightning Mapper',
    },
    goes19GlmFed: {
      name: 'Flash Extent Density',
      description: 'Densidad de extensión de rayos',
    },
    goes19GlmToe: {
      name: 'Total Optical Energy',
      description: 'Energía óptica total de los rayos',
    },
    goes19GlmMfa: {
      name: 'Minimum Flash Area',
      description: 'Área mínima de los rayos',
    },
  },

  radar: {
    /** Visible label of each radar moment (ids are lowercase for S3/URLs). */
    products: {
      dbzh: 'ZH',
      dbzh450km: 'ZH 450 km',
      kdp: 'KDP',
      vrad: 'VRAD',
      rhohv: 'RHOHV',
      zdr: 'ZDR',
    },
    productDescription: (product: string, site: string): string =>
      `Producto ${product} del radar meteorológico ${site}`,
    sinarameSite: (n: number, ubi: string): string => `RMA ${n} de ${ubi}`,
    sinarameName: (n: number, ubi: string): string => `RMA ${n} - ${ubi}`,
    siteDescription: (site: string): string => `Capas del radar meteorológico ${site}`,
    intaSite: (name: string): string => `${name} del INTA`,
    rma1: {
      ubi: 'Córdoba',
    },
    rma2: {
      ubi: 'Ezeiza',
    },
    rma3: {
      ubi: 'Las Lomitas',
    },
    rma4: {
      ubi: 'Resistencia',
    },
    rma5: {
      ubi: 'Bernardo de Irigoyen',
    },
    rma6: {
      ubi: 'Mar del Plata',
    },
    rma7: {
      ubi: 'Neuquén',
    },
    rma8: {
      ubi: 'Mercedes',
    },
    rma9: {
      ubi: 'Río Grande',
    },
    rma10: {
      ubi: 'Bahía Blanca',
    },
    rma11: {
      ubi: 'Termas de Río Hondo',
    },
    rma12: {
      ubi: 'Las Grutas',
    },
    rma13: {
      ubi: 'Ituzaingó',
    },
    rma14: {
      ubi: 'Bolívar',
    },
    rma15: {
      ubi: 'Patquía',
    },
    rma16: {
      ubi: 'Villa Reynolds',
    },
    rma17: {
      ubi: 'Alejandro Roca',
    },
    rma18: {
      ubi: 'Santa Isabel',
    },
    rma20: {
      ubi: 'Las Lajitas',
    },
    par: {
      name: 'INTA Paraná',
      ubi: 'Paraná',
    },
    ang: {
      name: 'INTA Anguil',
      ubi: 'Anguil',
    },
    per: {
      name: 'INTA Pergamino',
      ubi: 'Pergamino',
    },
  },

  ecmwf: {
    ecmwfIfs: {
      name: 'ECMWF',
      description: 'Modelo numérico europeo (ECMWF)',
    },
    ecmwfIfsTotalPrecipitation: {
      name: 'Precipitación total',
      description: 'Precipitación total acumulada en las 6 horas previas — modelo ECMWF',
    },
    presionANivelDelMar: {
      name: 'Presión a nivel del mar',
    },
  },

  gfs: {
    espesores1000500: {
      name: 'Espesores 1000/500',
    },
    isotermas: {
      name: 'Isotermas',
    },
    geopotencial: {
      name: 'Geopotencial',
    },
    gfs: {
      name: 'GFS',
      description: 'Modelo global GFS 0.25° del NCEP',
    },
    gfsMeanSeaLevelPressure: {
      name: 'Presión a nivel del mar',
      pointQueryLabel: 'Presión a nivel del mar',
      description:
        'Presión a nivel del mar (isobaras cada 3 hPa) y espesores 1000/500 cada 60 m — GFS. Los espesores de 5280, 5400, 5580 y 5700 m se resaltan en color.',
    },
    gfsGeopotential500hpa: {
      name: 'Geopotencial 500 hPa',
      pointQueryLabel: 'Intensidad del viento en 500 hPa',
      description:
        'Viento en 500 hPa (kt) — GFS. Geopotencial cada 60 m, isotermas cada 5 °C y barbas de viento.',
    },
    gfsGeopotential250hpa: {
      name: 'Geopotencial 250 hPa',
      pointQueryLabel: 'Intensidad del viento en 250 hPa',
      description: 'Viento en 250 hPa (kt) — GFS. Geopotencial cada 60 m.',
    },
  },

  wrf: {
    viento: {
      name: 'Viento',
    },
    presionANivelDelMar: {
      name: 'Presión a nivel del mar',
    },
    wrfArg4k: {
      name: 'WRF',
      description: 'Modelo numérico WRF-ARG4K del Servicio Meteorológico Nacional',
    },
    wrfArg4kColmax: {
      name: 'Colmax',
      description: 'Reflectividad máxima en la columna (dBZ) — WRF-ARG4K',
    },
    wrfArg4kRafagas: {
      name: 'Ráfagas en superficie',
      description:
        'Ráfagas viento 10 m (kt) — WRF-ARG4K. Barbas de viento. Contorno azul en 35 kt.',
    },
    wrfArg4kCampo900hpa: {
      name: 'Humedad específica 900 hPa',
      description:
        'Humedad específica 900 hPa (g/kg) — WRF-ARG4K. Barbas de viento. Máscara marrón en cordillera y zona sur.',
    },
    wrfArg4kPrecipitacion1h: {
      name: 'Precipitación 1h',
      pointQueryLabel: 'Precipitación acumulada 1 hora',
      description:
        'Precipitación acumulada 1 hora (mm) — WRF-ARG4K. Barbas de viento. Isobaras de presión a nivel del mar (976/984/992/1000/1008/1016 hPa).',
    },
    wrfArg4kMucape: {
      name: 'MUCAPE',
      description: 'CAPE máximo (J/kg) — WRF-ARG4K',
    },
    cortante850500Hpa: {
      name: 'Cortante 850-500 hPa',
    },
    wrfArg4kAguaPrecipitable: {
      name: 'Agua precipitable',
      description: 'Agua precipitable (mm) — WRF-ARG4K',
    },
    wrfArg4kJetCapasBajas: {
      name: 'Jet capas bajas',
      pointQueryLabel: 'Componente meridional 850 hPa',
      description:
        'Componente meridional del viento 850 hPa (kt) — WRF-ARG4K. Barbas de viento. Contornos de cizalladura 850–700 hPa (6/10/14 kt). Máscara marrón en cordillera y zona sur.',
    },
    cortante850700Hpa: {
      name: 'Cortante 850-700 hPa',
    },
    wrfArg4kCortanteNivelesBajos: {
      name: 'Cortante niveles bajos',
      pointQueryLabel: 'Intensidad cortante niveles bajos',
      description: 'Cortante sigma1-sigma2 (kt) — WRF-ARG4K',
    },
    wrfArg4kCapeBrn: {
      name: 'CAPE-BRN',
      pointQueryLabel: 'CAPE',
      description:
        'CAPE máximo + Bulk Richardson Number — WRF-ARG4K. Contornos BRN (niveles 10 y 45).',
    },
    bulkRichardsonNumber: {
      name: 'Bulk Richardson Number',
    },
    wrfArg4kGranizo: {
      name: 'Granizo',
      pointQueryLabel: 'SHIP',
      description:
        'Severe Hail Parameter + diámetro Hailcast — WRF-ARG4K. Contornos de diámetro de granizo (0.5/3/5 cm). Máscara marrón en cordillera y zona sur.',
    },
    diametroMaximoDeGranizo: {
      name: 'Diámetro máximo de granizo',
    },
  },

  ign: {
    attribution:
      '<a href="https://www.ign.gob.ar/" target="_blank">Instituto Geográfico Nacional</a>',
    ignLimits: {
      name: 'Límites',
      description: 'Límites políticos y administrativos',
    },
    ignLimiteInterdepartamentalODePartido: {
      name: 'Límite interdepartamental o de partido',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita la jurisdicción de un departamento o partido de otro.',
    },
    ignLimiteInternacional: {
      name: 'Límite internacional',
      description:
        'Línea que constituye la representación de la traza demarcadora que delimita un país.',
    },
    ignAdministrative: {
      name: 'Administrativo',
      description: 'Límites administrativos y divisiones territoriales',
    },
    ignLocalidad: {
      name: 'Localidad',
      description:
        'Superficie terrestre caracterizada por la continuidad de áreas edificadas y no edificadas conectadas entre sí por una red de calles donde se concentra población.',
    },
    ignSublocalidad: {
      name: 'Sublocalidad',
      description: 'Subdivisión de una localidad según legislación del gobierno local.',
    },
    ignGobiernoLocal: {
      name: 'Gobierno local',
      description:
        'Jurisdicción político-administrativa de tercer o cuarto orden. Incluye Municipios, Comunas, Juntas y Comisiones.',
    },
    ignProvincia: {
      name: 'Provincia',
      description:
        'División político territorial de primer orden. Incluye la Ciudad Autónoma de Buenos Aires (CABA).',
    },
    ignTerritorial: {
      name: 'Territorial',
      description: 'Organización territorial',
    },
    ignAreaDeMontana: {
      name: 'Área de montaña',
      description:
        'Áreas que representan las diferentes regiones montañosas de la República Argentina.',
    },
    ignInfrastructure: {
      name: 'Infraestructura',
      description: 'Infraestructura física y construcciones',
    },
    ignAerodromo: {
      name: 'Aeródromo',
      description:
        'Lugar de aterrizaje de aeronaves de menor porte que un aeropuerto, con o sin instalaciones de servicios y sin aduana. Incluye aeroclub.',
    },
    ignAeropuerto: {
      name: 'Aeropuerto',
      description:
        'Estación terrestre provista de un conjunto de pistas, instalaciones y servicios destinados al tráfico regular de aeronaves. Puede tener aduana.',
    },
    ignHelipuerto: {
      name: 'Helipuerto',
      description:
        'Pista circular marcada con una letra ¨H¨, para la operación de aeronaves de despegue vertical. Puede incluir instalaciones asociadas.',
    },
    ignRedVialNacional: {
      name: 'Red vial nacional',
      description:
        'Representa los objetos geográficos relativos a vías de circulación de jurisdicción nacional.',
    },
    ignHydrography: {
      name: 'Hidrografía',
      description: 'Cursos de agua, lagos y características hidrográficas',
    },
    ignCorrienteDeAgua: {
      name: 'Corriente de agua',
      description:
        'Flujo natural de agua que sigue los desniveles del terreno y desemboca en otra corriente de agua, en un espejo de agua o en el mar.',
    },
    ignFerrocarril: {
      name: 'Ferrocarril',
      description:
        'Vía férrea constituida por dos o tres rieles o carriles paralelos entre sí, sobre los cuales encajan y giran las ruedas de las locomotoras y vagones que conforman los trenes.',
    },
    ignDefenseSecurity: {
      name: 'Defensa y seguridad',
      description: 'Infraestructura de defensa y seguridad',
    },
    ignCuartelDeBomberos: {
      name: 'Cuartel de bomberos',
      description:
        'Estructura preparada para almacenar el equipamiento necesario para apagar fuegos, incluyendo mangueras, vehículos, equipos de protección del personal, extintores de fuego, entre otros. Incluye instalaciones anexas.',
    },
    ignPasosDeFronterasInternacionales: {
      name: 'Pasos de fronteras internacionales',
      description:
        'Paso de Frontera Internacional (PFI) identifica un punto de entrada y salida de personas, mercaderías y medios de transporte, que vincula de manera directa (por medios fluviales o terrestres) a la República Argentina con los cinco países vecinos. Quedan exceptuados el Puerto de Buenos Aires, todos los Aeropuertos, los puertos ubicados sobre la Hidrovía y los puertos Marítimos.',
    },
    ignOther: {
      name: 'Otros',
      description: 'Otras capas temáticas',
    },
    ignLineaDeTransmisionElectrica: {
      name: 'Línea de transmisión eléctrica',
      description:
        'Sistema de cableado compuesto por torres y cables que transmite o distribuye energía eléctrica.',
    },
    ignCentralElectrica: {
      name: 'Central eléctrica',
      description: 'Edificio y equipamiento necesario para la generación de energía eléctrica. ',
    },
    ignCentroDeEsqui: {
      name: 'Centro de esquí',
      description:
        'Área que dispone de pistas de esquí y medios de elevación. Puede contener hoteles y espacio para usar trineos.',
    },
  },

  weatherStations: {
    temperature: {
      name: 'Temperatura',
      description: 'Temperatura observada en estaciones meteorológicas',
    },
    dewPoint: {
      name: 'Punto de rocío',
      description: 'Punto de rocío observado en estaciones meteorológicas',
    },
    feelsLike: {
      name: 'Sensación térmica',
      description: 'Sensación térmica observada en estaciones meteorológicas',
    },
    humidity: {
      name: 'Humedad',
      description: 'Humedad relativa observada en estaciones meteorológicas',
    },
    pressure: {
      name: 'Presión',
      description: 'Presión atmosférica observada en estaciones meteorológicas',
    },
    visibility: {
      name: 'Visibilidad',
      description: 'Visibilidad observada en estaciones meteorológicas',
    },
    windSpeed: {
      name: 'Viento',
      description: 'Intensidad del viento observada en estaciones meteorológicas',
    },
    weatherStationsCurrent: {
      name: 'Estaciones convencionales',
      description: 'Variables actuales de las estaciones meteorológicas convencionales',
    },
  },

  syncGroups: {
    observations: {
      label: 'Radares y satélites',
      peerHint: 'Encendé otro radar o satélite para animarlos juntos',
    },
    models: {
      label: 'Modelos numéricos',
      peerHint: 'Encendé otro modelo para animarlos juntos',
    },
  },
  /** Base maps with a direct tile source (fallback when the backend list is unavailable). */
  baseMaps: {
    argenmap: {
      name: 'Argenmap',
      attribution: 'Instituto Geográfico Nacional + OpenStreetMap contributors',
    },
    argenmapGris: { name: 'Argenmap gris', attribution: 'Instituto Geográfico Nacional' },
    argenmapOscuro: { name: 'Argenmap oscuro', attribution: 'Instituto Geográfico Nacional' },
    argenmapTopografico: {
      name: 'Argenmap topográfico',
      attribution: 'Instituto Geográfico Nacional',
    },
    satellite: { name: 'Imágenes satelitales Esri', attribution: 'Tiles © Esri' },
    topographic: { name: 'Mapa topográfico Esri', attribution: 'Tiles © Esri' },
    googleSatellite: { name: 'Imágenes satelitales Google', attribution: '© Google' },
    oceanBase: { name: 'Mapa Esri Fondo Oceánico', attribution: 'Tiles © Esri' },
  },
  /** Province names by INDEC code. */
  provinces: {
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
  },
} as const;
