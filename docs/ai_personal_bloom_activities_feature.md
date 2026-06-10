# Feature: AI Personal Bloom Activities

Branch: `feature/ai-personal-bloom-activities`

---

## Resumen

Permite a los estudiantes generar actividades de práctica personalizadas basadas en la Taxonomía de Bloom para cada término de su glosario personal. La generación se delega a una Supabase Edge Function que llama a OpenAI en el servidor, de modo que la clave de API nunca llega al navegador. Las actividades se persisten en base de datos y el estudiante puede responderlas, actualizarlas en sucesivas sesiones y ver la respuesta sugerida solo después de haber enviado la suya.

---

## Archivos creados

### `database/ai_personal_bloom_schema.sql`

Esquema SQL completo: tablas, RLS y funciones RPC.

#### Tabla: `public.student_bloom_activities`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Clave primaria |
| `student_glossary_term_id` | uuid | Referencia a `student_glossary_terms(id)`, cascade delete |
| `student_id` | uuid | Referencia a `profiles(id)`, cascade delete |
| `bloom_level` | text | Uno de: `remember`, `understand`, `apply`, `analyze`, `evaluate`, `create` |
| `prompt` | text | Enunciado de la actividad generado por IA |
| `expected_answer` | text | Respuesta modelo sugerida (no visible al estudiante por defecto) |
| `activity_source` | text | `ai_generated` o `manual` |
| `ai_model` | text | Modelo OpenAI usado (ej. `gpt-4o-mini`) |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Última actualización |

Restricciones de check:
- `bloom_level in ('remember','understand','apply','analyze','evaluate','create')`
- `activity_source in ('ai_generated','manual')`

#### Tabla: `public.student_bloom_activity_responses`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Clave primaria |
| `student_bloom_activity_id` | uuid | Referencia a `student_bloom_activities(id)`, cascade delete |
| `student_id` | uuid | Referencia a `profiles(id)`, cascade delete |
| `answer` | text | Respuesta escrita por el estudiante |
| `submitted_at` | timestamptz | Primer envío |
| `updated_at` | timestamptz | Última actualización |

Restricción unique: `(student_bloom_activity_id, student_id)` — un estudiante solo puede tener una respuesta por actividad.

#### RLS

Ambas tablas tienen RLS activado. Las políticas garantizan:
- Un estudiante solo puede leer, insertar, actualizar y borrar sus propias filas (`student_id = auth.uid()`).
- No existe acceso para profesores en esta versión.

#### Función helper: `_valid_bloom_levels()`

Devuelve el array de niveles válidos. Se usa en el orden de resultados y en la validación del RPC de guardado.

#### RPC 1: `get_my_student_bloom_activities(p_student_glossary_term_id uuid)`

Devuelve todas las actividades del estudiante autenticado para un término personal concreto, ordenadas por nivel Bloom (remember → create) y luego por fecha de creación.

Validaciones:
- Usuario autenticado y con rol `student`.
- El término pertenece al estudiante.

#### RPC 2: `save_ai_generated_student_bloom_activities(p_student_glossary_term_id, p_activities jsonb, p_ai_model text)`

Reemplaza las actividades existentes del término (delete + insert) con el nuevo conjunto generado por IA. Soporta la regeneración.

Validaciones:
- Usuario autenticado y con rol `student`.
- El término pertenece al estudiante.
- La lectura asociada sigue siendo accesible (visibilidad de carpeta, sección y lectura).
- Cada `bloom_level` en el JSON es válido.
- Cada actividad tiene un `prompt` no nulo.

#### RPC 3: `get_my_student_bloom_activity_response(p_activity_id uuid)`

Devuelve la respuesta del estudiante a una actividad concreta, o vacío si aún no ha respondido.

#### RPC 4: `save_my_student_bloom_activity_response(p_activity_id uuid, p_answer text)`

Crea o actualiza (upsert vía `ON CONFLICT`) la respuesta del estudiante. La respuesta no puede estar vacía.

---

### `supabase/functions/generate-personal-bloom-activities/index.ts`

