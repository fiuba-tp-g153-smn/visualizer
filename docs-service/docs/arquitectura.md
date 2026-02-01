# Arquitectura Interna del Sistema

### Tabla de Contenidos

1. [Introducción](#introducción)
2. [El Flujo Principal: De AWS a tu Navegador](#el-flujo-principal-de-aws-a-tu-navegador)
3. [Estrategia de Caché: Por Qué la Animación es Fluida](#estrategia-de-caché-por-qué-la-animación-es-fluida)
4. [Arquitectura del Tiles Processor](#arquitectura-del-tiles-processor)
   - [Arquitectura Completa con Gestión de Estado](#arquitectura-completa-con-gestión-de-estado)
   - [Control de Tiles en Progreso](#control-de-tiles-en-progreso)
   - [Escalabilidad Horizontal](#escalabilidad-horizontal)
5. [Infraestructura de Despliegue](#infraestructura-de-despliegue)
   - [Servidor Central (centralsv)](#servidor-central-centralsv)
   - [Servidor Worker (worker1)](#servidor-worker-worker1)
6. [Monitoreo y Observabilidad](#monitoreo-y-observabilidad)
   - [Stack de Monitoreo con Prometheus y Grafana](#stack-de-monitoreo-con-prometheus-y-grafana)
   - [Monitoreo de Disponibilidad con Uptime Kuma](#monitoreo-de-disponibilidad-con-uptime-kuma)
7. [Mirando hacia Adelante](#mirando-hacia-adelante)

## Introducción

El Visualizador del MapaSMN es una plataforma de visualización geoespacial que integra datos meteorológicos en tiempo real. Detrás de la interfaz que permite a los usuarios explorar capas del satélite GOES-19 sobre un mapa interactivo, existe una arquitectura de procesamiento diseñada para garantizar disponibilidad, escalabilidad y tiempos de actualización cuasi-reales.

En este artículo recorremos la arquitectura completa del sistema: desde la descarga de datos crudos del satélite hasta su entrega final como tiles en el navegador del usuario, incluyendo las estrategias de caché, la gestión de concurrencia y el monitoreo de infraestructura.

## El Flujo Principal: De AWS a tu Navegador

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/main-flow.png').default}
  alt="Diagrama de flujo principal desde AWS hasta el navegador"
  title="Diagrama de flujo principal desde AWS hasta el navegador"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '400px', height: 'auto' }}
  />
</div>

El ciclo de vida de un dato meteorológico en el sistema atraviesa cuatro componentes principales, cada uno con una responsabilidad bien definida.

Todo comienza con el **tiles-processor**, que descarga datos crudos desde el bucket público de AWS S3 donde se alojan las imágenes del satélite GOES-19. Estos datos son procesados (georreferenciados, ajustados en brillo y fragmentados) para generar tiles optimizados para la visualización en mapas web. Los tiles resultantes se almacenan en **MinIO**, un servicio de almacenamiento de objetos compatible con S3 que corre de forma local.

Elegimos MinIO en lugar de un filesystem compartido entre las aplicaciones de Python por una razón concreta: desacoplar. El tiles-processor sube los tiles al bucket local y el **data-service** los lee desde ahí, sin que ambos necesiten compartir un sistema de archivos directamente. Esto hace la comunicación más limpia y el sistema más fácil de mantener.

Cuando un usuario visita el sitio, el **visualizator** (la aplicación frontend, desarrollada en Angular) solicita los tiles al data-service, que actúa como intermediario entre el navegador y MinIO. El data-service está diseñado para servir tiles en el formato que Leaflet espera, de modo que a medida que el usuario se desplaza por el mapa o hace zoom, Leaflet pide exactamente las tiles que necesita y el data-service las entrega de forma eficiente.

Este diseño desacopla la generación de tiles de su consumo: el procesamiento ocurre de forma asíncrona y continua en segundo plano, mientras que la entrega al usuario es inmediata porque los tiles ya están pre-generados y almacenados.

## Estrategia de Caché: Por Qué la Animación es Fluida

Un aspecto clave de la experiencia de usuario que vale la pena destacar es la estrategia de caché multicapa que implementamos para minimizar los tiempos de carga y los "flashes" que se producen cuando el navegador tiene que ir a buscar tiles al servidor.

La primera capa de caché está en el propio **navegador**. Dado que cada tile está asociada a un timestamp específico del satélite —y esa imagen nunca va a cambiar—, le asignamos un tiempo de vida de caché (TTL) muy alto. Si el usuario ya cargó un nivel de zoom, al volver a ese zoom las tiles aparecen instantáneamente sin siquiera hacer una petición al servidor.

La segunda capa es la **precarga anticipada** (prefetch) en el frontend. Cuando el visualizador muestra una imagen en un timestamp determinado, en segundo plano ya va descargando las tiles de las imágenes adyacentes en la línea de tiempo (las dos siguientes y las dos anteriores). De esta forma, al reproducir una animación o al avanzar manualmente entre timestamps, las tiles ya están disponibles en el navegador y la transición es prácticamente inmediata.

La tercera capa está en el **data-service** mismo, que mantiene una caché local de las tiles más solicitadas para evitar consultar MinIO en cada petición.

El resultado combinado es que, una vez que las tiles se cargan para un nivel de zoom dado, la animación se reproduce sin interrupciones.

## Arquitectura del Tiles Processor

El tiles-processor es el corazón del pipeline de datos. Su diseño interno sigue un patrón productor-consumidor con una cola de mensajes, lo que permite escalar el procesamiento de forma horizontal y controlar la concurrencia para no saturar los recursos del servidor.

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/tiles-processor-main-flow.png').default}
  alt="Flujo de trabajo principal del Tiles Processor usando RabbitMQ"
  title="Flujo de trabajo principal del Tiles Processor usando RabbitMQ"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '500px', height: 'auto' }}
  />
</div>

El componente **producer** monitorea periódicamente el bucket de AWS S3 del GOES-19 en busca de nuevas imágenes. Como los canales satelitales se publican aproximadamente cada 10 minutos, el producer hace polling cada 5 minutos. Antes de encolar una nueva tarea, verifica contra MinIO si los tiles correspondientes ya fueron generados (evitando trabajo duplicado).

Cuando detecta una imagen nueva que aún no fue procesada, el producer encola una tarea en **RabbitMQ** a través de la cola `tiles_work_queue`. Cada mensaje es esencialmente una instrucción: "hay que procesar la capa X del satélite Y a la hora Z". Esta cola distribuye las tareas entre múltiples **workers** que consumen los mensajes de forma concurrente.

Cada worker toma un mensaje de la cola, descarga la imagen cruda del bucket de AWS, la procesa (georreferenciación, ajuste de brillo, generación de tiles en los niveles de zoom necesarios) y sube los tiles resultantes a MinIO. Una vez completado, queda disponible para tomar la siguiente tarea de la cola.

La ventaja fundamental de usar RabbitMQ es el **control del paralelismo**. Sin la cola, si llegan muchas imágenes nuevas simultáneamente, todos los procesos intentarían procesarlas al mismo tiempo, saturando CPU y memoria. Con la cola, el flujo está controlado: solo se procesan tantas imágenes en paralelo como workers haya disponibles, y el resto espera en la cola. En el peor de los casos, los dos workers estarán en la etapa de georreferenciación (la más intensiva en CPU) al 100%, pero nunca habrá una avalancha incontrolada de trabajo.

### Arquitectura Completa con Gestión de Estado

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/tiles-processor-full.png').default}
  alt="Arquitectura completa del Tiles Processor con gestión de estado en SQLite"
  title="Arquitectura completa del Tiles Processor con gestión de estado en SQLite"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '500px', height: 'auto' }}
  />
</div>

El diagrama completo del tiles-processor revela un componente adicional clave: la gestión de estado a través de un volumen Docker compartido con una base de datos **SQLite3**.

El producer necesita distinguir entre tres estados posibles para cada imagen: tiles ya completados (presentes en MinIO), tiles actualmente en procesamiento (registrados en SQLite3) e imágenes nuevas que aún no fueron procesadas. Sin esta distinción, podría encolar trabajo que ya se está realizando, generando procesamiento duplicado.

Cada worker, al tomar una tarea de la cola, registra en la base SQLite3 que esos tiles están "en procesamiento" y guarda allí archivos temporales durante el trabajo. Una vez completada la generación, sube los tiles finales a MinIO. El producer consulta tanto MinIO como el volumen compartido con SQLite3 para tener una visión completa del estado de todo el pipeline.

### Control de Tiles en Progreso

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/tiles-processor-in-progress.png').default}
  alt="Coordinación de estado entre Producer y Workers"
  title="Coordinación de estado entre Producer y Workers"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '350px', height: 'auto' }}
  />
</div>

Este diagrama detalla específicamente la coordinación de estado entre el producer y los workers. El mecanismo es intencionalmente liviano pero efectivo: SQLite3 provee transacciones ACID sin necesidad de un servidor de base de datos adicional, y al vivir en un volumen Docker compartido, todos los contenedores del tiles-processor pueden acceder a él de forma consistente.

El producer consulta el filesystem/docker volume para conocer qué tiles están siendo procesados actualmente. Los workers, por su parte, escriben en ese mismo volumen para registrar su progreso. Esta coordinación evita colisiones: dos workers nunca procesarán la misma imagen simultáneamente.

### Escalabilidad Horizontal

El criterio principal para determinar si necesitamos más workers es simple: **que la cola de trabajo pendiente vaya disminuyendo y no crezca continuamente**. Si el trabajo pendiente se vacía antes de que llegue nueva información, la capacidad es suficiente. Si se mantiene igual o crece, estamos procesando al mismo ritmo (o más lento) que la llegada de datos nuevos, y es necesario escalar.

Actualmente, con el servidor de desarrollo (4 vCPUs, 8 GB de RAM), dos workers son suficientes para procesar las fuentes de datos actuales. Agregar más workers es simplemente una cuestión de configuración: lo que crece horizontalmente es la capacidad de procesar más capas o más instantes de tiempo en simultáneo. Cada worker es una réplica idéntica que consume mensajes de la misma cola.

Es posible agregar workers adicionales a medida que se incorporen nuevas fuentes de datos (radar, modelos numéricos, GLM) si se cuentan con más recursos. Sin embargo, dado que los datos satelitales no son estrictamente real-time sino que se generan cada 10 minutos, no se necesita una cantidad enorme de workers; basta con que el procesamiento se complete antes de que llegue el siguiente lote de imágenes.

## Infraestructura de Despliegue

El sistema se despliega sobre dos servidores en **Hetzner Cloud**, gestionados a través de **Coolify** como plataforma de CI/CD y orquestación de contenedores. Elegimos Hetzner porque ofrece una excelente relación costo-performance, lo cual nos permite simular de forma más fiel las condiciones del servidor productivo (por ejemplo, 8 GB de RAM). Ambos servidores utilizan **Caddy** como reverse proxy, encargándose del manejo de TLS y el enrutamiento de solicitudes a los contenedores correspondientes.

### Servidor Central (centralsv)

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/deployment-centralsv.png').default}
  alt="Esquema de despliegue del Servidor Central"
  title="Esquema de despliegue del Servidor Central"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '500px', height: 'auto' }}
  />
</div>

El servidor central (`centralsv-ubuntu-4gb-fsn1-1`) se ubica en la IP `5.75.229.87` y atiende todas las peticiones dirigidas a `*.mapasmn.com`. Caddy recibe el tráfico y lo distribuye entre cuatro contenedores:

- **visualizator**: La aplicación frontend en Angular que ven los usuarios. Es la interfaz principal del sistema.
- **grafana**: Dashboards de monitoreo para visualizar métricas de toda la infraestructura.
- **prometheus centralsv**: Instancia local de Prometheus que recolecta métricas de este servidor y sus contenedores.
- **uptime kuma**: Monitoreo de disponibilidad de todos los servicios del sistema.

Con 4 GB de RAM, este servidor está dimensionado para la capa de presentación y observabilidad, sin necesidad de recursos intensivos de procesamiento.

### Servidor Worker (worker1)

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/deployment-worker1.png').default}
  alt="Esquema de despliegue del Servidor Worker1"
  title="Esquema de despliegue del Servidor Worker1"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '500px', height: 'auto' }}
  />
</div>

El servidor worker (`worker1-ubuntu-8gb-fsn1-1`) está en la IP `49.13.137.92` y responde a `*.w1.mapasmn.com`. Aquí se concentra la carga de procesamiento pesado:

- **data-service**: La API Python que sirve tiles al frontend, incluyendo la capa de caché local.
- **tiles-processor**: Los contenedores que procesan las imágenes satelitales (producer + workers).
- **minIO**: Almacenamiento de objetos donde residen todos los tiles generados.
- **prometheus worker1**: Instancia local de Prometheus para métricas de este servidor.

Con 8 GB de RAM y 4 vCPUs, este servidor tiene el doble de recursos que el central, acorde a su rol de procesamiento intensivo de imágenes y almacenamiento de datos.

## Monitoreo y Observabilidad

### Stack de Monitoreo con Prometheus y Grafana

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/monitoring.png').default}
  alt="Stack de monitoreo distribuido con Prometheus y Grafana"
  title="Stack de monitoreo distribuido con Prometheus y Grafana"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '400px', height: 'auto' }}
  />
