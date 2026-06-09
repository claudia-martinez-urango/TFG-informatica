# Feature: Dictionary API Definitions + Translation

Branch: `feature/dictionary-api-definitions`

Rama base: `feature/student-personal-glossary`

---

## Resumen

Cuando un estudiante selecciona una palabra o expresión en la página de lectura y ésta **no existe en el glosario del profesor**, la aplicación consulta automáticamente APIs externas para obtener una definición en inglés. Si el profesor ha activado la traducción para esa lectura, también se muestra la traducción al español.

La prioridad de definición en inglés es siempre:

```
1. Glosario del profesor       (teacher_glossary)
2. Free Dictionary API         (dictionary_api) — palabras individuales
3. Wiktionary Definition API   (dictionary_api) — fallback, incluye expresiones multi-palabra
4. Sin definición              (manual_pending)
```

La traducción al español (MyMemory API) es **independiente** de la prioridad anterior y funciona para cualquier selección, siempre que el profesor la haya habilitado en esa lectura.

Esta prioridad se aplica tanto en el frontend (las APIs externas solo se consultan si el glosario del profesor no tiene la palabra) como en el SQL (el RPC ignora los datos del frontend si existe un término del profesor para esa lectura).

---

## Archivos creados

| Archivo | Descripción |
|---|---|
| `database/dictionary_api_definitions_schema.sql` | Columnas nuevas en `student_glossary_terms`, 3 RPCs actualizados |
| `database/translation_feature_schema.sql` | Columna `is_translation_enabled` en `readings`, `get_reading_detail` actualizado |
| `frontend/src/api/dictionaryApi.js` | Tres funciones: `fetchDictionaryDefinition`, `fetchWiktionaryDefinition`, `fetchTranslation` |

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/api/readingsApi.js` | Nueva función `updateReadingTranslation` |
| `frontend/src/api/readingDetailApi.js` | Mapea `is_translation_enabled` del RPC |
| `frontend/src/api/studentGlossaryApi.js` | `mapTerm` con nuevos campos + parámetros en `addSelectedTermToMyGlossary` |
| `frontend/src/components/readings/ReadingTermPanel.jsx` | Flujo de tres APIs, prop `isTranslationEnabled`, sección de traducción, export `SourceBadge` |
| `frontend/src/components/readings/StudentPersonalGlossary.jsx` | Importa `SourceBadge`, muestra fuente y parte de la oración |
| `frontend/src/components/readings/SelectedTermPopup.jsx` | Usa `SourceBadge` y `dictionary_part_of_speech` |
| `frontend/src/pages/ReadingDetailPage.jsx` | Toggle de traducción para el profesor, pasa `isTranslationEnabled` al panel |
| `frontend/src/styles/global.css` | Badges de fuente, sección de traducción, botón toggle del profesor |

---

## Cambios en base de datos

### `database/dictionary_api_definitions_schema.sql`

#### Nuevas columnas en `public.student_glossary_terms`

| Columna | Tipo | Default | Descripción |
|---|---|---|---|
| `definition_source` | text | `'manual_pending'` | Origen de la definición |
| `dictionary_word` | text | null | Palabra exacta devuelta por la API |
| `dictionary_part_of_speech` | text | null | Categoría gramatical (noun, verb, conjunction…) |

#### Constraint de validación

```sql
CHECK (definition_source IN ('teacher_glossary', 'dictionary_api', 'manual_pending'))
```

#### RPC: `preview_selected_term_for_reading` (actualizado)

Sin cambios en la firma. Devuelve `source_type = 'teacher_glossary'` o `'no_definition'`. Las APIs externas se consultan en el **frontend** después de recibir `'no_definition'`.

#### RPC: `add_selected_term_to_my_glossary` (actualizado)

Firma ampliada con parámetros opcionales para los datos de las APIs externas:

```sql
add_selected_term_to_my_glossary(
  p_reading_id                uuid,
  p_selected_text             text,
  p_context_sentence          text    DEFAULT '',
  p_definition                text    DEFAULT NULL,
  p_definition_source         text    DEFAULT 'manual_pending',
  p_dictionary_word           text    DEFAULT NULL,
  p_dictionary_part_of_speech text    DEFAULT NULL
)
```

**Regla de prioridad en SQL — el glosario del profesor siempre gana:**

```
Si existe término del profesor para esta lectura:
  → ignora todo lo que envía el frontend
  → guarda definition_source = 'teacher_glossary'
  → guarda linked_glossary_term_id del término del profesor

