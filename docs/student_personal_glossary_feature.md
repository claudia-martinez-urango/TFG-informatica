# Feature: Student Personal Glossary

Branch: `feature/student-personal-glossary`

---

## Resumen

Permite a los estudiantes seleccionar palabras o expresiones cortas dentro de la página de detalle de una lectura. Al seleccionar texto, un panel lateral muestra la definición del glosario del profesor si existe, la frase de contexto, y un botón para añadir la palabra al glosario personal. El panel refleja en tiempo real si la palabra ya está guardada o marcada como dominada.

---

## Archivos creados

### `database/student_personal_glossary_schema.sql`

Esquema SQL completo para la nueva tabla y sus funciones RPC.

#### Tabla: `public.student_glossary_terms`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Clave primaria, generada automáticamente |
| `student_id` | uuid | Referencia a `profiles(id)`, cascade delete |
| `reading_id` | uuid | Referencia a `readings(id)`, cascade delete |
| `linked_glossary_term_id` | uuid | Referencia opcional a `glossary_terms(id)`, set null on delete |
| `selected_text` | text | Texto exacto seleccionado por el estudiante |
| `normalized_term` | text | Texto en minúsculas y sin espacios extra (usado para deduplicación) |
| `definition` | text | Copiada del glosario del profesor si existe |
| `example_sentence` | text | Copiada del glosario del profesor si existe |
| `context_sentence` | text | Frase del texto donde aparece la palabra |
| `student_note` | text | Nota personal del estudiante (editable) |
| `is_mastered` | boolean | Si el estudiante marca la palabra como dominada (default false) |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última modificación |

**Constraint único:** `(student_id, reading_id, normalized_term)` — la misma palabra no puede duplicarse por estudiante y lectura.

#### RLS (Row Level Security)

| Política | Operación | Condición |
|---|---|---|
| Students can read their own personal glossary terms | SELECT | `student_id = auth.uid()` |
| Students can insert their own personal glossary terms | INSERT | `student_id = auth.uid()` + lectura accesible |
| Students can update their own personal glossary terms | UPDATE | `student_id = auth.uid()` |
| Students can delete their own personal glossary terms | DELETE | `student_id = auth.uid()` |

Los profesores **no tienen acceso** a esta tabla.

#### Función auxiliar: `_student_can_access_reading(uuid)`

Comprueba que el usuario actual sea un estudiante con acceso a la lectura (folder visible + sección visible + lectura visible + miembro del folder). Usada como guardia en todas las RPCs.

#### RPC 1: `get_my_personal_glossary_for_reading(p_reading_id)`

Devuelve todos los términos del glosario personal del estudiante para una lectura.

#### RPC 2: `preview_selected_term_for_reading(p_reading_id, p_selected_text, p_context_sentence)`

Se llama antes de guardar. Busca coincidencia con el glosario del profesor. Devuelve `source_type = 'teacher_glossary'` o `'no_definition'` junto con definición, ejemplo y contexto.

#### RPC 3: `add_selected_term_to_my_glossary(p_reading_id, p_selected_text, p_context_sentence)`

Inserta o actualiza el término usando `ON CONFLICT DO UPDATE`. Copia definición y ejemplo del profesor si existe coincidencia. Devuelve la fila guardada.

#### RPC 4: `update_my_personal_glossary_term(p_term_id, p_student_note, p_is_mastered)`

Actualiza únicamente `student_note` e `is_mastered`.

#### RPC 5: `delete_my_personal_glossary_term(p_term_id)`

Elimina el término solo si pertenece al estudiante autenticado.

---

### `frontend/src/api/studentGlossaryApi.js`

| Función | RPC | Descripción |
|---|---|---|
| `getMyPersonalGlossaryForReading(readingId)` | `get_my_personal_glossary_for_reading` | Carga todos los términos del glosario personal |
| `previewSelectedTermForReading(...)` | `preview_selected_term_for_reading` | Previsualiza antes de guardar |
| `addSelectedTermToMyGlossary(...)` | `add_selected_term_to_my_glossary` | Guarda o actualiza (upsert) |
| `updateMyPersonalGlossaryTerm(...)` | `update_my_personal_glossary_term` | Actualiza nota y estado mastered |
| `deleteMyPersonalGlossaryTerm(termId)` | `delete_my_personal_glossary_term` | Elimina |

