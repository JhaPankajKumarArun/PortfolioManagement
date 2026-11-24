import {test,expect} from '@playwright/test';
test('startup, navigation, backup and offline reload',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/');
 await expect(page.locator('#app')).not.toBeEmpty();
 for(const [tab,title] of Object.entries({list:'Holdings',sips:'SIP tracker',plan:'Plan',swp:'SWP',time:'Time Machine',tax:'Tax',data:'Import and backup',home:'Overview'})){
  await page.locator('button[data-t="'+tab+'"]').first().click();await expect(page.locator('#ttl')).toHaveText(title);
 }
 await page.locator('button[data-t="data"]').first().click();
 await page.locator('#bk').fill(JSON.stringify({tx:[],px:{}}));
 await page.locator('[data-a="restore"]').click();await expect(page.locator('#msg')).toContainText('Restored');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx)).toEqual([]);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.locator('#app')).not.toBeEmpty();expect(errors).toEqual([]);
});