</div>

La observabilidad del sistema se construye sobre **Prometheus** y **Grafana**, implementados de forma distribuida para cubrir ambos servidores.

Cada servidor tiene su propia instancia de Prometheus. **prometheus centralsv** recolecta estadísticas de los contenedores del servidor central (visualizator, uptime kuma) además de las métricas del sistema operativo y de Coolify. **prometheus worker1** hace lo propio con los contenedores del servidor worker (minIO, tiles-processor, data-service) y sus métricas de sistema.

**Grafana**, alojada en el servidor central, consume datos de ambas instancias de Prometheus, proporcionando una vista unificada de todo el sistema. Esto permite correlacionar métricas de ambos servidores —por ejemplo, detectar si un aumento en el uso de CPU del worker coincide con un pico de procesamiento de tiles, o si la latencia en el data-service se degrada cuando MinIO está bajo carga.

Esta arquitectura de monitoreo distribuido es especialmente importante dado que el sistema está diseñado para escalar: a medida que se agreguen más servidores worker, cada uno tendrá su propia instancia de Prometheus y Grafana los integrará de forma centralizada.

### Monitoreo de Disponibilidad con Uptime Kuma

<div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}>
  <img
  src={require('./imgs/arquitectura/uptime.png').default}
  alt="Dashboard de disponibilidad en Uptime Kuma"
  title="Dashboard de disponibilidad en Uptime Kuma"
  style={{ border: '1px solid #000000ff', borderRadius: '5px', maxHeight: '400px', height: 'auto' }}
  />