---

### `frontend/src/components/readings/SelectableReadingContent.jsx`

Renderiza el texto de la lectura con selección habilitada. No gestiona popups ni llamadas a la API.

**Props:** `content`, `onSelectionChange`

**Comportamiento:**
- Escucha `mouseup` y `keyup` en el `document`
- Valida: no vacío, máx. 4 palabras, dentro del `containerRef`
- `lastTextRef` evita re-disparar para la misma selección mientras se procesa
- Listener `selectionchange` resetea `lastTextRef` cuando la selección se limpia
- Llama a `onSelectionChange({ selectedText, contextSentence })` al detectar una selección válida

---

### `frontend/src/components/readings/ReadingTermPanel.jsx`

Panel lateral que muestra información de la palabra seleccionada. **Reemplaza al popup flotante anterior.**

**Props:**

| Prop | Tipo | Descripción |
|---|---|---|
| `readingId` | string | ID de la lectura |
| `selectedText` | string \| undefined | Palabra seleccionada |
| `contextSentence` | string | Frase de contexto |
| `savedTerm` | object \| null | Término ya guardado en el glosario personal (si existe) |
| `onTermAdded` | function | Callback tras añadir/actualizar |

**Estados del panel:**

| Estado | Condición | UI |
|---|---|---|
| Vacío | `!selectedText` | Placeholder con instrucción |
| Cargando | `loading` | Skeleton animado (shimmer) |
| No guardado | `!savedTerm` | Definición + botón "Add to my glossary" |
| Guardado, no dominado | `savedTerm && !is_mastered` | Badge "In your glossary" + bloque azul + botón "Update definition" |
| Dominado | `savedTerm.is_mastered` | Panel verde + badge "Mastered" + bloque verde "You have already mastered this word" |
| Recién añadido | `justAdded` | Badge "Just added!" + mensaje verde |

**Flujo de datos del panel:**
```
selectedText cambia
    │
    ▼ useEffect (con cancelled = true en cleanup)
previewSelectedTermForReading → setPreview
    │
    ▼ render
Muestra definición, ejemplo, contexto y el botón correspondiente
según savedTerm (mastered / saved / not saved)
```

**Nota sobre el bug anterior (race condition):** Con el popup flotante, el `mouseup` sobre el botón "Add" podía re-lanzar `previewSelectedTermForReading` antes de que el click handler terminara, dejando el botón deshabilitado. El panel lateral elimina este problema porque el botón está en un componente separado del área de selección.

---

### `frontend/src/components/readings/StudentPersonalGlossary.jsx`

Sección que aparece debajo del contenido de la lectura.

**Props:** `readingId`, `refreshKey`, `onTermsLoaded`

El prop `onTermsLoaded` es nuevo: se llama con la lista completa de términos (`terms`) cada vez que el estado `terms` cambia (carga inicial, toggle mastered, eliminación). Esto permite a `ReadingDetailPage` mantener un mirror de los términos para detectar si la palabra seleccionada en el panel ya está guardada.

Cada tarjeta permite: ver definición, editar nota, marcar como mastered/not mastered, eliminar (con `ConfirmModal`).

---

## Archivos modificados

### `frontend/src/pages/ReadingDetailPage.jsx`

**Nuevos estados:**
- `selection` — `{ selectedText, contextSentence }` o null: la palabra actualmente seleccionada
- `personalTerms` — mirror de los términos del glosario personal, actualizado por `onTermsLoaded`
- `glossaryRefreshKey` — se incrementa al añadir un término para forzar recarga

**Nueva lógica:**
```js
// Detecta si la palabra seleccionada ya está en el glosario (normalizado)
const savedTerm = selection?.selectedText
  ? personalTerms.find(t => t.normalized_term === selection.selectedText.toLowerCase().trim())
  : null;
```

**Layout para estudiantes (dos columnas):**
```
reading-split-layout (grid: 1fr 300px)
├── reading-split-content (left, flexible)
│   ├── reading-content-card > SelectableReadingContent
│   ├── success message (temporal)
│   └── StudentPersonalGlossary (onTermsLoaded → setPersonalTerms)
└── reading-split-panel (right, sticky 300px)
    └── ReadingTermPanel (savedTerm={savedTerm})
```

