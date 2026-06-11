# Feature: Dictionary API Definitions + DeepL Translation

Branch: `feature/dictionary-api-definitions`

Rama base: `feature/student-personal-glossary`

---

## Resumen

Cuando un estudiante selecciona una palabra o expresión en la página de lectura y ésta **no existe en el glosario del profesor**, la aplicación consulta automáticamente APIs externas para obtener una definición en inglés. Si el profesor ha activado la traducción para esa lectura, también se muestra una traducción al español obtenida de **DeepL** con contexto — editable por el estudiante antes de guardar.

### Prioridad de definición en inglés

```
1. Glosario del profesor       (teacher_glossary)
2. Free Dictionary API         (dictionary_api) — palabras individuales
3. Wiktionary Definition API   (dictionary_api) — fallback, incluye expresiones multi-palabra
4. Sin definición              (manual_pending)
```

### Traducción al español

La traducción la realiza **DeepL** a través de una Supabase Edge Function. Se pasa tanto la palabra seleccionada como la frase de contexto en la que aparece, lo que permite a DeepL desambiguar el significado correcto (ej. "bark" en un texto de botánica → "corteza", no "ladrido").

```
Palabra seleccionada + frase de contexto
        │
        ▼
Edge Function translate-term  (DEEPL_API_KEY guardada en el servidor)
        │
        ▼
DeepL API  →  traducción contextual
```

La `DEEPL_API_KEY` nunca sale del servidor — el frontend solo invoca la Edge Function con su JWT de autenticación.

La traducción se muestra como un campo **editable** en el panel. El estudiante puede corregirla antes de guardar. Si la modifica, la fuente pasa a ser `student_edited`.

---

## Archivos creados

| Archivo | Descripción |
|---|---|
| `database/dictionary_api_definitions_schema.sql` | Columnas de definición en `student_glossary_terms`, RPCs de definición |
| `database/translation_feature_schema.sql` | Columna `is_translation_enabled` en `readings`, `get_reading_detail` actualizado |
| `database/dictionary_api_definitions_v2_schema.sql` | Columnas de traducción en `student_glossary_terms`, RPCs actualizados |
| `frontend/src/api/dictionaryApi.js` | `fetchDictionaryDefinition` y `fetchWiktionaryDefinition` |
| `frontend/src/api/contextualTranslationApi.js` | `getContextAwareSpanishTranslation` — invoca la Edge Function de DeepL |
| `supabase/functions/translate-term/index.ts` | Edge Function — recibe palabra + contexto, llama a DeepL, devuelve traducción |

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/api/readingsApi.js` | Nueva función `updateReadingTranslation` |
| `frontend/src/api/readingDetailApi.js` | Mapea `is_translation_enabled` del RPC |
| `frontend/src/api/studentGlossaryApi.js` | `mapTerm` con campos de definición y traducción; `addSelectedTermToMyGlossary` con todos los parámetros |
| `frontend/src/components/readings/ReadingTermPanel.jsx` | Campo de traducción editable, badge DeepL, exports `SourceBadge` y `TranslationSourceBadge` |
| `frontend/src/components/readings/StudentPersonalGlossary.jsx` | Muestra traducción guardada con badge de fuente por término |
| `frontend/src/pages/ReadingDetailPage.jsx` | Toggle de traducción para el profesor |
| `frontend/src/styles/global.css` | Badges de fuente, campo editable de traducción, botón toggle del profesor |

## Archivos eliminados

| Archivo | Razón |
|---|---|
| `frontend/src/components/readings/SelectedTermPopup.jsx` | Componente de popup flotante nunca utilizado; reemplazado por `ReadingTermPanel.jsx` |

---

## Cambios en base de datos

### `database/dictionary_api_definitions_schema.sql` (v1)

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

---

### `database/translation_feature_schema.sql`

#### Nueva columna en `public.readings`

| Columna | Tipo | Default | Descripción |
|---|---|---|---|
| `is_translation_enabled` | boolean | `false` | El profesor activa/desactiva la traducción al español |

#### RPC: `get_reading_detail` actualizado

Devuelve el nuevo campo `result_is_translation_enabled`.

---

### `database/dictionary_api_definitions_v2_schema.sql` (v2)

#### Nuevas columnas en `public.student_glossary_terms`

| Columna | Tipo | Default | Descripción |
|---|---|---|---|
| `spanish_translation` | text | null | Traducción al español guardada (puede ser editada por el estudiante) |
| `translation_source` | text | `'manual_pending'` | Origen de la traducción |
| `translation_confidence` | integer | `0` | Confianza: 85 = DeepL, 100 = student_edited, 0 = sin traducción |

#### Constraint de validación

```sql
CHECK (translation_source IN ('context_rules', 'api', 'manual_pending', 'student_edited'))
```

> `context_rules` se mantiene por compatibilidad con datos existentes. Las nuevas traducciones siempre usan `'api'` (DeepL) o `'student_edited'`.

#### RPC: `add_selected_term_to_my_glossary` (v2, 10 parámetros)

```sql
add_selected_term_to_my_glossary(
  p_reading_id                uuid,
  p_selected_text             text,
  p_context_sentence          text    DEFAULT '',
  p_definition                text    DEFAULT NULL,
  p_definition_source         text    DEFAULT 'manual_pending',
  p_dictionary_word           text    DEFAULT NULL,
  p_dictionary_part_of_speech text    DEFAULT NULL,
  p_spanish_translation       text    DEFAULT NULL,
  p_translation_source        text    DEFAULT 'manual_pending',
  p_translation_confidence    integer DEFAULT 0
)
```

---

## Cambios en frontend

### `frontend/src/api/dictionaryApi.js`

#### `fetchDictionaryDefinition(term)`
- Solo para palabras individuales.
- Endpoint: `https://api.dictionaryapi.dev/api/v2/entries/en/<word>`
- Devuelve: `{ found, word, definition, partOfSpeech, example }`