Supabase Edge Function escrita en Deno/TypeScript. Es el único punto donde se usa `OPENAI_API_KEY`; el frontend nunca la ve.

**Flujo interno:**

1. Responde `200 ok` a peticiones `OPTIONS` (CORS preflight).
2. Extrae el header `Authorization` y crea un cliente Supabase con el JWT del usuario.
3. Verifica que el token es válido (`supabase.auth.getUser()`).
4. Con el cliente admin (`SUPABASE_SERVICE_ROLE_KEY`) comprueba que el usuario tiene rol `student`.
5. Verifica que el `studentGlossaryTermId` del body pertenece al estudiante.
6. Verifica que la lectura asociada es accesible (join de visibilidad completo).
7. Construye el prompt del sistema (guía por nivel Bloom) y el prompt de usuario (incluye palabra, definición, fuente, contexto, título y extracto de la lectura).
8. Llama a `gpt-4o-mini` con `response_format: { type: "json_object" }` para garantizar JSON estructurado.
9. Parsea y filtra la respuesta: descarta actividades con `bloom_level` inválido o `prompt` vacío.
10. Devuelve `{ activities, ai_model }`.

**Variables de entorno requeridas:**
- `SUPABASE_URL` — inyectada automáticamente por Supabase
- `SUPABASE_ANON_KEY` — inyectada automáticamente
- `SUPABASE_SERVICE_ROLE_KEY` — inyectada automáticamente
- `OPENAI_API_KEY` — configurar manualmente con `supabase secrets set OPENAI_API_KEY=sk-...`

---

### `frontend/src/api/personalBloomApi.js`

Capa de acceso a las RPCs de Supabase para las actividades Bloom.

| Función exportada | RPC llamada |
|---|---|
| `getMyStudentBloomActivities(termId)` | `get_my_student_bloom_activities` |
| `saveAIGeneratedStudentBloomActivities({ termId, activities, aiModel })` | `save_ai_generated_student_bloom_activities` |
| `getMyStudentBloomActivityResponse(activityId)` | `get_my_student_bloom_activity_response` |
| `saveMyStudentBloomActivityResponse({ activityId, answer })` | `save_my_student_bloom_activity_response` |

Incluye funciones `mapActivity` y `mapResponse` que normalizan los prefijos `result_*` del retorno de los RPCs.

---

### `frontend/src/api/aiPersonalBloomApi.js`

Capa de acceso a la Edge Function.

| Función exportada | Descripción |
|---|---|
| `generatePersonalBloomActivitiesWithAI({ studentGlossaryTermId, selectedText, definition, definitionSource, contextSentence, readingTitle, readingExcerpt, selectedLevels })` | Invoca la Edge Function mediante `supabase.functions.invoke`. Lanza un error si la respuesta tiene `data.error` o un formato inesperado. |

---

### `frontend/src/components/readings/StudentPersonalBloomActivity.jsx`

Componente que representa una actividad Bloom individual.

**Props:**
- `activity` — objeto con `id`, `bloom_level`, `prompt`, `expected_answer`

**Comportamiento:**
- Al montar, carga la respuesta guardada del estudiante vía `getMyStudentBloomActivityResponse`.
- Muestra el badge de nivel Bloom con color según el nivel.
- Muestra el enunciado de la actividad.
- Textarea para escribir la respuesta, con botón "Submit answer" (primer envío) o "Update answer" (si ya existe respuesta guardada).
- Botón "Show suggested answer" visible solo si la actividad tiene `expected_answer` y el estudiante ya ha enviado su respuesta. Antes del primer envío, el botón está deshabilitado.
- Feedback de error y confirmación de guardado.

---

### `frontend/src/components/readings/PersonalBloomPractice.jsx`

Componente contenedor de las actividades Bloom para un término personal concreto.

**Props:**
- `personalTerm` — objeto del glosario personal del estudiante
- `readingTitle` — título de la lectura (pasado a la Edge Function)
- `readingExcerpt` — primeros 600 caracteres del contenido de la lectura (pasado a la Edge Function)