**Para profesores:** sin cambios. Contenido estático con términos subrayados.

### `frontend/src/styles/global.css`

#### Clases del layout dividido

| Clase | Descripción |
|---|---|
| `.reading-split-layout` | Grid `1fr 300px`, gap 22px, align-items start |
| `.reading-split-content` | Columna izquierda, flex column, gap 22px |
| `.reading-split-panel` | Columna derecha, sticky top 80px |

#### Clases del panel de términos

| Clase | Descripción |
|---|---|
| `.reading-term-panel` | Contenedor del panel, max-height con scroll |
| `.reading-term-panel-empty` | Estado vacío, fondo gris, borde punteado |
| `.reading-term-panel-hint` | Texto de instrucción en el estado vacío |
| `.reading-term-panel-header` | Cabecera con nombre del término y badges |
| `.reading-term-panel-term` | Nombre del término en azul primario |
| `.reading-term-panel-label` | Etiqueta de sección en mayúsculas pequeñas |
| `.reading-term-panel-text` | Texto de contenido de cada sección |
| `.reading-term-panel-text-muted` | Variante en cursiva para texto no disponible |
| `.reading-term-panel-context` | Frase de contexto con borde izquierdo primario |
| `.reading-term-panel-note` | Nota personal (read-only, fondo gris) |
| `.reading-term-panel-loading` | Contenedor de skeletons |
| `.term-panel-skeleton` | Bloque animado con shimmer |
| `.reading-term-panel-actions` | Área de acciones con borde superior |
| `.reading-term-panel-add-btn` | Botón principal de ancho completo |
| `.reading-term-panel-success` | Mensaje verde "Added!" |

#### Clases de estado mastered/saved

| Clase | Descripción |
|---|---|
| `.reading-term-panel-is-mastered` | Modifica el panel a fondo verde claro y borde verde |
| `.reading-term-panel-mastered-block` | Bloque verde en el área de acciones para palabras dominadas |
| `.reading-term-panel-already-saved` | Bloque azul claro con botón "Update definition" |

#### Responsive (< 768px)

El grid pasa a una sola columna. El panel se coloca **encima** de la lectura (`order: -1`) para que el estudiante vea la definición antes de leer. `max-height: none` en el panel para que no quede cortado.

---

## Flujo de datos completo

```
Estudiante selecciona texto en la lectura
        │
        ▼ SelectableReadingContent.handleSelection
onSelectionChange({ selectedText, contextSentence })
        │
        ▼ ReadingDetailPage.setSelection
savedTerm = personalTerms.find(t => t.normalized_term === ...)
        │
        ├─── savedTerm.is_mastered = true → panel verde "Mastered"
        ├─── savedTerm exists, not mastered → panel azul "Already in glossary"
        └─── savedTerm = null → panel normal
        │
        ▼ ReadingTermPanel.useEffect([selectedText])
previewSelectedTermForReading (RPC) → setPreview
        │
        ▼ Estudiante pulsa "Add to my glossary" / "Update definition"
addSelectedTermToMyGlossary (RPC) → setJustAdded(true) → onTermAdded()
        │
        ▼ ReadingDetailPage.handleTermAdded
glossaryRefreshKey++ → StudentPersonalGlossary recarga
        │
        ▼ StudentPersonalGlossary.onTermsLoaded(newTerms)
ReadingDetailPage.setPersonalTerms(newTerms)
        │
        ▼ savedTerm se recalcula automáticamente en el siguiente render
```

---

## Estados visuales del panel (resumen)

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│ "photosynthesis"            │   │ "photosynthesis"             │
│                             │   │ [In your glossary]           │
│ [From teacher glossary]     │   │                             │
│                             │   │ [From teacher glossary]     │
│ Definition                  │   │ Definition                  │
│ The process by which...     │   │ The process by which...     │
│                             │   │                             │
│ ─────────────────────────── │   │ ─────────────────────────── │
│ [+ Add to my glossary]      │   │ ┌─ This word is in your ──┐ │
│                             │   │ │  glossary.              │ │
│ Estado: no guardado         │   │ │  [Update definition]    │ │
└─────────────────────────────┘   │ └─────────────────────────┘ │
                                   │ Estado: guardado            │
                                   └─────────────────────────────┘

