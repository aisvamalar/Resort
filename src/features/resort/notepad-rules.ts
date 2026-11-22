import {sum} from './accounting';
export interface ExpenseNote {id:string;resort_id:string;note_date:string;description:string;amount:number;category:string;payment_method:string;notes:string;converted_expense_id:string|null}
export function noteTotal(notes:ExpenseNote[],from:string,to:string){return sum(notes.filter(n=>n.note_date>=from&&n.note_date<=to),n=>n.amount);}
