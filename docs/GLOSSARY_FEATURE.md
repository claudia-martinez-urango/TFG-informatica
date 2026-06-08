# Funcionalidad: Glosario de términos por lectura

## ¿Qué se ha implementado?

Se ha añadido un sistema de **glosario de términos** vinculado a cada lectura.  
El **profesor** gestiona los términos manualmente. El **estudiante** solo ve los términos que el profesor ha publicado.

---

## Archivos creados (nuevos)

### 1. `database/glossary_schema.sql`

**Qué hace:** crea la tabla en Supabase y define quién puede hacer qué.

**Debes ejecutarlo en:** Supabase → SQL Editor → pegar el contenido → Run.

Crea la tabla `glossary_terms` con estas columnas:

| Columna | Tipo | Para qué sirve |
|---|---|---|
| `id` | UUID | Identificador único del término |
| `reading_id` | UUID | A qué lectura pertenece |
| `term` | texto | La palabra o expresión |
| `definition` | texto | La definición del término |
| `example_sentence` | texto (opcional) | Frase de ejemplo |
| `context_sentence` | texto (opcional) | Frase del texto donde aparece |
| `is_visible_to_students` | booleano | Si el estudiante puede verlo (por defecto: NO) |
| `created_at` / `updated_at` | fecha | Cuándo se creó / actualizó |

**Políticas de seguridad (RLS):** Supabase protege los datos con reglas:
- El profesor solo puede gestionar términos de sus propias lecturas.
- El estudiante solo puede ver términos si:
  - Pertenece a la carpeta
  - La carpeta es visible
  - La sección es visible
  - La lectura es visible
  - El término tiene `is_visible_to_students = true`

**Función RPC `get_reading_glossary_terms`:** es como una "consulta inteligente" que Supabase ejecuta en el servidor. Devuelve los términos correctos según si quien pregunta es profesor o estudiante.

---

### 2. `frontend/src/api/glossaryApi.js`

**Qué hace:** es el "puente" entre tu aplicación React y la base de datos Supabase.

Contiene 5 funciones:

```
getReadingGlossaryTerms(readingId)
  → Obtiene todos los términos de una lectura (llama a la función SQL de arriba)

createGlossaryTerm({ readingId, term, definition, exampleSentence, contextSentence })
  → Crea un término nuevo (siempre oculto por defecto)

updateGlossaryTerm({ termId, term, definition, exampleSentence, contextSentence })
  → Edita un término existente

updateGlossaryTermVisibility({ termId, isVisibleToStudents })
  → Publica o oculta un término

deleteGlossaryTerm(termId)
  → Elimina un término permanentemente
```

---

### 3. `frontend/src/components/folders/ReadingGlossaryManager.jsx`

**Qué hace:** es el **panel de gestión del glosario** que ve el profesor dentro de cada lectura.

**Cómo funciona:**
- Cuando el profesor hace clic en **"Manage glossary"**, este componente aparece debajo de la lectura.
- Muestra una cabecera con el título "Glossary terms" y un botón "+ Add term".
- Al hacer clic en "+ Add term" aparece un formulario con los campos: Term, Definition, Example sentence, Context sentence.
- Cada término creado aparece en una tarjeta que muestra:
  - El término y su badge de visibilidad (verde = visible, amarillo = oculto)
  - La definición
  - Frase de ejemplo y de contexto (si se han rellenado)
  - Tres botones: **Edit term**, **Publish to students / Hide from students**, **Delete term**
- El botón "Delete term" abre una ventana de confirmación antes de eliminar.
- Todos los cambios se reflejan **inmediatamente** en pantalla sin recargar la página.

---

## Archivos modificados (cambios sobre existentes)

### 4. `frontend/src/components/folders/SectionReadingsManager.jsx`

**Qué se ha cambiado:** se añadieron 3 cosas pequeñas.

**Cambio 1 — importación:**
```js
// Se añadió esta línea al principio del archivo:
import ReadingGlossaryManager from "./ReadingGlossaryManager";
```

**Cambio 2 — nuevo estado:**
```js
// Guarda qué lectura tiene el glosario abierto (null = ninguno)
const [visibleGlossaryReadingId, setVisibleGlossaryReadingId] = useState(null);

// Función para abrir/cerrar el glosario de una lectura
function toggleGlossary(readingId) {
  setVisibleGlossaryReadingId((prev) => (prev === readingId ? null : readingId));
}
```

