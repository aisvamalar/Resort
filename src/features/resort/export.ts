import type {ResortData} from './accounting';
import {getResortData} from './data.functions';
import {checkWorkbook} from './export-check';
export async function downloadWorkbook(_displayData:ResortData,kind:string,from:string,to:string) {
 // A dashboard may still be showing its empty loading fallback or stale cache.
 // Always read the signed-in owner's complete records before creating a file.
 const data=await getResortData();
 const {buildWorkbook,workbookFilename}=await import('./export-workbook');
 const workbook=await buildWorkbook(data,kind,from,to);
 checkWorkbook(workbook,data,kind,from,to);
 const bytes=await workbook.xlsx.writeBuffer();
 // Check the actual serialized file, including dates, formulas and saved alignment.
 const {Workbook}=await import('exceljs');
 const restored=new Workbook();
 await restored.xlsx.load(bytes);
 checkWorkbook(restored,data,kind,from,to);
 const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=workbookFilename(data,kind,from,to);
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