#### `fetchWiktionaryDefinition(term)` ← fallback multi-palabra
- Endpoint: `https://en.wiktionary.org/api/rest_v1/page/definition/<slug>`
- Convierte espacios a guiones bajos en la URL.
- Devuelve: `{ found, word, definition, partOfSpeech, example }`

---

### `supabase/functions/translate-term/index.ts` (nueva Edge Function)

Recibe `{ selectedText, contextSentence }` del frontend y llama a la DeepL API con ambos campos:

```typescript
const body = {
  text:        [selectedText],
  source_lang: "EN",
  target_lang: "ES",
  context:     contextSentence,  // permite a DeepL desambiguar el significado
};

fetch("https://api-free.deepl.com/v2/translate", {
  headers: { "Authorization": `DeepL-Auth-Key ${DEEPL_API_KEY}` },
  body: JSON.stringify(body),
});
```

- Verifica que el usuario esté autenticado antes de llamar a DeepL.
- Devuelve `{ found: true, translation }` o `{ found: false }`.
- La clave `DEEPL_API_KEY` se guarda como secret en Supabase y **nunca llega al frontend**.

---

### `frontend/src/api/contextualTranslationApi.js`

#### `getContextAwareSpanishTranslation(selectedText, contextSentence)`

Invoca la Edge Function y normaliza la respuesta:

```js
const { data } = await supabase.functions.invoke('translate-term', {
  body: { selectedText, contextSentence },
});
// → { found: true, translation: 'corteza', source: 'api', confidence: 85 }
// → { found: false, translation: null, source: 'manual_pending', confidence: 0 }
```

---

### `frontend/src/components/readings/ReadingTermPanel.jsx`

#### Exports: `SourceBadge` y `TranslationSourceBadge`

```jsx
<SourceBadge source="teacher_glossary" />  // azul    "Teacher glossary"
<SourceBadge source="dictionary_api" />    // verde   "Dictionary API"
<SourceBadge source="manual_pending" />    // naranja "Pending definition"

<TranslationSourceBadge source="api" />            // naranja "DeepL"
<TranslationSourceBadge source="student_edited" /> // morado  "Edited by you"
```

#### Campo de traducción editable

Cuando `isTranslationEnabled` es `true`, se muestra:

```
Spanish translation    [DeepL]
┌────────────────────────────────────┐
│ de un solo uso                     │  ← editable, pre-rellenado con la sugerencia de DeepL
└────────────────────────────────────┘
```

