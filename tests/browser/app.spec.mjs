import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:8000/';
const nav=async(page,tab,title,parent=tab)=>{
 await page.locator('#tabs button[data-t="'+parent+'"]').click();
 if(tab==='time')await page.locator('[data-insight-jump="performance"]').click();
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
 // Remove Playwright interception before exercising native offline navigation.
 await page.unroute('**/*');
 await context.setOffline(true);
 try {
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx)).toEqual([]);
  expect(errors).toEqual([]);
 } finally {await context.setOffline(false);}
});
for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]])for(const theme of ['light','dark']){
 test('premium layout '+width+'x'+height+' '+theme,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:theme});await seed(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
  await expect(page.locator('.overview-hero')).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx);
  for(const [tab,title,selector] of [['home','Overview','.overview-hero'],['list','Holdings','.holdings-summary'],['insights','Insights','.insight-hero'],['planning','Planning','#planning-goals'],['more','More','.hub-list']]){
   await nav(page,tab,title);await expect(page.locator(selector)).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow on '+tab).toBe(true);
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

test('holdings preferences, search and insight navigation',async({page})=>{
 await seed(page);await page.goto(base);await nav(page,'list','Holdings');
 await page.locator('#holdingSearch').fill('not present');await expect(page.locator('.hc:visible')).toHaveCount(0);
 await page.locator('#holdingSearch').fill('QA');await expect(page.locator('.hc:visible')).toHaveCount(1);await expect(page.locator('#holdingSearch')).toBeFocused();
 await page.locator('.ho-filter-menu summary').click();await page.locator('[data-holding-layout]').click();await expect(page.locator('.hc-compact')).toHaveCount(0);
 await page.locator('.ho-filter-menu summary').click();await page.locator('[data-holding-direction]').click();
 await page.reload();await nav(page,'list','Holdings');await expect(page.locator('.hc-compact')).toHaveCount(0);await page.locator('.ho-filter-menu summary').click();await expect(page.locator('[data-holding-direction]')).toContainText('↑');
 await nav(page,'insights','Insights');await page.locator('[data-insight-jump="risk"]').click();await expect(page.locator('#insight-risk')).toBeVisible();await expect(page.locator('#insight-performance')).toHaveCount(0);
 await nav(page,'plan','Plan','planning');await page.locator('.context-back').click();await expect(page.locator('#ttl')).toHaveText('Planning');
});

for(const missing of [false,true])test('explicit recovery '+(missing?'missing':'corrupt'),async({page})=>{
 await page.addInitScript(({fixture,missing})=>{if(sessionStorage.getItem('recovery-seeded'))return;sessionStorage.setItem('recovery-seeded','1');localStorage.setItem('portfolio-v1-recovery',JSON.stringify(fixture));if(missing)localStorage.removeItem('portfolio-v1');else localStorage.setItem('portfolio-v1','broken')},{fixture,missing});
 await page.goto(base);await expect(page.getByRole('heading',{name:'Portfolio recovery'})).toBeVisible();
 await page.getByRole('button',{name:'Last local backup'}).click();
 const restore=page.getByRole('button',{name:'Restore selected backup'});await expect(restore).toBeEnabled();
 page.once('dialog',d=>d.dismiss());await restore.click();
 expect(await page.evaluate(()=>localStorage.getItem('portfolio-v1'))).toBe(missing?null:'broken');
 page.once('dialog',d=>d.accept());await restore.click();await expect(page.locator('.overview-hero')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).tx)).toEqual(fixture.tx);
 if(!missing)expect(await page.evaluate(()=>localStorage.getItem('portfolio-v1-damaged'))).toBe('broken');
});

test('application health and concurrent portfolio change',async({page})=>{
 await seed(page);await page.goto(base);await expect(page.locator('.overview-hero')).toBeVisible();
 await nav(page,'data','Import and backup','more');
 await page.locator('[data-group="application"] summary').click();
 await page.evaluate(()=>{globalThis.clearDiagnostics();globalThis.recordError('network')});
 await page.locator('#app-health-refresh').click();
 await expect(page.locator('#app-health-report')).toContainText('1 recent diagnostic events');
 await page.locator('#app-health-clear').click();
 await expect(page.locator('#app-health-report')).toContainText('0 recent diagnostic events');
 await page.evaluate(()=>{const key='portfolio-v1',oldValue=localStorage.getItem(key),p=JSON.parse(oldValue);p.goals=[];p.qaExternalChange=true;const newValue=JSON.stringify(p);localStorage.setItem(key,newValue);window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage}))});
 await expect(page.locator('#portfolio-conflict')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-v1')).qaExternalChange)).toBe(true);
});

test('overview displays dated one-day market change independently of selected period',async({page})=>{
 await seed(page);await page.goto(base);
 const daily=page.locator('#overview-day-change');await expect(daily).toBeVisible();await expect(daily).toContainText('1-day market change');
 await page.locator('#pfw [data-pp="1M"]').click();await expect(daily).toContainText('1-day market change');
});

test('overview and holdings period controls preserve current valuation and local selection',async({page})=>{
 await seed(page);await page.goto(base);
 const hero=page.locator('.overview-hero h1'),initial=await hero.innerText();
 for(const period of ['1D','1W','1M','1Y','All']){
  await page.locator('#pfw [data-pp="'+period+'"]').click();
  await expect(hero).toHaveText(initial);
 }
 await nav(page,'list','Holdings');
 const holdingHero=page.locator('.holdings-summary h1'),holdingValue=await holdingHero.innerText();
 await page.locator('.ho-filter-menu summary').click();
 await page.locator('#holdingPeriod').selectOption('3M');
 await expect(holdingHero).toHaveText(holdingValue);
 await nav(page,'home','Overview');
 await expect(hero).toHaveText(initial);
 await expect(page.locator('#pfw [data-pp="All"]')).toHaveAttribute('aria-pressed','true');
 await nav(page,'list','Holdings');
 await page.locator('.ho-filter-menu summary').click();
 await expect(page.locator('#holdingPeriod')).toHaveValue('3M');
});

test('custom theme extreme colors preserve contrast and portfolio storage',async({page})=>{
 await seed(page);
 await page.addInitScript(()=>{if(!localStorage.getItem('portfolio-appearance-v1'))localStorage.setItem('portfolio-appearance-v1',JSON.stringify({base:'#FFFFFF',mode:'light'}))});
 await page.goto(base);
 const before=await page.evaluate(()=>localStorage.getItem('portfolio-v1'));
 await page.evaluate(()=>{const host=document.createElement('div');host.innerHTML=globalThis.appearanceCard();document.body.append(host)});
 for(const mode of ['light','dark']){
  await page.locator('#appearance-mode').selectOption(mode);
  for(const color of ['#ffffff','#000000','#ffff00','#000080','#ff0000']){
   await page.locator('#appearance-color').fill(color);
   const ratios=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement),v=k=>s.getPropertyValue('--'+k).trim(),lum=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0),ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);return [ratio(v('theme-primary'),'#ffffff'),ratio(v('theme-accent'),v('card')),ratio(v('theme-chart'),v('card')),ratio(v('mut'),v('card'))]});
   expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
  }
 }
 expect(await page.evaluate(()=>localStorage.getItem('portfolio-v1'))).toBe(before);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
