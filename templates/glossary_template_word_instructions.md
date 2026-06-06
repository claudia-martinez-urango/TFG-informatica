# Plantilla Word para importar términos de glosario

Para importar términos desde un archivo Word (.docx), el documento debe contener
una **tabla** con exactamente este formato:

## Estructura de la tabla

| term | definition | example_sentence | context_sentence |
|------|------------|------------------|------------------|
| Cognitive bias | A systematic error in thinking that affects decisions and judgments. | Her cognitive bias led her to only seek information that confirmed her existing beliefs. | Studies show that cognitive bias can influence even trained professionals. |
| Active listening | A communication technique that requires fully concentrating on the speaker. | The therapist used active listening by repeating back what the patient had said. | Active listening is essential in customer service environments. |
| Stakeholder | A person or group with an interest or concern in a business or organisation. | All major stakeholders were invited to the annual review meeting. | The report was prepared with input from every key stakeholder. |

## Reglas importantes

1. La **primera fila** debe contener los nombres de columna exactamente como aparecen arriba.
2. Solo `term` y `definition` son obligatorios. Las otras dos columnas pueden ir vacías.
3. El documento puede tener texto antes o después de la tabla — el sistema buscará la primera tabla que encuentre.
4. Los nombres de columna no son sensibles a mayúsculas/minúsculas (`Term`, `TERM` y `term` funcionan igual).
5. Los espacios y guiones en los nombres de columna se convierten automáticamente a guión bajo (`example sentence` → `example_sentence`).

## Cómo crear el archivo Word

1. Abre Microsoft Word (o Google Docs → exportar como .docx).
2. Inserta una tabla: **Insertar → Tabla → 4 columnas**.
3. En la primera fila escribe los encabezados: `term`, `definition`, `example_sentence`, `context_sentence`.
4. Rellena las filas siguientes con los términos.
5. Guarda como **.docx** (no .doc).