**Cambio 3 — en cada tarjeta de lectura se añadió:**
```jsx
{/* Botón nuevo */}
<button onClick={() => toggleGlossary(reading.id)}>
  {visibleGlossaryReadingId === reading.id ? "Hide glossary" : "Manage glossary"}
</button>

{/* Panel que aparece si el glosario está abierto para esta lectura */}
{visibleGlossaryReadingId === reading.id && (
  <ReadingGlossaryManager readingId={reading.id} />
)}
```

---

### 5. `frontend/src/pages/StudentDashboardPage.jsx`

**Qué se ha cambiado:** el dashboard del estudiante ahora también carga y muestra los términos del glosario.

**Lógica añadida:**
```js
// Nuevo mapa que guarda los términos de cada lectura
const [glossaryByReading, setGlossaryByReading] = useState({});
```

Al cargar la página, después de obtener las lecturas, se obtienen también sus términos:
```js
for (const reading of readings) {
  try {
    const terms = await getReadingGlossaryTerms(reading.id);
    glossaryMap[reading.id] = terms;
  } catch {
    glossaryMap[reading.id] = []; // Si falla, simplemente no muestra nada
  }
}
```

**Vista nueva:** debajo de cada lectura visible, el estudiante ve una sección "Glossary" con las tarjetas de los términos publicados. Si no hay ninguno, aparece "No glossary terms available yet."

---

### 6. `frontend/src/styles/global.css`

**Qué se ha añadido:** estilos CSS para los nuevos elementos. No se ha tocado ningún estilo existente.

Estilos nuevos:
- `.glossary-box` — el panel del glosario en la vista del profesor (fondo azul suave)
- `.glossary-form` — formulario para crear/editar términos
- `.glossary-term-card` — tarjeta de cada término (profesor)
- `.glossary-term-definition`, `.glossary-term-meta` — texto de definición y ejemplos
- `.student-glossary-box` — sección de glosario en el dashboard del estudiante
- `.student-glossary-term-card` — tarjeta de término en vista estudiante
- `.glossary-term-example`, `.glossary-term-context` — texto en cursiva para ejemplos

---

## Flujo completo resumido

```
PROFESOR
  → Abre una lectura en Teacher Folders
  → Hace clic en "Manage glossary"
  → Se abre el panel de glosario
  → Añade términos con "+ Add term"
  → Publica los que quiera con "Publish to students"

ESTUDIANTE
  → Abre Student Dashboard
  → Expande una carpeta → una sección → ve las lecturas
  → Debajo de cada lectura aparece la sección "Glossary"
  → Solo ve los términos que el profesor ha publicado
```

---

## Cómo ejecutar el SQL en Supabase

1. Entra en tu proyecto de Supabase.
2. Ve a **SQL Editor** (barra lateral izquierda).
3. Crea una nueva query.
4. Copia y pega el contenido completo de `database/glossary_schema.sql`.
5. Haz clic en **Run**.
6. Si no hay errores, la tabla y las políticas están creadas.

> El archivo está diseñado para ser **idempotente**: puedes ejecutarlo varias veces sin que rompa nada, porque usa `CREATE TABLE IF NOT EXISTS` y `DROP POLICY IF EXISTS`.

---

## Actualizaciones posteriores

### Importación masiva desde archivo (Excel / Word / CSV)

**Problema:** el profesor tenía que añadir los términos uno a uno.  
**Solución:** se añadió un botón **"Import from file"** junto al botón "+ Add term" que permite subir un archivo con todos los términos a la vez.

#### Archivos nuevos/modificados

**`frontend/src/components/folders/GlossaryImportModal.jsx`** — modal nuevo con toda la lógica de importación:
- Acepta `.xlsx`, `.xls`, `.csv` (parsea con SheetJS) y `.docx` (parsea con Mammoth)
- El parsing ocurre **en el navegador**, sin ningún servidor
- Muestra una **tabla de previsualización** antes de confirmar la importación
- Las filas con `term` o `definition` vacíos se marcan en rojo y se omiten automáticamente
- Al confirmar, inserta todos los términos válidos de golpe (todos quedan ocultos por defecto)

**`frontend/src/api/glossaryApi.js`** — se añadió:
```js
bulkCreateGlossaryTerms(readingId, terms)
  → Inserta un array de términos de una sola vez (un solo insert a Supabase)
```

