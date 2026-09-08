# Entreno 2.5.0

## Novedades 2.5

Durante la sesión, cada ejercicio muestra solo lo que se usa entre series: nombre, guía, series y peso. Sustituir el ejercicio, anotar las repeticiones reales, marcar favorito, cambiar el orden y saltar están en una hoja que se abre con el botón ⋯ de la fila. El nombre se lee entero y, cuando no es el del plan, lleva la marca «cambiado».

## Novedades 2.4

La sesión separa el hueco previsto del ejercicio realizado. Puedes sustituir, marcar favoritos, reutilizar recientes, añadir, saltar y reordenar sin cambiar la plantilla. Cada ejercicio conserva su historial y precarga el último peso.

Los descansos de fuerza y estándar se configuran por separado. Durante una sesión hay acceso permanente a cuenta atrás y cronómetro, con pausa, reinicio y ajustes rápidos.

## Novedades 2.3

El calentamiento se agrupa en tres bloques más la suspensión opcional antes de Upper. Incluye `Cat-Cow`, usa nombres estándar con su equivalente en español y muestra cada movimiento como una tarjeta con marca, dosis y explicación. Una barra indica el progreso del día.

Historial utiliza una rejilla uniforme y tolera récords guardados en formatos antiguos o dañados sin romper la pantalla.

## Ajustes 2.2.1

El calentamiento conserva los nombres de los ejercicios en inglés, recupera `World’s Greatest Stretch`, añade `Scapular Push-up` y elimina el cardio en bici y los pasos laterales con banda. Los controles de series, peso y calentamiento usan una cuadrícula común para mantener distancias y alineación.

## Novedades 2.2

La programación prioriza fuerza y mantenimiento en pierna, añade una segunda exposición breve antes del acondicionamiento y concentra el volumen adicional en brazos mediante superseries de bíceps y tríceps.

Cada ejercicio principal incluye una explicación y alternativas que conservan su intención. El planificador avisa de combinaciones consecutivas que pueden dificultar la recuperación. La interfaz adapta botones, pesos y selectores a pantallas estrechas.

## Novedades 2.1

Hoy muestra el calentamiento y la sesión en dos bloques. El calentamiento guarda sus marcas por fecha sin interrumpir la sesión activa ni contar como una sesión de fuerza. Las aproximaciones siguen siendo específicas del ejercicio.

En Semana puedes asignar cada sesión de lunes a domingo o dejarla sin programar. Las flechas permiten editar semanas distintas. Una semana sin editar propone el reparto original; cambiar una semana no modifica las siguientes. Las copias de seguridad incluyen calendario y calentamientos.

Se incluye una revisión del plan para recomposición y explicaciones de cada movimiento del calentamiento.

Prueba funcional: `node tests/planning.cjs`, con Playwright y Chrome disponibles. Comprueba conservación de la sesión activa, calendario, persistencia, datos antiguos, progreso y anchura móvil.

PWA de entrenamiento personal que funciona sin cuenta y sin conexión. Permite seguir el plan, registrar series y pesos, controlar descansos, consultar el historial y exportar una copia de seguridad.

## Qué cambia en la versión 2.0

- Identidad visual e icono nuevos, con mejor lectura en móvil y escritorio.
- Control diario de recuperación con una recomendación antes de entrenar.
- Regla de doble progresión y semana de descarga explicadas dentro de la app.
- Volumen de tren superior ajustado para reducir trabajo redundante.
- Mensajes sobre dolor y prevención redactados con más cautela.
- Migración automática de los registros guardados por la versión anterior.
- Copias importadas con validación de tamaño y estructura.
- Service worker simplificado, recursos locales y versión coherente en todos los archivos.
- Mejoras de accesibilidad: zoom permitido, enlace para saltar al contenido, foco visible y estado de navegación anunciado.

## Uso

Abre `index.html` desde un servidor HTTPS. En GitHub Pages puedes instalarla desde el menú del navegador. Los datos se guardan en `localStorage` y no se envían a ningún servidor.

## Desarrollo local

No hay proceso de compilación ni dependencias. Sirve esta carpeta con cualquier servidor estático y abre la URL local.

## Aviso

El contenido es una guía general de entrenamiento, no una valoración médica. Ajusta cargas y ejercicios a tu experiencia. Si aparece dolor intenso, repentino o persistente, detén el ejercicio y consulta a un profesional sanitario.

La base y las referencias utilizadas están en [FUENTES.md](./FUENTES.md).
