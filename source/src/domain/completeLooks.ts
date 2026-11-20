import { buildFixtureSession } from './stylingEngine';
import type { TasteSignals } from './learning';
import type { Look, Profile } from './types';
/** Top, bottom and shoes; or a dress and shoes. */
export const isCompleteOutfit=(look:Look)=>{const has=(slot:string)=>look.products.some(p=>p.slot===slot);return has('shoes')&&(has('dress')||(has('top')&&has('pants')));};
/** Bounded curated contexts share the same preference/exclusion and whole-look budget rules. */
export function completeLooks(profile: Profile, signals?: TasteSignals): Look[] {
 const contexts = [
  {title:'Everyday, elevated',dressCode:'Smart casual',occasion:'Everyday'},
  {title:'An evening out',dressCode:'Formal',occasion:'Dinner'},
  {title:'An unhurried weekend',dressCode:'Relaxed casual',occasion:'Weekend'},
 ];
 const seen=new Set<string>();
 return contexts.flatMap(context=>buildFixtureSession({...context,budgetCents:profile.budgetCents},profile,'discovery-'+context.occasion,0,signals).looks.map(look=>({...look,title:context.title,vibe:context.dressCode,why:'Coordinated for '+context.occasion.toLowerCase()+', within your look budget.'}))).filter(look=>{
  const identity=look.products.map(p=>[p.id,p.size,p.priceCents].join(':')).sort().join('|');
  if(seen.has(identity)||!isCompleteOutfit(look))return false;
  seen.add(identity);return true;
 });
}
