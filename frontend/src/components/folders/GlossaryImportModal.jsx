import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

import { bulkCreateGlossaryTerms } from "../../api/glossaryApi";

const REQUIRED_COLS = ["term", "definition"];
const OPTIONAL_COLS = ["example_sentence", "context_sentence"];
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS];

const CSV_TEMPLATE_ROWS = [
  ["term", "definition", "example_sentence", "context_sentence"],
  [
    "Cognitive bias",
    "A systematic error in thinking that affects decisions and judgments.",
    "Her cognitive bias led her to only seek information that confirmed her beliefs.",
    "Studies show that cognitive bias can influence even trained professionals.",
  ],
  [
    "Active listening",
    "A communication technique that requires fully concentrating on the speaker.",
    "The therapist used active listening by repeating back what the patient said.",
    "Active listening is essential in customer service environments.",
  ],
  [
    "Stakeholder",
    "A person or group with an interest or concern in a business or organisation.",
    "All major stakeholders were invited to the annual review meeting.",
    "The report was prepared with input from every key stakeholder.",
  ],
];

function downloadCsvTemplate() {
  const csv = CSV_TEMPLATE_ROWS.map((row) =>
    row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "glossary_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(h) {
  return h.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

async function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const normalized = rows.map((row) => {
          const entry = {};
          for (const [key, val] of Object.entries(row)) {
            entry[normalizeHeader(String(key))] = String(val).trim();
          }
          return entry;
        });
        resolve(normalized);
      } catch (err) {
        reject(new Error("Could not read the file. Make sure it is a valid Excel or CSV file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsArrayBuffer(file);
  });
}

async function parseWord(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: e.target.result });
        const doc = new DOMParser().parseFromString(result.value, "text/html");
        const table = doc.querySelector("table");

        if (!table) {
          reject(
            new Error(
              "No table found in the Word document. Please create a table with columns: term, definition, example_sentence, context_sentence."
            )
          );
          return;
        }

        const rows = Array.from(table.querySelectorAll("tr"));
        if (rows.length < 2) {
          reject(new Error("The table must have at least a header row and one data row."));
          return;
        }

        const headers = Array.from(rows[0].querySelectorAll("th, td")).map((cell) =>
          normalizeHeader(cell.textContent)
        );

        const data = rows.slice(1).map((row) => {
          const cells = Array.from(row.querySelectorAll("td")).map((cell) =>
            cell.textContent.trim()
          );
          const entry = {};
          headers.forEach((h, i) => {
            entry[h] = cells[i] || "";
          });
          return entry;
        });

        resolve(data);
      } catch (err) {
        if (err.message.includes("table")) {
          reject(err);
        } else {
          reject(new Error("Could not read the Word document."));
        }
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsArrayBuffer(file);
  });
}

function isRowValid(row) {
  return Boolean(row.term?.trim()) && Boolean(row.definition?.trim());
}

function GlossaryImportModal({ readingId, onImported, onClose }) {
  const [parsedRows, setParsedRows] = useState(null);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setParseError("");
    setImportError("");
    setParsedRows(null);

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let rows;

      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        rows = await parseExcel(file);
      } else if (ext === "docx") {
        rows = await parseWord(file);
      } else {
        setParseError("Unsupported file type. Please upload .xlsx, .xls, .csv, or .docx.");
        return;
      }

      const filtered = rows.filter((r) => ALL_COLS.some((col) => r[col]?.trim()));

      if (filtered.length === 0) {
        setParseError(
          "No data found in the file. Make sure the columns are named: term, definition, example_sentence, context_sentence."
        );
        return;
      }

      setParsedRows(filtered);
    } catch (err) {
      setParseError(err.message);
    }
  }

  async function handleImport() {
    const validRows = parsedRows.filter(isRowValid);
    if (validRows.length === 0) return;

    setImporting(true);
    setImportError("");

    try {
      await bulkCreateGlossaryTerms(
        readingId,
        validRows.map((r) => ({
          term: r.term.trim(),
          definition: r.definition.trim(),
          exampleSentence: r.example_sentence?.trim() || null,
          contextSentence: r.context_sentence?.trim() || null,
        }))
      );
      onImported(validRows.length);
    } catch (err) {
      setImportError(err.message);
      setImporting(false);
    }
  }

  const validCount = parsedRows ? parsedRows.filter(isRowValid).length : 0;
  const skippedCount = parsedRows ? parsedRows.length - validCount : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-box import-modal">
        <div className="modal-header">
          <h3>Import glossary terms</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="import-instructions">
          <p>
            Upload an <strong>Excel (.xlsx)</strong>, <strong>CSV</strong>, or{" "}
            <strong>Word (.docx)</strong> file.
          </p>
          <p>
            Required columns: <code>term</code>, <code>definition</code>.
            Optional: <code>example_sentence</code>, <code>context_sentence</code>.
          </p>
          <p className="small-text">
            For Word: insert a table with those column names in the first row.
          </p>
          <button
            type="button"
            className="template-download-btn"
            onClick={downloadCsvTemplate}
          >
            Download CSV / Excel template
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.docx"
          onChange={handleFileChange}
          className="import-file-input"
        />

        {parseError && <p className="error">{parseError}</p>}

        {parsedRows && (
          <>
            <div className="import-summary">
              <span className="import-valid-count">{validCount} valid term{validCount !== 1 ? "s" : ""}</span>
              {skippedCount > 0 && (
                <span className="import-skipped-count">
                  {" "}· {skippedCount} skipped (missing term or definition)
                </span>
              )}
            </div>

            <div className="import-preview-wrapper">
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Definition</th>
                    <th>Example</th>
                    <th>Context</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => {
                    const valid = isRowValid(row);
                    return (
                      <tr key={i} className={valid ? "" : "import-row-invalid"}>
                        <td>
                          {row.term?.trim() || <em className="import-missing">missing</em>}
                        </td>
                        <td>
                          {row.definition?.trim() || (
                            <em className="import-missing">missing</em>
                          )}
                        </td>
                        <td>{row.example_sentence?.trim() || "—"}</td>
                        <td>{row.context_sentence?.trim() || "—"}</td>
                        <td>
                          {!valid && <span className="import-skip-badge">skip</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {importError && <p className="error">{importError}</p>}

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || validCount === 0}
              >
                {importing
                  ? "Importing..."
                  : `Import ${validCount} term${validCount !== 1 ? "s" : ""}`}
              </button>
              <button type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {!parsedRows && (
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GlossaryImportModal;