Si NO existe término del profesor:
  → usa los datos del frontend (p_definition, p_definition_source, etc.)
  → si p_definition es null → guarda definition_source = 'manual_pending'
  → si p_definition no es null → guarda definition_source = p_definition_source
```

#### RPC: `get_my_personal_glossary_for_reading` (actualizado)

Recreada para incluir los tres nuevos campos en el `RETURNS TABLE`.

---

### `database/translation_feature_schema.sql`

#### Nueva columna en `public.readings`

| Columna | Tipo | Default | Descripción |
|---|---|---|---|
| `is_translation_enabled` | boolean | `false` | El profesor activa/desactiva la traducción al español para los estudiantes |

#### RPC: `get_reading_detail` (actualizado)

Devuelve el nuevo campo `result_is_translation_enabled`.

---

## Cambios en frontend

### `frontend/src/api/dictionaryApi.js` (nuevo)

#### `normalizeDictionaryLookupTerm(text)`

- Elimina puntuación al inicio y al final, convierte a minúsculas.
- Devuelve `null` si el texto tiene más de una palabra → indica que Free Dictionary no debe consultarse.

#### `fetchDictionaryDefinition(term)`

- Solo se ejecuta para palabras individuales (si `normalize` devuelve null, retorna `{ found: false }` sin llamada de red).
- Endpoint: `https://api.dictionaryapi.dev/api/v2/entries/en/<word>`
- Timeout: 5 segundos. Nunca lanza excepción.
- Devuelve: `{ found, word, definition, partOfSpeech, example }`

#### `fetchWiktionaryDefinition(term)` ← fallback para multi-palabra

- Usa el endpoint `/page/definition/` de la Wiktionary REST API (no `/page/summary/`, que está diseñado para Wikipedia y devuelve contenido vacío para entradas de Wiktionary).
- Convierte espacios a guiones bajos en la URL: `"not only"` → `/page/definition/not_only`
- Filtra la sección `en` (inglés) y extrae la primera definición del primer bloque gramatical.
- Limpia etiquetas HTML del texto de la definición con una función `stripHtml`.
- Funciona tanto para palabras individuales (fallback de Free Dictionary) como para expresiones de varias palabras.
- Devuelve: `{ found, word, definition, partOfSpeech, example }`

#### `fetchTranslation(text, from = 'en', to = 'es')`

- MyMemory Translation API — gratuita, sin clave, ~1000 palabras/día en el tier anónimo.
- Funciona para palabras individuales **y** expresiones multi-palabra.
- Ignora el resultado si la API devuelve el texto original sin cambios (indica que no encontró traducción).
- Devuelve: `{ found, translation }`

---

### `frontend/src/api/readingsApi.js` (modificado)

Nueva función `updateReadingTranslation({ readingId, isTranslationEnabled })`. Sigue el mismo patrón que `updateReadingVisibility`, usando `supabase.from('readings').update()` directamente.

### `frontend/src/api/readingDetailApi.js` (modificado)

Mapea el nuevo campo del RPC:

```js
is_translation_enabled: row.result_is_translation_enabled ?? false,
```

### `frontend/src/api/studentGlossaryApi.js` (modificado)

`mapTerm` incluye los tres nuevos campos:

```js
definition_source:         row.result_definition_source ?? 'manual_pending',
dictionary_word:           row.result_dictionary_word ?? null,
dictionary_part_of_speech: row.result_dictionary_part_of_speech ?? null,
```

`addSelectedTermToMyGlossary` acepta parámetros opcionales:

```js
addSelectedTermToMyGlossary({
  readingId, selectedText, contextSentence,
  definition             = null,
  definitionSource       = 'manual_pending',
  dictionaryWord         = null,
  dictionaryPartOfSpeech = null,
})
```

---

### `frontend/src/components/readings/ReadingTermPanel.jsx` (modificado)

