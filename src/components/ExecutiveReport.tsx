import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Download, Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface ExecutiveReportProps {
  content: string;
}

export default function ExecutiveReport({ content }: ExecutiveReportProps) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleCopy = async () => {
    // Strip markdown for plaintext copy
    const plain = content
      .replace(/[#*`>|]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      // Lazy-load jsPDF to avoid bundling html2canvas optional dep eagerly
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const plain = content
        .replace(/[#*`>|]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const lines = doc.splitTextToSize(plain, 180);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(lines, 15, 20);
      doc.save("executive-report.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-border bg-surface overflow-hidden"
      style={{
        boxShadow: "0 0 40px rgba(139, 92, 246, 0.08)",
        borderColor: "rgba(139, 92, 246, 0.25)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-elevated/50">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-[#8B5CF6]" />
          <h2 className="font-heading text-base text-foreground">
            Executive Project Report
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface transition-colors duration-200 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={12} className="text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pdfLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </motion.div>
  );
}
