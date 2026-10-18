export function getCurrentEpfCompany(masterData = []) {
  return masterData
    .filter((company) => company.company_name && !String(company.date_of_left || '').trim())
    .sort((a, b) => {
      const aJoiningDate = a.date_of_joining ? new Date(a.date_of_joining).getTime() : 0;
      const bJoiningDate = b.date_of_joining ? new Date(b.date_of_joining).getTime() : 0;
      return bJoiningDate - aJoiningDate;
    })[0] || null;
}

export function getLatestEpfDeposit(records = [], companyName) {
  const normalizedCompanyName = String(companyName || '').trim().toLowerCase();
  if (!normalizedCompanyName) return null;

  return records
    .filter((record) =>
      String(record.company_name || '').trim().toLowerCase() === normalizedCompanyName
      && String(record.invest_type || '').trim().toLowerCase() === 'deposit'
    )
    .sort((a, b) => new Date(b.contribution_date) - new Date(a.contribution_date))[0] || null;
}

export function hasEpfRecordForMonth(records = [], companyName, date = new Date()) {
  const normalizedCompanyName = String(companyName || '').trim().toLowerCase();
  const year = date.getFullYear();
  const month = date.getMonth();

  return records.some((record) => {
    if (String(record.company_name || '').trim().toLowerCase() !== normalizedCompanyName) {
      return false;
    }

    const contributionDate = new Date(`${record.contribution_date}T00:00:00`);
    return !Number.isNaN(contributionDate.getTime())
      && contributionDate.getFullYear() === year
      && contributionDate.getMonth() === month;
  });
}
