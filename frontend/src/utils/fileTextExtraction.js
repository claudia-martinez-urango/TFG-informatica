import mammoth from "mammoth/mammoth.browser";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

async function extractTextFromTxt(file) {
  return await file.text();
}

async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => item.str)
      .join(" ");

    fullText += `\n\n${pageText}`;
  }

  return fullText.trim();
}

export async function extractTextFromFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".txt")) {
    return await extractTextFromTxt(file);
  }

  if (fileName.endsWith(".docx")) {
    return await extractTextFromDocx(file);
  }

  if (fileName.endsWith(".pdf")) {
    return await extractTextFromPdf(file);
  }

  throw new Error("Only .txt, .docx and .pdf files are supported.");
}

export function getTitleFromFile(file) {
  return file.name.replace(/\.[^/.]+$/, "");
}