**`frontend/src/components/folders/ReadingGlossaryManager.jsx`** — se añadió el botón y el estado:
```jsx
<button onClick={() => setShowImportModal(true)}>Import from file</button>

{showImportModal && (
  <GlossaryImportModal
    readingId={readingId}
    onImported={handleImported}
    onClose={() => setShowImportModal(false)}
  />
)}
```

#### Formato esperado del archivo

| Columna | Obligatoria |
|---|---|
| `term` | Sí |
| `definition` | Sí |
| `example_sentence` | No |
| `context_sentence` | No |

- **Excel / CSV:** los nombres de columna van en la primera fila. No importa si están en mayúsculas o minúsculas.
- **Word (.docx):** insertar una tabla con esos nombres de columna en la primera fila. Las filas siguientes son los términos.

#### Archivos de plantilla (en `templates/`)

Se han creado dos archivos de ejemplo para que los profesores los usen como guía:

**`templates/glossary_template.csv`**
Archivo CSV listo para abrir en Excel o Google Sheets. Contiene la fila de encabezados y 3 filas de ejemplo. El profesor solo tiene que sustituir los ejemplos por sus propios términos y subir el archivo.

```
term,definition,example_sentence,context_sentence
Cognitive bias,A systematic error in thinking...,Her cognitive bias led her...,Studies show that...
Active listening,A communication technique...,The therapist used...,Active listening is essential...
Stakeholder,A person or group with an interest...,All major stakeholders...,The report was prepared...
```

**`templates/glossary_template_word_instructions.md`**
Instrucciones paso a paso para crear el archivo Word (.docx) correctamente, con la estructura exacta de la tabla y las reglas de formato (nombres de columna, columnas opcionales, etc.). No se puede generar un `.docx` real de forma automática, por eso se documenta cómo construirlo manualmente.

#### Dependencia añadida

```
npm install xlsx
```

> Nota: la librería `xlsx` (SheetJS community edition) tiene vulnerabilidades conocidas de prototype pollution y ReDoS con archivos maliciosos. El riesgo es mínimo porque solo los profesores suben sus propios archivos.

---

### Glosario en la página de lectura completa ("Open reading")

**Problema:** al hacer clic en "Open reading", la página de detalle mostraba el glosario como un marcador de posición ("Glossary terms will appear here."), nunca cargaba los términos reales. Tampoco subrayaba los términos en el texto.

**Solución:** se reescribió `frontend/src/pages/ReadingDetailPage.jsx` con dos mejoras:

#### 1. Carga real del glosario

Al abrir la página se llama a `getReadingGlossaryTerms` en paralelo con `getReadingDetail`:
```js
const [data, terms] = await Promise.all([
  getReadingDetail(readingId),
  getReadingGlossaryTerms(readingId).catch(() => []),
]);
```

- El **profesor** ve todos los términos (visibles y ocultos) con su badge de estado.
- El **estudiante** solo ve los términos con `is_visible_to_students = true`.
- Si no hay términos visibles, la sección de glosario no aparece.

#### 2. Subrayado automático de términos en el texto

Los términos del glosario que aparecen en el contenido de la lectura se subrayan automáticamente:

```js
function highlightTerms(content, terms) {
  // Construye una regex con todos los términos
  // Divide el texto en partes: texto normal vs. coincidencia
  // Las coincidencias se envuelven en <u className="glossary-highlight">
}
```

El subrayado usa el color primario (morado). Al pasar el ratón sobre el término aparece su definición como tooltip nativo.

**Estilos añadidos en `global.css`:**
- `.reading-glossary-card` — contenedor de la sección de glosario en la página de lectura
- `.reading-glossary-term` — tarjeta de cada término
- `.glossary-highlight` — subrayado morado con `cursor: help` y tooltip de definición

---

## Error visible en la captura: "column p.organization_id does not exist"

Este error **no viene del código nuevo del glosario**. Viene del archivo `database/reading_detail_schema.sql` que ya existía, concretamente de esta línea:

```sql
JOIN public.profiles p ON p.organization_id = o.id
```

El problema: la tabla `profiles` tiene las columnas `role`, `first_name`, `last_name` y `email`, pero **no tiene** `organization_id`. Por eso falla.

Para arreglarlo hay que ir a ese archivo y cambiar la lógica del check del profesor. Se puede arreglar fácilmente si lo pedís.