#### Nuevo export: `SourceBadge`

Componente compartido con `StudentPersonalGlossary`:

```jsx
<SourceBadge source="teacher_glossary" />  // badge azul   "Teacher glossary"
<SourceBadge source="dictionary_api" />    // badge verde  "Dictionary API"
<SourceBadge source="manual_pending" />    // badge naranja "Pending definition"
```

#### Nueva prop: `isTranslationEnabled`

Controlada por el profesor. Cuando es `true`, `fetchTranslation` se ejecuta en paralelo con el RPC.

#### Nuevos estados

| Estado | Tipo | Descripción |
|---|---|---|
| `dictResult` | object \| null | Resultado de Free Dictionary o Wiktionary; se pasa a `addSelectedTermToMyGlossary` |
| `translation` | string \| null | Traducción al español de MyMemory |

#### Flujo del `useEffect` principal

```
Selección cambia
        │
        ▼
Promise.all([
  previewSelectedTermForReading (RPC),      ← siempre
  fetchTranslation (MyMemory)               ← solo si isTranslationEnabled
])
        │
   [teacher_glossary]         [no_definition]
        │                           │
        ▼                           ▼
  setPreview(rpcData)     fetchDictionaryDefinition (Free Dictionary)
                               │                   │
                          [encontró]          [no encontró]
                               │                   │
                          setDictResult        fetchWiktionaryDefinition
                          setPreview               │              │
                          source_type:       [encontró]    [no encontró]
                          'dictionary_api'       │                │
                                            setDictResult   setPreview
                                            setPreview      source_type:
                                            source_type:    'manual_pending'
                                            'dictionary_api'
```

El patrón `let cancelled = false` con `return () => { cancelled = true }` protege contra actualizaciones de estado en componentes desmontados y cambios rápidos de selección. Se verifica `cancelled` entre cada llamada asíncrona.

#### Mensaje adaptativo cuando no hay definición

Cuando `source_type === 'manual_pending'` y hay traducción disponible, el mensaje cambia:

```
Con traducción:   "No English dictionary definition found for this expression."
Sin traducción:   "No definition available yet. You can still save this word."
```

#### `handleAdd` actualizado

```js
await addSelectedTermToMyGlossary({
  readingId, selectedText, contextSentence,
  definition:             dictResult?.definition ?? null,
  definitionSource:       dictResult ? 'dictionary_api' : 'manual_pending',
  dictionaryWord:         dictResult?.word ?? null,
  dictionaryPartOfSpeech: dictResult?.partOfSpeech ?? null,
});
```

El SQL revalida y puede sobreescribir si el glosario del profesor tiene la palabra.

#### Panel visual — estados

```
── Palabra individual con definición ────────────────────────────────
│ "method"                                                           │
│ [Dictionary API]  noun                                             │
│ Definition                                                         │
│ a particular procedure for accomplishing something                 │
│ Spanish translation ────────────────────────────────────────────   │
│ │ método                                                         │ │
│ Example                                                            │
│ a teaching method                                                  │
│ In this reading                                                    │
│ "The method used in this study…"                                   │
│ [+ Add to my glossary]                                             │

── Expresión multi-palabra con Wiktionary ───────────────────────────
│ "not only"                                                         │
│ [Dictionary API]  Conjunction                                      │
│ Definition                                                         │
│ Used as the first part of the correlative conjunction…             │
│ Spanish translation ────────────────────────────────────────────   │
│ │ No solo                                                        │ │
│ In this reading                                                    │
│ "The objective is not only to collect…"                            │
│ [+ Add to my glossary]                                             │

── Sin definición, con traducción ───────────────────────────────────
│ "xyzfoo"                                                           │
│ [Pending definition]                                               │
│ Definition                                                         │
│ No English dictionary definition found for this expression.        │
│ Spanish translation ────────────────────────────────────────────   │
│ │ xyzfoo (sin traducción → sección oculta)                       │ │
│ [+ Add to my glossary]                                             │
```

---

### `frontend/src/components/readings/StudentPersonalGlossary.jsx` (modificado)

Importa `SourceBadge` desde `ReadingTermPanel`. En cada tarjeta del glosario personal:

