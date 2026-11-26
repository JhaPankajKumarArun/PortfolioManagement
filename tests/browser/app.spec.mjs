import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:8000/';
const nav=async(page,tab,title,parent=tab)=>{
 await page.locator('#tabs button[data-t="'+parent+'"]').click();
 if(tab!==parent)await page.locator('#app button[data-t="'+tab+'"]').first().click();
 await expect(page.locator('#ttl')).toHaveText(title);
 await expect(page.locator('#tabs button[data-t="'+parent+'"]')).toHaveAttribute('aria-current','page');
};
const fixture={tx:[{type:'stock',side:'buy',name:'QA Stock',date:'2024-01-01',units:10,price:100}],px:{'QA Stock':120},pxd:{'QA Stock':'2024-02-01'},goals:[]};
async function seed(page){
 await page.addInitScript(p=>{if(!localStorage.getItem('portfolio-v1'))localStorage.setItem('portfolio-v1',JSON.stringify(p))},fixture);
 await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
}
test('startup, navigation, backup and offline reload',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await seed(page);await page.goto(base);
 await expect(page.locator('.overview-hero')).toBeVisible();
 for(const [tab,title,parent] of [['list','Holdings','list'],['sips','SIP tracker','planning'],['plan','Plan','planning'],['swp','SWP','planning'],['time','Time Machine','insights'],['tax','Tax','more'],['data','Import and backup','more'],['home','Overview','home']])await nav(page,tab,title,parent);
 await nav(page,'data','Import and backup','more');
 await page.locator('#bk').fill(JSON.stringify({tx:[],px:{},goals:[]}));
 page.once('dialog',d=>d.accept());
 await page.locator('[data-a="restore"]').click();await expect(page.locator('#msg')).toContainText('Restored');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx)).toEqual([]);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.locator('#app')).not.toBeEmpty();expect(errors).toEqual([]);
});
for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]])for(const theme of ['light','dark']){
 test('premium layout '+width+'x'+height+' '+theme,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});await seed(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await expect(page.locator('.overview-hero')).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx);
  for(const [tab,title,selector] of [['home','Overview','.overview-hero'],['list','Holdings','.holdings-summary'],['insights','Insights','.insight-hero'],['planning','Planning','.hub-hero'],['more','More','.hub-hero']]){
   await nav(page,tab,title);await expect(page.locator(selector)).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const bounds=await page.locator('#tabs').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
   await test.info().attach(tab,{body:await page.screenshot(),contentType:'image/png'});
  }
  await nav(page,'list','Holdings');await page.locator('[data-f="stock"]').click();await expect(page.locator('.hc')).toHaveCount(1);
  await page.locator('[data-f="mf"]').click();await expect(page.locator('.hc')).toHaveCount(0);
  await page.locator('[data-f="all"]').click();await expect(page.locator('.hc')).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx)).toEqual(before);
  expect(errors).toEqual([]);
 });
}