Si el estudiante edita el texto, la fuente se guarda como `student_edited`.

#### Preservación de traducción existente

Si `isTranslationEnabled` es `false` y el estudiante pulsa "Update definition", la traducción ya guardada se preserva (no se sobreescribe con null).

---

### `frontend/src/components/readings/StudentPersonalGlossary.jsx`

Muestra la traducción guardada con su badge de fuente en cada tarjeta:

```jsx
{term.spanish_translation && (
  <div className="student-glossary-translation">
    <span className="reading-term-panel-label">Spanish translation</span>
    <p className="spanish-translation-text">{term.spanish_translation}</p>
    <TranslationSourceBadge source={term.translation_source} />
  </div>
)}
```

---

## Badges de fuente — resumen visual

| Badge | Color | Cuándo aparece |
|---|---|---|
| Teacher glossary | Azul | Definición del glosario del profesor |
| Dictionary API | Verde | Definición de Free Dictionary o Wiktionary |
| Pending definition | Naranja | Ninguna API encontró definición |
| DeepL | Naranja | Traducción obtenida de DeepL con contexto |
| Edited by you | Morado | El estudiante modificó la traducción antes de guardar |
| *(sin badge)* | — | Sin traducción guardada |

---

## APIs externas utilizadas

| API | Dónde se llama | Clave | Coste |
|---|---|---|---|
| Free Dictionary API | Frontend directo | No | Gratuito |
| Wiktionary Definition API | Frontend directo | No | Gratuito |
| **DeepL Free API** | Edge Function (servidor) | **Sí — guardada como secret** | Gratuito hasta 500.000 chars/mes |

---

## Despliegue

### 1. Obtener clave de DeepL

1. Ir a [deepl.com/pro#developer](https://deepl.com/pro#developer) → crear cuenta gratuita.
2. En el panel de DeepL → **API Keys** → copiar la clave (termina en `:fx`).

### 2. Añadir el secret en Supabase

Dashboard → **Edge Functions** → **Secrets** → **Add secret**:

| Name | Value |
|---|---|
| `DEEPL_API_KEY` | `tu-clave:fx` |

### 3. Desplegar la Edge Function

Dashboard → **Edge Functions** → **Create new function** → nombre: `translate-term` → pegar el contenido de `supabase/functions/translate-term/index.ts` → **Deploy**.

### 4. Aplicar el SQL (si no se ha hecho antes)

En el editor SQL de Supabase, en orden:

1. `database/dictionary_api_definitions_schema.sql`
2. `database/translation_feature_schema.sql`
3. `database/dictionary_api_definitions_v2_schema.sql`

---

## Pruebas

### Caso 1 — Traducción contextual con DeepL

1. El profesor activa **Translation: ON** en una lectura.
2. El estudiante selecciona "bark" en un texto de botánica.
3. El panel muestra badge naranja **DeepL** y la traducción "corteza" (no "ladrido"), porque DeepL recibe la frase de contexto del texto.

### Caso 2 — Edición manual

1. DeepL sugiere una traducción en el campo editable.
2. El estudiante la corrige antes de guardar.
3. La tarjeta en el glosario muestra badge morado **Edited by you**.

### Caso 3 — Sin traducción encontrada

1. DeepL no devuelve resultado o devuelve el texto original.
2. El campo de traducción aparece vacío y sin badge.
3. El estudiante puede escribir una traducción manualmente → se guarda como `student_edited`.

### Caso 4 — Traducción desactivada, "Update definition"

1. El profesor desactiva **Translation: OFF**.
2. El estudiante ya tenía una traducción guardada.
3. Pulsa "Update definition" → la traducción se **preserva**.

---

## Comandos git

```bash
git add supabase/functions/translate-term/index.ts
git add frontend/src/api/contextualTranslationApi.js
git add frontend/src/api/dictionaryApi.js
git add frontend/src/api/studentGlossaryApi.js
git add frontend/src/components/readings/ReadingTermPanel.jsx
git add frontend/src/components/readings/StudentPersonalGlossary.jsx
git add frontend/src/styles/global.css
git rm frontend/src/components/readings/SelectedTermPopup.jsx

git commit -m "feat: DeepL context-aware translation via Edge Function"
```
