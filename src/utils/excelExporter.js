import ExcelJS from 'exceljs';

export const exportMFTransactionsToExcel = async (transactions, fundName, includeColumns) => {
  const workbook = new ExcelJS.Workbook();
  const sanitizedSheetName = fundName.replace(/[*?:\x2f\\[\]]/g, '').slice(0, 31);
  const worksheet = workbook.addWorksheet(sanitizedSheetName || 'Sheet1');

  worksheet.columns = includeColumns.map(col => ({
    header: col.label,
    key: col.key,
    width: col.width || 15,
  }));

  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFA500' },
  };

  worksheet.getRow(1).font = {
    bold: true,
    color: { argb: 'FF000000' },
  };

  transactions.forEach(txn => {
    const row = {};
    includeColumns.forEach(col => {
      row[col.key] = txn[col.key];
    });
    worksheet.addRow(row);
  });

  worksheet.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + includeColumns.length)}${transactions.length + 1}`
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const sanitizedFileName = fundName.replace(/[*?:\x2f\\[\]]/g, '_');
  link.download = `${sanitizedFileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMFHoldingsToExcel = async (holdings, fileName, includeColumns) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Holdings');

  worksheet.columns = includeColumns.map(col => ({
    header: col.label,
    key: col.key,
    width: col.width || 15,
  }));

  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFA500' },
  };

  worksheet.getRow(1).font = {
    bold: true,
    color: { argb: 'FF000000' },
  };

  holdings.forEach(item => {
    const row = {};
    includeColumns.forEach(col => {
      row[col.key] = item[col.key];
    });
    worksheet.addRow(row);
  });

  worksheet.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + includeColumns.length)}${holdings.length + 1}`
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const sanitizedFileName = fileName.replace(/[*?:\x2f\\[\]]/g, '_');
  link.download = `${sanitizedFileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
