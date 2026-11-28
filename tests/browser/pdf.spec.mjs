import {test,expect} from '@playwright/test';
test('bundled PDF reader extracts local PDF text',async({page})=>{
 await page.goto('http://127.0.0.1:8000/');
 await page.waitForFunction(()=>typeof window.pdfText==='function');
 const lines=await page.evaluate(async()=>{
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const stream='BT /F1 12 Tf 20 200 Td (CAS test) Tj ET';objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const x=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF';
 return window.pdfText(new TextEncoder().encode(pdf).buffer,'');
 });expect(lines.join(' ')).toContain('CAS test');
});