</div>

Complementando las métricas de rendimiento, **Uptime Kuma** realiza healthchecks cada minuto sobre todos los servicios críticos del sistema: visualizator, data-service, tiles-processor, ambas instancias de Coolify, Grafana y ambas instancias de Prometheus.

Uptime Kuma proporciona una perspectiva diferente a Prometheus/Grafana: mientras que estos últimos se enfocan en métricas detalladas de rendimiento, Uptime Kuma responde a la pregunta más básica — "¿está el servicio disponible o no?". Si un contenedor cae o deja de responder, Uptime Kuma lo detecta en menos de un minuto.

## Mirando hacia Adelante

La arquitectura fue diseñada pensando en la extensibilidad. Actualmente procesamos dos canales del instrumento ABI del GOES-19 (Canal 9 de vapor de agua y Canal 13 infrarrojo), pero el sistema está preparado para incorporar nuevas fuentes de datos sin requerir cambios arquitectónicos significativos:

- **Más canales satelitales**: Agregar un nuevo canal es esencialmente una nueva configuración para el producer, sin modificar el pipeline de procesamiento.
- **Datos de radar**: Siguiendo la misma arquitectura productor-consumidor, se pueden procesar datos de radar desde otras fuentes.
- **Modelos numéricos**: Se está trabajando en la integración del modelo europeo (ECMWF) para precipitación acumulada, y del modelo WRF, donde cada ejecución genera predicciones a 72 horas con pasos temporales horarios.
- **GLM (Geostationary Lightning Mapper)**: Los datos de actividad eléctrica del GOES-19 se actualizan cada 20 segundos, aunque se visualizarán en ventanas de 10 minutos.
- **Capas de referencia del IGN**: Límites provinciales, departamentales, internacionales, hidrografía y rutas, consumidos directamente desde los servicios WMS del IGN para mantenerse siempre actualizados sin necesidad de descargar archivos localmente.

Cada nueva fuente de datos simplemente genera nuevos mensajes en la cola de RabbitMQ, y los workers existentes —o nuevos workers si la capacidad lo requiere— los procesan. No hay que reinventar la arquitectura: solo agregar configuraciones y, eventualmente, más recursos de cómputo.