┌─────────────────────────────┐
│ "photosynthesis"            │  ← fondo verde claro
│ [Mastered]                  │
│                             │
│ [From teacher glossary]     │
│ Definition                  │
│ The process by which...     │
│ Your note                   │
│ "Aparece en el capítulo 2"  │
│                             │
│ ─────────────────────────── │
│ ┌─ You have already ──────┐ │
│ │  mastered this word.    │ │
│ │  Change it from below.  │ │
│ └─────────────────────────┘ │
│ Estado: dominado            │
└─────────────────────────────┘
```

---

## Restricciones de seguridad

- Un estudiante solo puede leer, crear, editar y eliminar sus propios términos.
- La inserción requiere visibilidad completa de folder + sección + lectura y membresía del folder.
- Los profesores no tienen políticas de acceso a `student_glossary_terms`.
- Todas las RPCs ejecutan en `security definer` con `set search_path = public`.
- La normalización (`lower(trim(...))`) ocurre en la base de datos, no en el cliente.

---

## API externa para definiciones — Opciones y recomendación

### ¿Por qué integrar una API externa?

El glosario del profesor solo cubre los términos que él haya creado manualmente. Una API externa permitiría mostrar definición de diccionario, pronunciación, sinónimos o traducción para **cualquier** palabra seleccionada, aunque el profesor no la haya definido.

### Opciones disponibles

| API | Coste | Key necesaria | Backend | Calidad | Idioma |
|---|---|---|---|---|---|
| **Free Dictionary API** (dictionaryapi.dev) | Gratis | No | No, llamada directa | Media | Inglés |
| **Merriam-Webster** | Gratis (tier limitado) | Sí | No | Alta | Inglés |
| **OpenAI gpt-4o-mini** | ~0.001€/query | Sí | **Sí** (Edge Function) | Muy alta, contextual | Multilingüe |
| **LibreTranslate** | Gratis | Opcional | No (instancia pública) | Media | Multilingüe |
| **MyMemory** | Gratis (1000/día) | No | No | Media | Multilingüe |
| **DeepL** | Gratis (500k chars/mes) | Sí | Recomendado | Alta | Multilingüe |

### Recomendación

**Implementación inmediata (sin backend):** Free Dictionary API.
- Llamada directa desde el frontend: `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- Devuelve definición, fonética, ejemplos, sinónimos y antónimos
- Solo funciona en inglés; sin clave ni registro

**Implementación de calidad (con Supabase Edge Function):** OpenAI `gpt-4o-mini`.
- La Edge Function mantiene la API key segura en el servidor
- Se le puede pasar la frase de contexto completa y pedir una definición contextual, traducción al español y un ejemplo generado
- Coste muy bajo: ~0.001€ por consulta

### Cómo encajaría en la arquitectura

Con Free Dictionary API (sin cambios de backend):
```
ReadingTermPanel
  → si source_type = 'no_definition'
  → llamar a dictionaryapi.dev/{selectedText}
  → mostrar resultado bajo "Dictionary definition"
```

Con OpenAI via Edge Function:
```
ReadingTermPanel
  → si source_type = 'no_definition'
  → supabase.functions.invoke('get-ai-definition', {
        body: { word: selectedText, sentence: contextSentence, lang: 'es' }
      })
  → mostrar resultado bajo "AI definition"
```

---

## Comandos git

```bash
git add database/student_personal_glossary_schema.sql
git add frontend/src/api/studentGlossaryApi.js
git add frontend/src/components/readings/SelectableReadingContent.jsx
git add frontend/src/components/readings/SelectedTermPopup.jsx
git add frontend/src/components/readings/ReadingTermPanel.jsx
git add frontend/src/components/readings/StudentPersonalGlossary.jsx
git add frontend/src/pages/ReadingDetailPage.jsx
git add frontend/src/styles/global.css
git add docs/student_personal_glossary_feature.md

git commit -m "feat: side panel with mastered/saved states for student glossary"

git checkout main
git merge feature/student-personal-glossary
git push origin main
```
