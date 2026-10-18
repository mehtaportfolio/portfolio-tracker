import { describe, expect, it } from 'vitest';
import {
  getCurrentEpfCompany,
  getLatestEpfDeposit,
  hasEpfRecordForMonth,
} from '../epfUtils.js';

describe('EPF company defaults and monthly records', () => {
  it('selects the most recently joined company without a leaving date', () => {
    const currentCompany = getCurrentEpfCompany([
      { company_name: 'Previous Co', date_of_joining: '2019-01-01', date_of_left: '2022-05-31' },
      { company_name: 'Current Co', date_of_joining: '2023-04-01', date_of_left: null },
    ]);

    expect(currentCompany.company_name).toBe('Current Co');
  });

  it('gets the latest deposit for the selected company only', () => {
    const latestDeposit = getLatestEpfDeposit([
      { company_name: 'Previous Co', contribution_date: '2024-01-01', invest_type: 'deposit', employee_share: 100 },
      { company_name: 'Current Co', contribution_date: '2024-02-01', invest_type: 'deposit', employee_share: 200 },
      { company_name: 'Current Co', contribution_date: '2024-03-01', invest_type: 'interest', employee_share: 300 },
    ], 'current co');

    expect(latestDeposit.employee_share).toBe(200);
  });

  it('detects an existing record for the company anywhere in the month', () => {
    const records = [
      { company_name: 'Previous Co', contribution_date: '2024-03-01' },
      { company_name: 'Current Co', contribution_date: '2024-03-18' },
    ];

    expect(hasEpfRecordForMonth(records, 'Current Co', new Date(2024, 2, 25))).toBe(true);
    expect(hasEpfRecordForMonth(records, 'Previous Co', new Date(2024, 2, 25))).toBe(true);
    expect(hasEpfRecordForMonth(records, 'Current Co', new Date(2024, 3, 1))).toBe(false);
  });
});
