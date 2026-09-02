import React from "react";
import { ExternalLink, FileDown } from "lucide-react"; // icons

const NPSLink = () => {
  const npsUrl = "https://npstrust.org.in/weekly-snapshot-nps-schemes";

  const pdfLinks = [
    {
      label: "Scheme A - Tier 1",
      url: "https://npstrust.org.in/sites/default/files/scheme_retuen_pdf/SchemeATier1.pdf",
    },
    {
      label: "Scheme C - Tier 1",
      url: "https://npstrust.org.in/sites/default/files/scheme_retuen_pdf/SchemeCTier1.pdf",
    },
    {
      label: "Scheme E - Tier 1",
      url: "https://npstrust.org.in/sites/default/files/scheme_retuen_pdf/Scheme_E_Tier1.pdf",
    },
    {
      label: "Scheme G - Tier 1",
      url: "https://npstrust.org.in/sites/default/files/scheme_retuen_pdf/Scheme_G_Tier1.pdf",
    },
  ];

 return (
  <div className="mt-10 space-y-10 px-4">
    {/* Section 1: Data links */}
    <div className="border border-white rounded-lg p-4 shadow-sm">
      <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-100 text-center sm:text-left">
        Click on below links to view the data:
      </h2>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <a
          href={npsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow"
        >
          <ExternalLink size={16} />
          Scheme Returns
        </a>

        <a
          href={npsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow"
        >
          <ExternalLink size={16} />
          View NAV
        </a>

        <a
          href={npsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow"
        >
          <ExternalLink size={16} />
          Return Comparison
        </a>
      </div>
    </div>

    {/* Section 2: Tier-1 PDF downloads */}
    <div className="border border-white rounded-lg p-4 shadow-sm">
      <h2 className="text-base sm:text-lg font-semibold mb-4 text-yellow-300 text-center sm:text-left ">
        NPS Returns Scheme (Tier-1)
      </h2>
       <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-100 text-center sm:text-left">
        (Download PDF)
      </h2>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
        {pdfLinks.map((pdf) => (
          <a
            key={pdf.label}
            href={pdf.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow"
          >
            <FileDown size={16} />
            {pdf.label}
          </a>
        ))}
      </div>
    </div>
  </div>
);

};

export default NPSLink;
