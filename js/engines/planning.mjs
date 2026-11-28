function projectPortfolio(r,C,pl){const mr=Math.pow(1+r/100,1/12)-1;let v=C.tv,inv=C.tc,s=pl.sip;const p=[[0,v,inv]];for(let y=1;y<=pl.yrs;y++){for(let m=0;m<12;m++){v=v*(1+mr)+s;inv+=s}s*=1+pl.step/100;p.push([y,v,inv])}return p}
function swpSim(c,r,w,st,yrs){const mr=Math.pow(1+r/100,1/12)-1,pts=[[0,c]];let b=c,tw=0,m=0,wm=w,dep=false;
outer:for(let y=1;y<=yrs;y++){for(let k=0;k<12;k++){const x=Math.min(b,wm);b-=x;tw+=x;if(x<wm-1e-6){dep=true;m+=x/wm;pts.push([m/12,0]);break outer}m++;b*=1+mr}wm*=1+st/100;pts.push([y,b])}
return{pts,end:dep?0:b,tw,months:dep?Math.floor(m):m,dep}}
function safeW(c,r,st,yrs){let lo=0,hi=Math.max(c,1);for(let i=0;i<45;i++){const mid=(lo+hi)/2;swpSim(c,r,mid,st,yrs).dep?hi=mid:lo=mid}return lo}

export { projectPortfolio, swpSim, safeW };
