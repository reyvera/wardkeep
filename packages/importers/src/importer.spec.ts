import { describe, it, expect } from 'vitest';

import { parse, exportCsv } from './importer';
import { ParsedTransaction } from './types';

describe('importers', () => {
  describe('CSV parser', () => {
    it('parses CSV with default column mapping', () => {
      const csv = [
        'date,amount,description,category',
        '2024-01-15,100.50,Salary,Income',
        '2024-01-16,-45.00,Grocery Store,Food',
        '2024-01-17,25.00,Refund,Shopping',
      ].join('\n');

      const result = parse(Buffer.from(csv), 'csv');

      expect(result.transactions).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(3);

      expect(result.transactions[0]).toEqual({
        date: '2024-01-15',
        amount: '100.50',
        description: 'Salary',
        category: 'Income',
        type: 'CREDIT',
      });

      expect(result.transactions[1]).toEqual({
        date: '2024-01-16',
        amount: '45.00',
        description: 'Grocery Store',
        category: 'Food',
        type: 'DEBIT',
      });
    });

    it('parses CSV with custom column mapping', () => {
      const csv = [
        'Transaction Date,Desc,Amt,Cat',
        '01/15/2024,Paycheck,2500.00,Income',
        '01/16/2024,Coffee Shop,-4.50,Food',
      ].join('\n');

      const result = parse(Buffer.from(csv), 'csv', {
        date: 'Transaction Date',
        amount: 'Amt',
        description: 'Desc',
        category: 'Cat',
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      expect(result.transactions[0]).toEqual({
        date: '2024-01-15',
        amount: '2500.00',
        description: 'Paycheck',
        category: 'Income',
        type: 'CREDIT',
      });

      expect(result.transactions[1]).toEqual({
        date: '2024-01-16',
        amount: '4.50',
        description: 'Coffee Shop',
        category: 'Food',
        type: 'DEBIT',
      });
    });

    it('parses CSV with index-based column mapping', () => {
      const csv = [
        'col_a,col_b,col_c',
        '2024-03-01,50.00,Lunch',
      ].join('\n');

      const result = parse(Buffer.from(csv), 'csv', {
        date: '0',
        amount: '1',
        description: '2',
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toBe('2024-03-01');
      expect(result.transactions[0].amount).toBe('50.00');
      expect(result.transactions[0].description).toBe('Lunch');
    });

    it('handles amounts with currency symbols and commas', () => {
      const csv = [
        'date,amount,description',
        '2024-01-01,"$1,234.56",Big Purchase',
        '2024-01-02,-$99.99,Return',
      ].join('\n');

      const result = parse(Buffer.from(csv), 'csv');

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBe('1234.56');
      expect(result.transactions[0].type).toBe('CREDIT');
      expect(result.transactions[1].amount).toBe('99.99');
      expect(result.transactions[1].type).toBe('DEBIT');
    });

    it('skips malformed rows and reports errors', () => {
      const csv = [
        'date,amount,description',
        '2024-01-01,100.00,Valid',
        'not-a-date,50.00,Bad Date',
        '2024-01-03,not-a-number,Bad Amount',
        '2024-01-04,75.00,Also Valid',
      ].join('\n');

      const result = parse(Buffer.from(csv), 'csv');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(2);
      expect(result.totalRows).toBe(4);

      expect(result.errors[0]).toEqual({
        line: 3,
        reason: 'Invalid date: "not-a-date"',
      });
      expect(result.errors[1]).toEqual({
        line: 4,
        reason: 'Invalid amount: "not-a-number"',
      });

      expect(result.transactions[0].description).toBe('Valid');
      expect(result.transactions[1].description).toBe('Also Valid');
    });

    it('handles quoted CSV fields with commas', () => {
      const csv = [
        'date,amount,description,category',
        '2024-01-01,50.00,"Smith, John - Payment",Income',
      ].join('\n');

      const result = parse(Buffer.from(csv), 'csv');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Smith, John - Payment');
    });
  });

  describe('OFX parser', () => {
    it('parses OFX transaction blocks', () => {
      const ofx = `
OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115120000
<TRNAMT>-45.99
<NAME>GROCERY STORE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240120
<TRNAMT>2500.00
<NAME>EMPLOYER INC
<MEMO>Direct Deposit
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      const result = parse(Buffer.from(ofx), 'ofx');

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(2);

      expect(result.transactions[0]).toEqual({
        date: '2024-01-15',
        amount: '45.99',
        description: 'GROCERY STORE',
        category: null,
        type: 'DEBIT',
      });

      expect(result.transactions[1]).toEqual({
        date: '2024-01-20',
        amount: '2500.00',
        description: 'EMPLOYER INC',
        category: null,
        type: 'CREDIT',
      });
    });

    it('parses QFX files (same as OFX)', () => {
      const qfx = `
<OFX>
<STMTTRN>
<DTPOSTED>20240301
<TRNAMT>-12.50
<NAME>COFFEE SHOP
</STMTTRN>
</OFX>`;

      const result = parse(Buffer.from(qfx), 'qfx');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toBe('2024-03-01');
      expect(result.transactions[0].amount).toBe('12.50');
      expect(result.transactions[0].type).toBe('DEBIT');
    });

    it('falls back to MEMO when NAME is missing', () => {
      const ofx = `
<OFX>
<STMTTRN>
<DTPOSTED>20240115
<TRNAMT>100.00
<MEMO>Wire Transfer
</STMTTRN>
</OFX>`;

      const result = parse(Buffer.from(ofx), 'ofx');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Wire Transfer');
    });

    it('skips transactions with missing required fields', () => {
      const ofx = `
<OFX>
<STMTTRN>
<DTPOSTED>20240115
<NAME>No Amount
</STMTTRN>
<STMTTRN>
<TRNAMT>50.00
<NAME>No Date
</STMTTRN>
<STMTTRN>
<DTPOSTED>20240115
<TRNAMT>75.00
<NAME>Valid Transaction
</STMTTRN>
</OFX>`;

      const result = parse(Buffer.from(ofx), 'ofx');

      expect(result.transactions).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.transactions[0].description).toBe('Valid Transaction');
    });
  });

  describe('file size rejection', () => {
    it('rejects files exceeding 10MB', () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 'a');

      const result = parse(largeBuffer, 'csv');

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('exceeds maximum');
    });
  });

  describe('row limit rejection', () => {
    it('rejects CSV files exceeding 50,000 rows', () => {
      const header = 'date,amount,description';
      const row = '2024-01-01,10.00,Test';
      const lines = [header, ...Array(50_001).fill(row)];
      const csv = lines.join('\n');

      const result = parse(Buffer.from(csv), 'csv');

      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('50000');
    });
  });

  describe('CSV exporter', () => {
    it('exports transactions to CSV', () => {
      const transactions: ParsedTransaction[] = [
        {
          date: '2024-01-15',
          amount: '100.50',
          description: 'Salary',
          category: 'Income',
          type: 'CREDIT',
        },
        {
          date: '2024-01-16',
          amount: '45.00',
          description: 'Grocery Store',
          category: 'Food',
          type: 'DEBIT',
        },
      ];

      const buffer = exportCsv(transactions);
      const content = buffer.toString('utf-8');
      const lines = content.trim().split('\n');

      expect(lines[0]).toBe('date,amount,type,description,category');
      expect(lines[1]).toBe('2024-01-15,100.50,CREDIT,Salary,Income');
      expect(lines[2]).toBe('2024-01-16,-45.00,DEBIT,Grocery Store,Food');
    });

    it('handles descriptions with commas by quoting', () => {
      const transactions: ParsedTransaction[] = [
        {
          date: '2024-01-01',
          amount: '50.00',
          description: 'Smith, John',
          category: null,
          type: 'CREDIT',
        },
      ];

      const buffer = exportCsv(transactions);
      const content = buffer.toString('utf-8');

      expect(content).toContain('"Smith, John"');
    });

    it('handles null description and category', () => {
      const transactions: ParsedTransaction[] = [
        {
          date: '2024-01-01',
          amount: '25.00',
          description: null,
          category: null,
          type: 'CREDIT',
        },
      ];

      const buffer = exportCsv(transactions);
      const content = buffer.toString('utf-8');
      const lines = content.trim().split('\n');

      expect(lines[1]).toBe('2024-01-01,25.00,CREDIT,,');
    });
  });

  describe('round-trip: export → re-parse', () => {
    it('produces matching data after export and re-parse', () => {
      const original: ParsedTransaction[] = [
        {
          date: '2024-01-15',
          amount: '100.50',
          description: 'Salary',
          category: 'Income',
          type: 'CREDIT',
        },
        {
          date: '2024-02-01',
          amount: '45.00',
          description: 'Grocery',
          category: 'Food',
          type: 'DEBIT',
        },
        {
          date: '2024-03-10',
          amount: '200.00',
          description: null,
          category: null,
          type: 'CREDIT',
        },
      ];

      const exported = exportCsv(original);
      const reimported = parse(exported, 'csv', {
        date: 'date',
        amount: 'amount',
        description: 'description',
        category: 'category',
      });

      expect(reimported.errors).toHaveLength(0);
      expect(reimported.transactions).toHaveLength(original.length);

      for (let i = 0; i < original.length; i++) {
        expect(reimported.transactions[i].date).toBe(original[i].date);
        expect(reimported.transactions[i].amount).toBe(original[i].amount);
        expect(reimported.transactions[i].type).toBe(original[i].type);
        // Null descriptions/categories become empty strings in CSV and then null again on re-parse
        if (original[i].description) {
          expect(reimported.transactions[i].description).toBe(original[i].description);
        } else {
          expect(reimported.transactions[i].description).toBeNull();
        }
        if (original[i].category) {
          expect(reimported.transactions[i].category).toBe(original[i].category);
        } else {
          expect(reimported.transactions[i].category).toBeNull();
        }
      }
    });

    it('round-trips descriptions containing special characters', () => {
      const original: ParsedTransaction[] = [
        {
          date: '2024-06-01',
          amount: '99.99',
          description: 'Amazon.com, Inc.',
          category: 'Shopping',
          type: 'DEBIT',
        },
        {
          date: '2024-06-02',
          amount: '15.00',
          description: 'Book: "TypeScript in Action"',
          category: 'Education',
          type: 'DEBIT',
        },
      ];

      const exported = exportCsv(original);
      const reimported = parse(exported, 'csv', {
        date: 'date',
        amount: 'amount',
        description: 'description',
        category: 'category',
      });

      expect(reimported.errors).toHaveLength(0);
      expect(reimported.transactions).toHaveLength(2);
      expect(reimported.transactions[0].description).toBe('Amazon.com, Inc.');
      expect(reimported.transactions[1].description).toBe('Book: "TypeScript in Action"');
    });
  });
});