**Comportamiento:**
- Renderiza un botón colapsable "Personal practice" con badge AI. Las actividades se cargan de forma lazy: solo al expandir por primera vez.
- Si no existen actividades: muestra checkboxes de selección de niveles Bloom y botón "Generate practice with AI".
- Si ya existen actividades: las muestra directamente (sin volver a mostrar los checkboxes) y ofrece el botón "Regenerate practice".
- Antes de regenerar muestra un `ConfirmModal` que avisa de que se borrarán las actividades y respuestas existentes.
- Flujo de generación: llama a `generatePersonalBloomActivitiesWithAI` → llama a `saveAIGeneratedStudentBloomActivities` → recarga desde DB para obtener los IDs definitivos → renderiza `StudentPersonalBloomActivity` por cada actividad.
- Estado de carga mientras la IA genera.
- Mensaje de error si la Edge Function falla.

---

## Archivos modificados

### `frontend/src/components/readings/StudentPersonalGlossary.jsx`

**Cambios:**
- Añadidas dos nuevas props: `readingTitle` y `readingExcerpt`.
- Al final de cada `student-glossary-card`, justo después del bloque de acciones (notas, mastered, remove), se incluye `<PersonalBloomPractice personalTerm={term} readingTitle={readingTitle} readingExcerpt={readingExcerpt} />`.
- Import añadido: `PersonalBloomPractice`.
- El resto de la lógica (carga, notas, mastered, delete) no cambia.

### `frontend/src/pages/ReadingDetailPage.jsx`

**Cambios:**
- Se pasan dos props nuevas a `StudentPersonalGlossary`:
  - `readingTitle={reading.title}`
  - `readingExcerpt={reading.content ? reading.content.slice(0, 600) : null}`
- Se elimina la tarjeta placeholder "Bloom activities will appear here." ya que las actividades ahora viven dentro de cada tarjeta del glosario personal.

### `frontend/src/styles/global.css`

**Clases añadidas:**