```jsx
<div className="definition-source-row">
  <SourceBadge source={term.definition_source} />
  {term.definition_source === 'dictionary_api' && term.dictionary_part_of_speech && (
    <span className="dictionary-meta">{term.dictionary_part_of_speech}</span>
  )}
</div>
```

---

### `frontend/src/pages/ReadingDetailPage.jsx` (modificado)

#### Toggle de traducción para el profesor

Aparece en la cabecera de la lectura junto al badge de visibilidad:

```jsx
<button
  className={`translation-toggle-btn ${isTranslationEnabled ? 'translation-toggle-on' : 'translation-toggle-off'}`}
  onClick={handleToggleTranslation}
  disabled={translationToggling}
>
  Translation: ON  |  Translation: OFF
</button>
```

- Estado persistido en la base de datos vía `updateReadingTranslation`.
- El estado local `reading.is_translation_enabled` se actualiza optimísticamente con `setReading(prev => ...)` tras la respuesta exitosa.
- Errores mostrados bajo el header.

#### Nuevo estado: `isTranslationEnabled`

```js
const isTranslationEnabled = reading.is_translation_enabled ?? false;
```

Se pasa a `ReadingTermPanel` como prop y controla si `fetchTranslation` se ejecuta.

---

## Nuevas clases CSS (`global.css`)

### Badges de fuente de definición

```css
.source-badge          /* base: inline-block, 11px, bold, border-radius pill */
.source-teacher        /* fondo #EEF2FF, texto #4338CA (azul) */
.source-dictionary     /* fondo #ECFDF5, texto #065F46 (verde) */
.source-pending        /* fondo #FFF7ED, texto #92400E (naranja) */
.dictionary-meta       /* parte de la oración: 11px italic, color text-muted */
.definition-source-row /* flex row, gap 6px, margin-bottom 12px */
```

### Sección de traducción en el panel

```css
.reading-term-panel-translation  /* fondo #EEF2FF tenue, borde izquierdo primary */
.translation-text                /* font-weight 600, color primary-dark, 15px */
```

### Botón toggle del profesor

```css
.translation-toggle-btn   /* base: small-button, border-radius pill, font 12px */
.translation-toggle-on    /* fondo success-light, texto #065F46, borde verde */
.translation-toggle-off   /* fondo surface-alt, texto text-muted, borde border */
```

---

## Flujo de datos completo

```
Estudiante selecciona "not only" en el texto
        │
        ▼
SelectableReadingContent detecta selección (max 4 palabras)
→ onSelectionChange({ selectedText: "not only", contextSentence: "..." })
        │
        ▼
ReadingDetailPage actualiza selection state
→ ReadingTermPanel recibe props: selectedText, contextSentence, isTranslationEnabled
        │
        ▼
useEffect: Promise.all([RPC, traducción en paralelo])
        │
   ┌────┴────────────────┐
   │                     │
   ▼                     ▼
RPC: no_definition   MyMemory: "No solo"
   │                     │
   ▼                     ▼
Free Dictionary:   setTranslation("No solo")
  multi-palabra →
  normalize null →
  { found: false }
  sin llamada de red
   │
   ▼
Wiktionary /page/definition/not_only
  → Conjunction: "Used as first part of..."
   │
   ▼
setDictResult({ definition, partOfSpeech: "Conjunction" })
setPreview({ source_type: 'dictionary_api', ... })
        │
        ▼
Panel muestra:
  [Dictionary API] Conjunction
  "Used as first part of..."
  Spanish translation: "No solo"
  In this reading: "..."
  [+ Add to my glossary]
        │
        ▼ (student clicks Add)
addSelectedTermToMyGlossary({ ..., definition, definitionSource: 'dictionary_api', ... })
        │
        ▼
SQL RPC: no hay término del profesor → guarda datos del frontend
  → definition_source = 'dictionary_api'
        │
        ▼
onTermAdded → glossaryRefreshKey++
→ StudentPersonalGlossary recarga
→ onTermsLoaded → personalTerms actualizado en ReadingDetailPage
→ savedTerm recalculado → panel muestra "In your glossary"
```

---

## Pruebas

