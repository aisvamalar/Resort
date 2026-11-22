import {describe,it,expect} from 'vitest';
import {noteTotal,type ExpenseNote} from '@/features/resort/notepad-rules';
const note=(changes:Partial<ExpenseNote>={}):ExpenseNote=>({id:'milk',resort_id:'resort',note_date:'2026-11-22',description:'Milk',amount:1200,category:'Milk & Dairy',notes:'',converted_expense_id:null,...changes});
describe('Daily expense notes',()=>{
 it('totals only the selected day',()=>expect(noteTotal([note(),note({note_date:'2026-11-21',amount:800})],'2026-11-22','2026-11-22')).toBe(1200));
 it('totals weekly entries within inclusive dates',()=>expect(noteTotal([note(),note({note_date:'2026-11-16',amount:800}),note({note_date:'2026-11-15',amount:500})],'2026-11-16','2026-11-22')).toBe(2000));
 it('keeps converted notes in the notepad total once',()=>expect(noteTotal([note({converted_expense_id:'expense'})],'2026-11-01','2026-11-22')).toBe(1200));
});