| Clase | Descripción |
|---|---|
| `.personal-bloom-box` | Contenedor colapsable de la sección de práctica dentro de cada tarjeta del glosario |
| `.personal-bloom-toggle` | Botón de expansión/colapso con fondo `primary-light` |
| `.personal-bloom-toggle-arrow` | Flecha ▲/▼ alineada a la derecha del toggle |
| `.personal-bloom-body` | Cuerpo de la sección, visible solo cuando está expandida |
| `.personal-bloom-controls` | Caja de selección de niveles Bloom |
| `.bloom-level-checkboxes` | Grid de checkboxes de niveles |
| `.bloom-level-checkbox-label` | Fila checkbox + badge para cada nivel |
| `.personal-bloom-generate-btn` | Botón principal de generación (ancho completo) |
| `.personal-bloom-activities-list` | Lista vertical de actividades |
| `.personal-bloom-card` | Tarjeta individual de una actividad Bloom |
| `.bloom-activity-prompt` | Texto del enunciado de la actividad |
| `.student-answer-area` | Wrapper del textarea de respuesta |
| `.bloom-suggested-answer` | Bloque con fondo `primary-light` para la respuesta sugerida |
| `.bloom-level-badge` | Badge base con `border-radius-full` y `font-weight: 700` |
| `.bloom-remember` | Azul claro (#EFF6FF / #1D4ED8) |
| `.bloom-understand` | Verde claro (#F0FDF4 / #15803D) |
| `.bloom-apply` | Naranja claro (#FFF7ED / #C2410C) |
| `.bloom-analyze` | Púrpura claro (#FDF4FF / #7E22CE) |
| `.bloom-evaluate` | Rosa claro (#FFF1F2 / #BE123C) |
| `.bloom-create` | Cian claro (#ECFEFF / #0E7490) |
| `.ai-generated-badge` | Badge compacto "AI" en `primary` con texto blanco |
| `.practice-loading` | Texto en cursiva centrado mientras la IA genera |
| `.practice-empty-state` | Texto en cursiva centrado cuando no hay actividades todavía |

---

## Flujo completo de la feature

```
Estudiante abre /reading/:readingId
         │
         ▼
Selecciona una palabra → popup → Add to my glossary
         │
         ▼
La palabra aparece en "My personal glossary" como student-glossary-card
         │
         ▼
El estudiante expande "Personal practice" (toggle AI)
         │
         ├─ Sin actividades previas
         │     │
         │     ▼
         │  Selecciona niveles Bloom (por defecto todos)
         │     │
         │     ▼
         │  Click "Generate practice with AI"
         │     │
         │     ▼
         │  PersonalBloomPractice llama a generatePersonalBloomActivitiesWithAI()
         │     │  (aiPersonalBloomApi.js → supabase.functions.invoke)
         │     ▼
         │  Edge Function (Deno, servidor)
         │     ├── Verifica JWT + rol student
         │     ├── Verifica que el término pertenece al estudiante
         │     ├── Verifica visibilidad de la lectura
         │     ├── Construye prompt con: palabra, definición, fuente, contexto, título, extracto
         │     └── Llama a gpt-4o-mini con response_format: json_object
         │          └── Devuelve { activities: [...], ai_model }
         │     │
         │     ▼
         │  saveAIGeneratedStudentBloomActivities()
         │     │  (personalBloomApi.js → RPC en Supabase)
         │     │  Borra actividades anteriores + inserta las nuevas
         │     ▼
         │  getMyStudentBloomActivities() → recarga desde DB con IDs
         │     │
         │     ▼
         │  Renderiza StudentPersonalBloomActivity × n
         │
         └─ Con actividades ya existentes
               │
               ▼
            Muestra directamente las actividades guardadas
            + botón "Regenerate practice" (con ConfirmModal)

                     │
                     ▼ (en cada actividad)
         Estudiante escribe su respuesta
                     │
                     ▼
         Click "Submit answer"
                     │
                     ▼
         saveMyStudentBloomActivityResponse()
                     │  (RPC → upsert ON CONFLICT)
                     ▼
         Respuesta guardada en student_bloom_activity_responses
                     │
                     ▼
         Botón "Show suggested answer" se habilita
         (expected_answer visible solo tras el primer envío)
```

---

## Seguridad

| Capa | Garantía |
|---|---|
| Edge Function | Verifica JWT → rol student → propiedad del término → accesibilidad de la lectura antes de llamar a OpenAI |
| RPC `save_ai_generated_student_bloom_activities` | Mismas verificaciones en el servidor Postgres (security definer) |
| RLS `student_bloom_activities` | Un estudiante solo puede leer/escribir sus propias filas |
| RLS `student_bloom_activity_responses` | Un estudiante solo puede leer/escribir sus propias respuestas |
| Frontend | `OPENAI_API_KEY` nunca aparece en el bundle ni en las peticiones de red |

---

## Despliegue

```bash
# 1. Ejecutar el SQL en Supabase SQL Editor
#    database/ai_personal_bloom_schema.sql

# 2. Configurar el secret de OpenAI
supabase secrets set OPENAI_API_KEY=sk-...

# 3. Desplegar la Edge Function
supabase functions deploy generate-personal-bloom-activities
```

---

## Decisiones de diseño relevantes

- **Las actividades no dependen del glosario del profesor.** Si no existe definición del profesor, la IA usa la definición del diccionario o, en su defecto, solo la frase de contexto. Esto garantiza que cualquier estudiante puede practicar con cualquier palabra, independientemente de si el profesor ha rellenado el glosario.
- **Regenerar borra todo.** El RPC `save_ai_generated_student_bloom_activities` hace delete + insert para simplificar la lógica. La UI pide confirmación antes de regenerar.
- **La respuesta sugerida está oculta por defecto.** El botón "Show suggested answer" solo se habilita después del primer envío, para animar al estudiante a pensar antes de ver la respuesta modelo.
- **Carga lazy de actividades.** Las actividades de un término solo se cargan cuando el estudiante expande la sección, evitando N peticiones paralelas al cargar el glosario completo.
- **Sin corrección automática.** Las respuestas se guardan tal cual. No hay puntuación ni validación de contenido en esta versión.