### Caso 1 — Palabra en glosario del profesor

1. El profesor tiene "evidence" publicado con definición.
2. El estudiante selecciona "evidence".
3. Panel: badge **Teacher glossary**, definición del profesor.
4. Se añade → tarjeta con badge **Teacher glossary**.

### Caso 2 — Palabra con definición en Free Dictionary

1. El estudiante selecciona "method" (no está en glosario del profesor).
2. Panel: badge **Dictionary API**, categoría *noun*, definición + ejemplo.
3. Se añade → `definition_source = 'dictionary_api'`.

### Caso 3 — Expresión multi-palabra con Wiktionary

1. El estudiante selecciona "not only".
2. Free Dictionary → omitido (multi-palabra, sin llamada de red).
3. Wiktionary → `https://en.wiktionary.org/api/rest_v1/page/definition/not_only`
4. Panel: badge **Dictionary API**, categoría *Conjunction*, definición.
5. Si traducción activada: "No solo" visible debajo.

### Caso 4 — Traducción activada por el profesor

1. El profesor pulsa **Translation: OFF** en la cabecera de la lectura → se guarda en BD.
2. El botón pasa a **Translation: ON** (verde).
3. El estudiante selecciona cualquier palabra → aparece la sección "Spanish translation".

### Caso 5 — Expresión sin definición en ninguna API

1. El estudiante selecciona "xyzfoo".
2. Free Dictionary: sin resultado. Wiktionary: sin resultado.
3. Panel: badge **Pending definition**, mensaje "No English dictionary definition found for this expression." (si hay traducción) o "No definition available yet." (si no hay traducción).
4. El estudiante puede añadirlo igualmente con `definition_source = 'manual_pending'`.

### Caso 6 — Seguridad

1. Acceso a lectura oculta/sección oculta/carpeta no perteneciente → RPC lanza excepción.
2. El panel muestra el mensaje de error. No se puede añadir el término.

---

## APIs externas utilizadas

| API | Endpoint base | Clave | Cobertura | Coste |
|---|---|---|---|---|
| Free Dictionary API | `https://api.dictionaryapi.dev/api/v2/entries/en/` | No | Palabras individuales en inglés | Gratuito |
| Wiktionary Definition API | `https://en.wiktionary.org/api/rest_v1/page/definition/` | No | Palabras y expresiones multi-palabra | Gratuito |
| MyMemory Translation API | `https://api.mymemory.translated.net/get` | No | Texto en cualquier idioma, en→es | Gratuito (~1000 palabras/día) |

**Migración futura:** si se necesita soporte offline, límite de rate más alto o idiomas adicionales, mover las tres funciones de `dictionaryApi.js` a una Supabase Edge Function (Deno). La firma de llamada en el frontend no cambiaría.

---

## Aplicar el SQL

Ejecutar en el editor SQL de Supabase en orden:

1. `database/dictionary_api_definitions_schema.sql` — columnas en `student_glossary_terms`, 3 RPCs
2. `database/translation_feature_schema.sql` — columna en `readings`, `get_reading_detail`

Ambos scripts son idempotentes (`ADD COLUMN IF NOT EXISTS`, `DROP FUNCTION IF EXISTS`).

---

## Comandos git

```bash
# Crear rama
git checkout -b feature/dictionary-api-definitions

# Añadir archivos
git add database/dictionary_api_definitions_schema.sql
git add database/translation_feature_schema.sql
git add frontend/src/api/dictionaryApi.js
git add frontend/src/api/readingsApi.js
git add frontend/src/api/readingDetailApi.js
git add frontend/src/api/studentGlossaryApi.js
git add frontend/src/components/readings/ReadingTermPanel.jsx
git add frontend/src/components/readings/StudentPersonalGlossary.jsx
git add frontend/src/components/readings/SelectedTermPopup.jsx
git add frontend/src/pages/ReadingDetailPage.jsx
git add frontend/src/styles/global.css

# Commit
git commit -m "feat: dictionary api + wiktionary + translation toggle for reading panel"

# Push
git push -u origin feature/dictionary-api-definitions

# Merge en develop
git checkout develop
git merge feature/dictionary-api-definitions
git push origin develop
```
